'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ChatContext {
  line: number;
  currentLine: string;
  vars: Record<string, any>;
  arrays: { name: string; items: any[] }[];
  step?: number;
  explanation?: string;
  code?: string;
}

interface ChatPanelProps {
  context: ChatContext | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ context }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [localInput, setLocalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!localInput.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: localInput,
    };

    const allMessages = [...messages, userMessage];
    setMessages(allMessages);
    setLocalInput('');
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          data: { context },
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'text-delta' && parsed.delta) {
                fullText += parsed.delta;
                setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m));
              }
            } catch {
              if (dataStr !== '[DONE]') {
                fullText += dataStr;
                setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m));
              }
            }
          }
        }
      }

      if (!fullText) {
        setMessages(prev => prev.filter(m => m.id !== assistantId));
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: 'Sorry, something went wrong. Please try again.' } : m));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 shadow-sm w-80 shrink-0">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-indigo-50/50 dark:bg-indigo-900/10">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <h2 className="font-bold text-slate-800 dark:text-zinc-200">AI Tutor</h2>
        </div>
        {context && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 dark:text-indigo-400">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span>Watching Step {context.step ?? context.line} · Line {context.line}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 dark:text-zinc-500 p-4">
            <Sparkles className="w-10 h-10 mb-3 opacity-50 text-indigo-400" />
            <p className="text-sm">I am watching the execution with you. Ask me anything about this code or step!</p>
          </div>
        )}

        <AnimatePresence>
          {messages.map(m => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                {m.role === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </div>
              <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-tr-sm' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 rounded-tl-sm border border-indigo-100 dark:border-indigo-500/20 shadow-sm'}`}>
                {m.content || (m.role === 'assistant' && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce inline-block" />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce inline-block" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce inline-block" style={{ animationDelay: '300ms' }} />
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800">
        <form onSubmit={onSubmit} className="relative flex items-center">
          <input
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            placeholder={context ? `Ask about Line ${context.line}...` : "Ask a question..."}
            className="w-full pl-4 pr-12 py-3 bg-slate-100 dark:bg-zinc-800 border-none rounded-full text-sm text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !localInput.trim()} className="absolute right-2 p-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 disabled:bg-slate-300">
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
