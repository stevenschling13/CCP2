import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_INSTRUCTION_GROWER } from '../../constants';
import type { ChatMessage } from '../../types';

const genAiMocks = vi.hoisted(() => {
  const generateContent = vi.fn();
  const generateContentStream = vi.fn();
  const chatCreate = vi.fn();
  const GoogleGenAI = vi.fn(function () {
    return {
      models: {
        generateContent,
        generateContentStream,
      },
      chats: {
        create: chatCreate,
      },
    };
  });

  return { generateContent, generateContentStream, chatCreate, GoogleGenAI };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: genAiMocks.GoogleGenAI,
  Type: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    ARRAY: 'ARRAY',
    NUMBER: 'NUMBER',
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.VITE_GEMINI_CHAT_MODEL;
  genAiMocks.generateContent.mockResolvedValue({ text: 'ok' });
});

describe('geminiService chat', () => {
  it('appends the new user message and includes the grower system instruction', async () => {
    const { geminiService } = await import('../../services/geminiService');
    const history: ChatMessage[] = [
      { id: '1', role: 'user', text: 'a', timestamp: 1 },
    ];

    await geminiService.chat(history, 'b');

    expect(genAiMocks.generateContent).toHaveBeenCalledTimes(1);
    const request = genAiMocks.generateContent.mock.calls[0][0];
    expect(request.contents.at(-1)).toEqual({ role: 'user', parts: [{ text: 'b' }] });
    expect(request.config.systemInstruction).toBe(SYSTEM_INSTRUCTION_GROWER);
  });

  it('uses the Gemini preview chat model by default', async () => {
    const { CHAT_MODEL_ID } = await import('../../services/geminiService');

    expect(CHAT_MODEL_ID).toBe('gemini-3.1-pro-preview');
  });
});
