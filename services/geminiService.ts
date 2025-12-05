import { GoogleGenAI, Type } from "@google/genai";
import { FacilityBriefing, AiDiagnosis, ChatMessage, Room, ArOverlayData } from "../types";
import { BRIEFING_PROMPT, SYSTEM_INSTRUCTION_GROWER } from "../constants";

// Models
const MODEL_REASONING = 'gemini-3-pro-preview';
const MODEL_FAST = 'gemini-2.5-flash';
const MODEL_VISION = 'gemini-2.5-flash'; // 2.5 flash is great for fast vision

class GeminiService {
  private ai: GoogleGenAI;
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly COOLDOWN_MS = 60000; // 1 minute

  // Cache
  private briefingCache: { data: FacilityBriefing, timestamp: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const apiKey = process.env.API_KEY || '';
    this.ai = new GoogleGenAI({ apiKey });
  }

  private checkCircuitBreaker() {
    if (this.consecutiveFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < this.COOLDOWN_MS) {
        throw new Error(`AI System Cooldown: ${Math.ceil((this.COOLDOWN_MS - timeSinceLastFailure) / 1000)}s remaining`);
      } else {
        // Reset after cooldown
        this.consecutiveFailures = 0;
      }
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    this.checkCircuitBreaker();
    try {
      const result = await fn();
      this.consecutiveFailures = 0; // Success resets counter
      return result;
    } catch (error: any) {
      this.consecutiveFailures++;
      this.lastFailureTime = Date.now();
      
      const isRetryable = error.message?.includes('429') || error.message?.includes('503');
      if (retries > 0 && isRetryable) {
        const delay = (4 - retries) * 1000; // 1s, 2s, 3s backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.withRetry(fn, retries - 1);
      }
      throw error;
    }
  }

  async generateFacilityBriefing(rooms: Room[]): Promise<FacilityBriefing> {
    // Check Cache
    if (this.briefingCache && Date.now() - this.briefingCache.timestamp < this.CACHE_TTL) {
        // Invalidate if room status is CRITICAL but cache says OPTIMAL (safety check)
        const hasCritical = rooms.some(r => r.status === 'CRITICAL');
        if (!hasCritical || this.briefingCache.data.status === 'CRITICAL') {
            return this.briefingCache.data;
        }
    }

    return this.withRetry(async () => {
      const roomData = rooms.map(r => 
        `${r.name}: ${r.status} (Temp: ${r.currentReading?.temp}C, RH: ${r.currentReading?.humidity}%)`
      ).join('\n');

      const prompt = `${BRIEFING_PROMPT}\nCurrent Sensor Data:\n${roomData}`;

      const response = await this.ai.models.generateContent({
        model: MODEL_FAST,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING, enum: ["OPTIMAL", "ATTENTION", "CRITICAL"] },
              summary: { type: Type.STRING },
              actionItems: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["status", "summary", "actionItems"]
          }
        }
      });

      if (!response.text) throw new Error("Empty response from AI");
      const result = JSON.parse(response.text) as FacilityBriefing;
      
      // Update Cache
      this.briefingCache = { data: result, timestamp: Date.now() };
      
      return result;
    });
  }

  async analyzePlantImage(imageBase64: string): Promise<AiDiagnosis> {
    return this.withRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: MODEL_VISION,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
            { text: "Analyze this plant. Identify health, issues (pests/deficiencies), and provide recommendations." }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              healthScore: { type: Type.NUMBER, description: "0 to 100" },
              issues: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              confidence: { type: Type.NUMBER }
            }
          }
        }
      });

      if (!response.text) throw new Error("No analysis returned");
      return JSON.parse(response.text) as AiDiagnosis;
    });
  }

  async analyzeLiveFrame(imageBase64: string): Promise<ArOverlayData> {
    // No retries for live frames to prevent lag
    const response = await this.ai.models.generateContent({
        model: MODEL_VISION,
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
                { text: "Scan this view. Detect plant parts or pests. Estimate health 0-100." }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    status: { type: Type.STRING, enum: ["SCANNING", "LOCKED", "ANALYZING"] },
                    detectedObjects: { 
                        type: Type.ARRAY, 
                        items: { 
                            type: Type.OBJECT, 
                            properties: {
                                label: { type: Type.STRING },
                                confidence: { type: Type.NUMBER }
                            }
                        } 
                    },
                    healthEstimate: { type: Type.NUMBER }
                }
            }
        }
    });
    
    if (!response.text) return { status: 'SCANNING', detectedObjects: [], healthEstimate: 0 };
    return JSON.parse(response.text) as ArOverlayData;
  }

  async chat(history: ChatMessage[], newMessage: string): Promise<string> {
    return this.withRetry(async () => {
        // Manual history construction for chat
        const contents = history.map(h => ({
            role: h.role,
            parts: [{ text: h.text }]
        }));
        
        // Add new message
        contents.push({ role: 'user', parts: [{ text: newMessage }] });

        const response = await this.ai.models.generateContent({
            model: MODEL_REASONING,
            contents: contents,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION_GROWER,
            }
        });

        return response.text || "I couldn't generate a response.";
    });
  }
  
  async chatStream(history: ChatMessage[], newMessage: string): Promise<AsyncIterable<string>> {
      const contents = history.map(h => ({
          role: h.role,
          parts: [{ text: h.text }]
      }));
      contents.push({ role: 'user', parts: [{ text: newMessage }] });

      const responseStream = await this.ai.models.generateContentStream({
          model: MODEL_REASONING,
          contents: contents,
          config: {
              systemInstruction: SYSTEM_INSTRUCTION_GROWER,
          }
      });

      return {
          async *[Symbol.asyncIterator]() {
              for await (const chunk of responseStream) {
                  if (chunk.text) {
                      yield chunk.text;
                  }
              }
          }
      };
  }
}

export const geminiService = new GeminiService();