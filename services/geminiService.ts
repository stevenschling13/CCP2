import { GoogleGenAI, Type } from "@google/genai";
import { FacilityBriefing, AiDiagnosis, ChatMessage, Room } from "../types";
import { BRIEFING_PROMPT, SYSTEM_INSTRUCTION_GROWER } from "../constants";

// Models
const MODEL_REASONING = 'gemini-3-pro-preview';
const MODEL_FAST = 'gemini-2.5-flash';
const MODEL_VISION = 'gemini-2.5-flash'; // 2.5 flash is great for fast vision

class GeminiService {
  private ai: GoogleGenAI | null = null;
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly COOLDOWN_MS = 60000; // 1 minute

  private getClient(): GoogleGenAI {
    if (!this.ai) {
      const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();

      if (!apiKey) {
        const message = 'Gemini API key missing. Set GEMINI_API_KEY (or legacy API_KEY) in your environment.';
        console.error(message);
        throw new Error(message);
      }

      this.ai = new GoogleGenAI({ apiKey });
    }

    return this.ai;
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
    return this.withRetry(async () => {
      const ai = this.getClient();

      const roomData = rooms.map(r =>
        `${r.name}: ${r.status} (Temp: ${r.currentReading?.temp}C, RH: ${r.currentReading?.humidity}%)`
      ).join('\n');

      const prompt = `${BRIEFING_PROMPT}\nCurrent Sensor Data:\n${roomData}`;

      const response = await ai.models.generateContent({
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
      return JSON.parse(response.text) as FacilityBriefing;
    });
  }

  async analyzePlantImage(imageBase64: string): Promise<AiDiagnosis> {
    return this.withRetry(async () => {
      const ai = this.getClient();

      const response = await ai.models.generateContent({
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

  async chat(history: ChatMessage[], newMessage: string): Promise<string> {
    return this.withRetry(async () => {
        const ai = this.getClient();
        // Manual history construction for chat
        // Filter out thinking logs or partials if we had them
        const contents = history.map(h => ({
            role: h.role,
            parts: [{ text: h.text }]
        }));
        
        // Add new message
        contents.push({ role: 'user', parts: [{ text: newMessage }] });

        const response = await ai.models.generateContent({
            model: MODEL_REASONING,
            contents: contents,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION_GROWER,
                // thinkingConfig: { thinkingBudget: 1024 } // Removed: Not available for gemini-3-pro-preview
            }
        });

        return response.text || "I couldn't generate a response.";
    });
  }
  
  async chatStream(history: ChatMessage[], newMessage: string): Promise<AsyncIterable<string>> {
      const ai = this.getClient();
      const contents = history.map(h => ({
          role: h.role,
          parts: [{ text: h.text }]
      }));
      contents.push({ role: 'user', parts: [{ text: newMessage }] });

      const responseStream = await ai.models.generateContentStream({
          model: MODEL_REASONING,
          contents: contents,
          config: {
              systemInstruction: SYSTEM_INSTRUCTION_GROWER,
              // thinkingConfig: { thinkingBudget: 1024 } // Removed: Not available for gemini-3-pro-preview
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