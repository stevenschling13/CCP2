import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
import { ChatMessage } from '../types';

export const ChatInterface: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: '1', role: 'model', text: 'Hello! I am your Cultivation CoPilot. How are your plants looking today?', timestamp: Date.now() }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input, timestamp: Date.now() };
        const thinkingMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: '', timestamp: Date.now(), isThinking: true };

        const nextMessages = [...messages, userMsg, thinkingMessage];
        setMessages(nextMessages);
        setInput('');
        setIsLoading(true);

        try {
            // Stream response (simulated stream for now via service)
            const responseText = await geminiService.chat(nextMessages.filter(m => !m.isThinking));

            setMessages(prev => prev.map(m =>
                m.id === thinkingMessage.id ? { ...m, text: responseText, isThinking: false } : m
            ));

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error connecting to the AI service.';
            console.error('Chat send failed', e);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `Sorry, I encountered an error: ${errorMessage}`, timestamp: Date.now() }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-black pb-20">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(m => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            m.role === 'user' 
                            ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' 
                            : 'bg-neutral-900 text-gray-200 border border-neutral-800'
                        }`}>
                            {m.isThinking ? (
                                <div className="flex space-x-1 h-6 items-center">
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75"></div>
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></div>
                                </div>
                            ) : (
                                <div className="markdown prose prose-invert text-sm leading-relaxed whitespace-pre-wrap">
                                    {m.text}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={endRef}></div>
            </div>
            
            <div className="p-4 bg-black border-t border-neutral-900">
                <div className="flex gap-2">
                    <input 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="Ask CoPilot..."
                        className="flex-1 bg-neutral-900 border border-neutral-800 rounded-full px-4 py-3 text-white focus:outline-none focus:border-neon-green transition-colors"
                        disabled={isLoading}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="bg-neon-green disabled:opacity-50 text-black font-bold p-3 rounded-full hover:bg-green-400 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};