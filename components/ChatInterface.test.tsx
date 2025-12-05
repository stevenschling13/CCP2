import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ChatInterface } from './ChatInterface';
import { geminiService } from '../services/geminiService';
import { ChatMessage } from '../types';

vi.mock('../services/geminiService', () => ({
    geminiService: {
        chat: vi.fn().mockResolvedValue('Mock response')
    }
}));

describe('ChatInterface', () => {
    it('sends the latest user message in the API payload', async () => {
        render(<ChatInterface />);

        const input = screen.getByPlaceholderText('Ask CoPilot...');
        fireEvent.change(input, { target: { value: 'Testing payload' } });
        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => {
            expect(geminiService.chat).toHaveBeenCalled();
        });

        const [history] = (geminiService.chat as unknown as vi.Mock).mock.calls[0];
        expect((history as ChatMessage[]).some(msg => msg.role === 'user' && msg.text === 'Testing payload')).toBe(true);
    });
});
