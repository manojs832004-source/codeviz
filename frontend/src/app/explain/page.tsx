'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCompletion } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Code2, Database, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';

interface ExplainContext {
  line: number;
  currentLine: string;
  vars: Record<string, any>;
  arrays: { name: string; items: any[] }[];
}

export default function ExplainPage() {
  const router = useRouter();
  const [context, setContext] = useState<ExplainContext | null>(null);
  const [mounted, setMounted] = useState(false);
  const hasTriggered = useRef(false);

  const { completion, complete, isLoading, error } = useCompletion({ 
    api: '/api/explain',
    streamProtocol: 'text'
  });

  useEffect(() => {
    setMounted(true);
    const saved = sessionStorage.getItem('algoViz_explain_context');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ExplainContext;
        setContext(parsed);
      } catch (e) {
        console.error('Failed to parse explanation context');
      }
    }
  }, []);

  useEffect(() => {
    if (context && !hasTriggered.current) {
      hasTriggered.current = true;
      complete(JSON.stringify(context, null, 2));
    }
  }, [context, complete]);

  if (!mounted) return null;

  if (!context) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-slate-900 dark:text-zinc-100">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-zinc-800 text-center max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No Context Found</h2>
          <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6">
            We couldn't find the execution state to explain. Please return to the visualizer and try again.
          </p>
          <button 
            onClick={() => router.push('/')}
            className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Visualizer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col transition-colors duration-300">
      <header className="h-14 flex items-center justify-between px-6 bg-white/80 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 shrink-0 backdrop-blur-sm sticky top-0 z-10">
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Visualizer
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <h1 className="font-bold tracking-wide">AI Code Tutor</h1>
        </div>
        <div className="w-[120px]" /> {/* Spacer for balance */}
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Context Details */}
        <div className="lg:col-span-5 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Code2 className="w-4 h-4" /> Current Line (Line {context.line})
            </h2>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
              <pre className="font-mono text-sm text-indigo-600 dark:text-indigo-400 whitespace-pre-wrap">
                {context.currentLine || '—'}
              </pre>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Database className="w-4 h-4" /> State Snapshot
            </h2>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-6">
              
              {/* Variables */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2">Variables</h3>
                {Object.keys(context.vars).length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(context.vars).map(([name, val]) => (
                      <div key={name} className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-950 px-3 py-2 rounded-xl text-sm font-mono border border-slate-100 dark:border-zinc-800/50">
                        <span className="text-purple-600 dark:text-purple-400 font-semibold">{name}</span>
                        <span className="text-slate-400">=</span>
                        <span className="text-slate-700 dark:text-zinc-300 truncate">{JSON.stringify(val)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No variables in scope.</p>
                )}
              </div>

              {/* Arrays */}
              {context.arrays.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2">Arrays</h3>
                  <div className="space-y-3">
                    {context.arrays.map(arr => (
                      <div key={arr.name} className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-100 dark:border-zinc-800/50 overflow-x-auto">
                        <div className="text-xs font-mono font-bold text-indigo-500 mb-2">{arr.name}</div>
                        <div className="flex gap-1">
                          {arr.items.map((item, i) => (
                            <div key={i} className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md text-xs font-mono font-medium shadow-sm">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Explanation */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-[400px]">
          <h2 className="text-sm font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" /> Explanation
          </h2>
          
          <div className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col relative overflow-hidden">
            {/* Background decorative gradient */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            {isLoading && !completion && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-sm font-medium animate-pulse">Analyzing execution state...</p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold mb-1">Failed to generate explanation</p>
                  <p className="opacity-90">{error.message || "Please check your API key and connection."}</p>
                </div>
              </div>
            )}

            {(completion || (isLoading && completion)) && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="prose prose-slate dark:prose-invert prose-indigo max-w-none prose-p:leading-relaxed prose-pre:bg-slate-50 dark:prose-pre:bg-zinc-950 border-none"
              >
                <div className="text-lg md:text-xl font-medium text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {completion}
                </div>
              </motion.div>
            )}
            
            {!isLoading && completion && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 0.5 }}
                className="mt-auto pt-8 border-t border-slate-100 dark:border-zinc-800/50 flex justify-end relative z-10"
              >
                <button 
                  onClick={() => complete(JSON.stringify(context, null, 2))}
                  className="flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2 rounded-full"
                >
                  <Sparkles className="w-4 h-4" />
                  Regenerate
                </button>
              </motion.div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
