import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const chatMocks = vi.hoisted(() => ({
  chatStream: vi.fn(),
  analyzePlantImage: vi.fn(),
  loadMessages: vi.fn(),
  saveMessages: vi.fn(),
  clearMessages: vi.fn(),
}));

vi.mock('../../services/geminiService', () => ({
  CHAT_MODEL_ID: 'gemini-3.1-pro-preview',
  geminiService: {
    chatStream: chatMocks.chatStream,
    analyzePlantImage: chatMocks.analyzePlantImage,
  },
}));

vi.mock('../../utils/chatStore', () => ({
  loadMessages: chatMocks.loadMessages,
  saveMessages: chatMocks.saveMessages,
  clearMessages: chatMocks.clearMessages,
}));

import { ChatInterface } from '../../components/ChatInterface';

async function* streamTokens(tokens: string[]) {
  for (const token of tokens) {
    yield token;
  }
}

describe('ChatInterface', () => {
  beforeEach(() => {
    chatMocks.chatStream.mockResolvedValue(streamTokens(['Hel', 'lo ', 'grower']));
    chatMocks.loadMessages.mockResolvedValue([]);
    chatMocks.saveMessages.mockResolvedValue(undefined);
    chatMocks.clearMessages.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('streams a response and clears back to the greeting', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    await user.type(screen.getByPlaceholderText('Ask CoPilot...'), 'hi{enter}');

    expect(await screen.findByText('Hello grower')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /clear/i }));

    await waitFor(() => {
      expect(screen.getByText(/Hello! I am your Cultivation CoPilot/i)).toBeVisible();
      expect(screen.queryByText('Hello grower')).not.toBeInTheDocument();
    });
  });

  it('shows a retry button when streaming fails', async () => {
    chatMocks.chatStream.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ChatInterface />);

    await user.type(screen.getByPlaceholderText('Ask CoPilot...'), 'hi{enter}');

    expect(await screen.findByRole('button', { name: /retry/i })).toBeVisible();
  });
});
