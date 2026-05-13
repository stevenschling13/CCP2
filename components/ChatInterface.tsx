import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CHAT_MODEL_ID, geminiService } from '../services/geminiService';
import { ChatMessage } from '../types';
import { clearMessages, loadMessages, saveMessages } from '../utils/chatStore';

type UiChatMessage = ChatMessage & {
    error?: boolean;
    imagePreview?: string;
    retryText?: string;
};

const greeting: UiChatMessage = {
    id: 'greeting',
    role: 'model',
    text: 'Hello! I am your Cultivation CoPilot. How are your plants looking today?',
    timestamp: Date.now(),
};

const suggestedPrompts = [
    'Diagnose yellowing fan leaves on week 3 flower',
    'Optimal VPD targets for week 4 of flower in coco?',
    'Build a 4-week feed schedule for coco coir, RO water',
    'How to read trichomes for harvest window?',
];

const Markdown: React.FC<{ children: string }> = ({ children }) => (
    <div className="prose prose-invert prose-sm max-w-none leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {children}
        </ReactMarkdown>
    </div>
);

const createId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const cleanHistory = (history: UiChatMessage[]): ChatMessage[] =>
    history
        .filter(message => !message.error && !message.isThinking)
        .map(({ id, role, text, timestamp }) => ({ id, role, text, timestamp }));

const formatDiagnosis = (diagnosis: Awaited<ReturnType<typeof geminiService.analyzePlantImage>>) => {
    const confidence = diagnosis.confidence <= 1 ? diagnosis.confidence * 100 : diagnosis.confidence;
    const issues = diagnosis.issues.length ? diagnosis.issues : ['No major issues detected.'];
    const recommendations = diagnosis.recommendations.length ? diagnosis.recommendations : ['Continue monitoring the plant and environment.'];

    return `**Image diagnosis** — Health: ${Math.round(diagnosis.healthScore)}/100 (confidence ${Math.round(confidence)}%)\n\nIssues:\n${issues.map(issue => `- ${issue}`).join('\n')}\n\nRecommendations:\n${recommendations.map(item => `- ${item}`).join('\n')}`;
};

