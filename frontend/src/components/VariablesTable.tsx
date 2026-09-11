import React from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

interface VariablesTableProps {
  vars: Record<string, any>;
  className?: string;
  tempValue?: any;
  swapPhase?: 1 | 2 | 3 | null;
}

export function VariablesTable({ vars, className, tempValue, swapPhase }: VariablesTableProps) {
  const entries = Object.entries(vars).filter(([k]) => !k.startsWith('__'));
  const dragControls = useDragControls();
  
  if (entries.length === 0) return null;

  const renderValue = (v: any) => {
    if (typeof v === 'boolean') {
      return <span className="text-orange-500 dark:text-orange-400">{v ? 'true' : 'false'}</span>;
    }
    if (typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)))) {
      return <span className="text-cyan-600 dark:text-cyan-400">{v}</span>;
    }
    if (typeof v === 'string') {
      if (v.startsWith('ref:')) {
        return <span className="text-purple-600 dark:text-purple-400 italic font-medium">{v}</span>;
      }
      return <span className="text-emerald-600 dark:text-emerald-400">"{v}"</span>;
    }
    return <span className="text-slate-600 dark:text-zinc-400">{String(v)}</span>;
  };

  return (
    <motion.div 
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className={`bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-2xl z-20 min-w-[220px] max-w-xs max-h-[60vh] resize overflow-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-700 ${className || 'absolute bottom-6 left-6'}`}
    >
      <h3 
        onPointerDown={(e) => dragControls.start(e)}
        style={{ touchAction: 'none' }}
        className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-4 sticky top-0 bg-transparent z-10 pb-2 cursor-grab active:cursor-grabbing flex justify-between items-center border-b border-slate-200 dark:border-white/5"
      >
        <span>Local Variables</span>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="opacity-50 pointer-events-none">
          <path d="M4 4h2v2H4V4zm0 4h2v2H4V8zm0 4h2v2H4v-2zm4-8h2v2H8V4zm0 4h2v2H8V8zm0 4h2v2H8v-2zm4-8h2v2h-2V4zm0 4h2v2h-2V8zm0 4h2v2h-2v-2z"/>
        </svg>
      </h3>
      <div className="space-y-2">
        <AnimatePresence>
          {entries.map(([k, v]) => {
            const isTemp = k === 'temp' && swapPhase != null;
            return (
              <motion.div 
                key={k}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`flex justify-between items-center gap-4 text-sm font-mono border-b border-slate-100 dark:border-zinc-800/50 pb-1.5 last:border-0 last:pb-0 rounded-lg px-1 transition-colors ${
                  isTemp ? 'bg-amber-50 dark:bg-amber-500/10' : ''
                }`}
              >
                <span className={`font-semibold truncate flex items-center gap-1.5 ${isTemp ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                  {isTemp && <span className="text-[11px]">📦</span>}
                  {k}
                </span>
                <span className={`px-2.5 py-1 rounded-md font-bold shadow-sm ${
                  isTemp
                    ? 'bg-amber-400 dark:bg-amber-500 text-white'
                    : 'text-slate-800 dark:text-zinc-200 bg-slate-100/50 dark:bg-black/30'
                }`}>
                  {renderValue(v)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