export const ChatInterface: React.FC = () => {
    const [messages, setMessages] = useState<UiChatMessage[]>([greeting]);
    const [input, setInput] = useState('');
    const [isHydrated, setIsHydrated] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
    const cancelledRef = useRef(false);
    const endRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let mounted = true;
        loadMessages()
            .then(saved => {
                if (!mounted) return;
                setMessages(saved.length ? saved as UiChatMessage[] : [greeting]);
            })
            .catch(() => setMessages([greeting]))
            .finally(() => {
                if (mounted) setIsHydrated(true);
            });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!isHydrated) return;
        const timeout = window.setTimeout(() => {
            void saveMessages(cleanHistory(messages));
        }, 200);

        return () => window.clearTimeout(timeout);
    }, [isHydrated, messages]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = 'auto';
        const lineHeight = 24;
        textarea.style.height = `${Math.min(textarea.scrollHeight, lineHeight * 6)}px`;
    }, [input]);

    const streamAssistantResponse = async (history: UiChatMessage[], prompt: string, visibleMessages: UiChatMessage[]) => {
        const modelId = createId();
        const modelMessage: UiChatMessage = {
            id: modelId,
            role: 'model',
            text: '',
            timestamp: Date.now(),
            isThinking: true,
        };

        cancelledRef.current = false;
        setIsStreaming(true);
        setMessages([...visibleMessages, modelMessage]);

        let accumulated = '';
        try {
            const stream = await geminiService.chatStream(cleanHistory(history), prompt);
            for await (const token of stream) {
                if (cancelledRef.current) break;
                accumulated += token;
                setMessages(prev => prev.map(message =>
                    message.id === modelId ? { ...message, text: accumulated, isThinking: false } : message
                ));
            }

            if (cancelledRef.current) {
                const stoppedText = `${accumulated.trimEnd()}${accumulated.trim() ? ' ' : ''}(stopped)`;
                setMessages(prev => prev.map(message =>
                    message.id === modelId ? { ...message, text: stoppedText, isThinking: false } : message
                ));
            } else {
                setMessages(prev => prev.map(message =>
                    message.id === modelId ? { ...message, text: accumulated || 'I could not generate a response.', isThinking: false } : message
                ));
            }
        } catch (error) {
            const text = error instanceof Error ? error.message : 'AI connection failed.';
            setMessages(prev => prev.map(message =>
                message.id === modelId
                    ? {
                        ...message,
                        text: `Sorry, I encountered an error connecting to the neural network. ${text}`,
                        isThinking: false,
                        error: true,
                        retryText: prompt,
                    }
                    : message
            ));
        } finally {
            setIsStreaming(false);
            cancelledRef.current = false;
        }
    };

    const sendPrompt = async (promptOverride?: string) => {
        const prompt = (promptOverride ?? input).trim();
        if (!prompt || isStreaming) return;

        const userMessage: UiChatMessage = {
            id: createId(),
            role: 'user',
            text: prompt,
            timestamp: Date.now(),
        };
        const history = messages;
        const visibleMessages = [...messages, userMessage];

        setInput('');
        await streamAssistantResponse(history, prompt, visibleMessages);
    };

    const stopStreaming = () => {
        cancelledRef.current = true;
    };

    const regenerate = async (modelMessageId: string) => {
        if (isStreaming) return;
        const modelIndex = messages.findIndex(message => message.id === modelMessageId);
        const userIndex = [...messages.slice(0, modelIndex)].reverse().findIndex(message => message.role === 'user');
        if (modelIndex < 0 || userIndex < 0) return;

        const priorUserIndex = modelIndex - userIndex - 1;
        const prompt = messages[priorUserIndex].text;
        const history = messages.slice(0, priorUserIndex);
        const visibleMessages = messages.slice(0, priorUserIndex + 1);
        await streamAssistantResponse(history, prompt, visibleMessages);
    };

    const retryError = async (message: UiChatMessage) => {
        if (isStreaming || !message.retryText) return;
        const errorIndex = messages.findIndex(item => item.id === message.id);
        const visibleMessages = messages.slice(0, errorIndex);
        const priorUserIndex = [...visibleMessages].reverse().findIndex(item => item.role === 'user');
        const historyEnd = priorUserIndex >= 0 ? visibleMessages.length - priorUserIndex - 1 : visibleMessages.length;
        await streamAssistantResponse(messages.slice(0, historyEnd), message.retryText, visibleMessages);
    };

    const copyMessage = async (text: string) => {
        await navigator.clipboard.writeText(text);
    };

    const handleClear = async () => {
        await clearMessages();
        setMessages([{ ...greeting, timestamp: Date.now() }]);
        setInput('');
    };

    const readImageFile = (file: File) => new Promise<{ dataUrl: string; base64: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result);
            resolve({ dataUrl, base64: dataUrl.split(',')[1] ?? dataUrl });
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || isStreaming || isAnalyzingImage) return;

        setIsAnalyzingImage(true);
        try {
            const { dataUrl, base64 } = await readImageFile(file);
            const userMessage: UiChatMessage = {
                id: createId(),
                role: 'user',
                text: `Uploaded image: ${file.name}`,
                timestamp: Date.now(),
                imagePreview: dataUrl,
            };
            setMessages(prev => [...prev, userMessage]);

            const diagnosis = await geminiService.analyzePlantImage(base64);
            setMessages(prev => [...prev, {
                id: createId(),
                role: 'model',
                text: formatDiagnosis(diagnosis),
                timestamp: Date.now(),
            }]);
        } catch (error) {
            const text = error instanceof Error ? error.message : 'Image analysis failed.';
            setMessages(prev => [...prev, {
                id: createId(),
                role: 'model',
                text: `Sorry, I could not analyze that image. ${text}`,
                timestamp: Date.now(),
                error: true,
            }]);
        } finally {
            setIsAnalyzingImage(false);
        }
    };

    const canShowSuggestions = messages.length <= 1;

    return (
        <div className="flex flex-col h-full bg-black pb-20">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-900 bg-black px-4 py-3">
                <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-neon-green">Cultivation CoPilot</p>
                    <p className="mt-1 text-xs text-gray-500">Model: {CHAT_MODEL_ID}</p>
                </div>
                <button
                    type="button"
                    onClick={handleClear}
                    className="rounded-full border border-neutral-800 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-neon-blue hover:text-neon-blue focus:outline-none focus:ring-2 focus:ring-neon-blue/60"
                >
                    Clear / New chat
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(message => {
                    const priorUserExists = messages.findIndex(item => item.id === message.id) > 0 && message.role === 'model' && messages.slice(0, messages.findIndex(item => item.id === message.id)).some(item => item.role === 'user');

                    return (
                        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[84%] rounded-2xl px-4 py-3 shadow-lg ${
                                message.role === 'user'
                                    ? 'border border-neon-green/20 bg-neon-green/10 text-neon-green'
                                    : message.error
                                        ? 'border border-red-500/30 bg-red-950/30 text-red-100'
                                        : 'border border-neutral-800 bg-neutral-900 text-gray-200'
                            }`}>
                                {message.imagePreview && (
                                    <img
                                        src={message.imagePreview}
                                        alt="Uploaded plant preview"
                                        className="mb-3 max-h-48 rounded-xl border border-neon-green/20 object-cover"
                                    />
                                )}

                                {message.isThinking && !message.text ? (
                                    <div className="flex h-6 items-center space-x-1" aria-label="Assistant is thinking">
                                        <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500" />
                                        <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500 delay-75" />
                                        <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500 delay-150" />
                                    </div>
                                ) : message.role === 'model' ? (
                                    <Markdown>{message.text}</Markdown>
                                ) : (
                                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</div>
                                )}

                                {message.role === 'model' && !message.isThinking && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-2">
                                        {!message.error && (
                                            <button
                                                type="button"
                                                onClick={() => copyMessage(message.text)}
                                                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-neon-blue focus:outline-none focus:ring-2 focus:ring-neon-blue/60"
                                                aria-label="Copy assistant message"
                                            >
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        )}
                                        {priorUserExists && !message.error && (
                                            <button
                                                type="button"
                                                onClick={() => regenerate(message.id)}
                                                disabled={isStreaming}
                                                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-neon-green focus:outline-none focus:ring-2 focus:ring-neon-green/60 disabled:opacity-50"
                                                aria-label="Regenerate assistant response"
                                            >
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 0019 8.5L20 10M19 5A9 9 0 005 15.5L4 14" />
                                                </svg>
                                            </button>
                                        )}
                                        {message.error && message.retryText && (
                                            <button
                                                type="button"
                                                onClick={() => retryError(message)}
                                                disabled={isStreaming}
                                                className="rounded-full border border-red-400/40 px-3 py-1 text-xs font-semibold text-red-100 transition-colors hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-400/60 disabled:opacity-50"
                                            >
                                                Retry
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>

            <div className="border-t border-neutral-900 bg-black p-4">
                {canShowSuggestions && (
                    <div className="mb-3 flex flex-wrap gap-2">
                        {suggestedPrompts.map(prompt => (
                            <button
                                key={prompt}
                                type="button"
                                onClick={() => {
                                    setInput(prompt);
                                    void sendPrompt(prompt);
                                }}
                                className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-xs text-gray-300 transition-colors hover:border-neon-green/60 hover:text-neon-green focus:outline-none focus:ring-2 focus:ring-neon-green/60"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-end gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-2 focus-within:border-neon-green/60">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isStreaming || isAnalyzingImage}
                        className="rounded-full p-3 text-gray-400 transition-colors hover:bg-white/5 hover:text-neon-blue focus:outline-none focus:ring-2 focus:ring-neon-blue/60 disabled:opacity-50"
                        aria-label="Upload plant image"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a4 4 0 00-5.657-5.657l-6.586 6.586a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                    </button>
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={event => setInput(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                void sendPrompt();
                            }
                        }}
                        placeholder={isAnalyzingImage ? 'Analyzing plant image...' : 'Ask CoPilot...'}
                        className="max-h-36 flex-1 resize-none bg-transparent px-2 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none"
                        disabled={isAnalyzingImage}
                    />
                    <button
                        type="button"
                        onClick={isStreaming ? stopStreaming : () => void sendPrompt()}
                        disabled={!isStreaming && !input.trim()}
                        className={`rounded-full p-3 font-bold transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 ${
                            isStreaming
                                ? 'bg-red-500 text-white hover:bg-red-400 focus:ring-red-400/60'
                                : 'bg-neon-green text-black hover:bg-green-400 focus:ring-neon-green/60'
                        }`}
                        aria-label={isStreaming ? 'Stop response' : 'Send message'}
                    >
                        {isStreaming ? (
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 6h12v12H6z" />
                            </svg>
                        ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};