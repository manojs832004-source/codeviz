'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Xarrow from 'react-xarrows';
import { Info } from 'lucide-react';

interface StackEntry {
  funcName?: string;
  line?: number;
  locals?: Record<string, any>;
  localVars?: Record<string, any>;
}

interface CallStackVisualizerProps {
  stack: StackEntry[];
}

export const CallStackVisualizer: React.FC<CallStackVisualizerProps> = ({ stack }) => {
  if (!stack || stack.length === 0) return null;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-50">
      <div className="flex items-center gap-2 px-3 py-1 bg-white/90 dark:bg-zinc-800/90 rounded-md shadow-sm border border-slate-200 dark:border-zinc-700">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Stack Memory</span>
        <div className="group relative flex items-center">
          <Info className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500 cursor-help transition-colors" />
          <div className="absolute right-0 top-full mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            Fast, temporary memory for function calls and primitive values (numbers, booleans). References point to the Heap.
          </div>
        </div>
      </div>
      
      <div className="flex flex-col-reverse items-end gap-2 w-48 relative">
      <AnimatePresence mode="popLayout">
        {stack.map((frame, index) => (
          <motion.div
            key={`${frame.funcName}-${index}`}
            layout
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`
              flex flex-col rounded-lg border shadow-lg backdrop-blur-md px-4 py-2 w-48
              ${index === stack.length - 1 
                ? 'bg-indigo-600/90 border-indigo-500 text-white shadow-indigo-500/20' 
                : 'bg-white/80 dark:bg-zinc-900/80 border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 opacity-70 scale-95'}
            `}
            style={{ 
              zIndex: stack.length - index,
              transformOrigin: 'right center'
            }}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold truncate">
                {frame.funcName || 'main'}()
              </span>
              {index === stack.length - 1 && (
                <span className="text-[10px] uppercase tracking-wider font-bold opacity-80">
                  Active
                </span>
              )}
            </div>
            {frame.line && (
              <span className={`text-xs font-mono mt-1 ${index === stack.length - 1 ? 'text-indigo-200' : 'text-slate-500 dark:text-zinc-400'}`}>
                Line {frame.line}
              </span>
            )}
            
            {/* Display local variables */}
            {(() => {
              const locals = frame.locals || frame.localVars;
              if (!locals || Object.keys(locals).length === 0) return null;
              
              const varsToDisplay = Object.entries(locals)
                .map(([k, v]) => {
                  let valStr = JSON.stringify(v);
                  let isRef = false;
                  let refId = '';
                  
                  if (typeof v === 'string' && v.startsWith('ref:')) {
                    isRef = true;
                    refId = v.slice(4);
                    valStr = 'ref';
                  } else if (v && typeof v === 'object' && (v as any).type) {
                    if ((v as any).type === 'primitive') valStr = JSON.stringify((v as any).value);
                    else if ((v as any).type === 'reference') {
                      isRef = true;
                      refId = (v as any).pointsTo;
                      valStr = 'ref';
                    }
                  }
                  return { key: k, value: valStr, isRef, refId };
                });
              
              if (varsToDisplay.length === 0) return null;
              
              return (
                <div className={`mt-2 pt-2 border-t ${index === stack.length - 1 ? 'border-indigo-400/50' : 'border-slate-200 dark:border-zinc-700'} flex flex-col gap-1`}>
                  {varsToDisplay.map(({key, value, isRef, refId}) => {
                    const stackVarId = `stack-var-${frame.funcName}-${index}-${key}`;
                    return (
                      <div key={key} className="flex justify-between items-center text-[10px] font-mono">
                        <span className={index === stack.length - 1 ? 'text-indigo-200' : 'text-slate-500 dark:text-zinc-400'}>{key}:</span>
                        <span 
                          id={stackVarId}
                          className={`font-bold ${index === stack.length - 1 ? 'text-white' : 'text-slate-700 dark:text-zinc-300'} truncate ml-2 max-w-[100px] ${isRef ? 'px-1 bg-indigo-500/20 rounded text-indigo-400' : ''}`}
                        >
                          {value}
                        </span>
                        
                        {mounted && isRef && refId && typeof document !== 'undefined' && document.getElementById(`heap-${refId}`) && (
                          <Xarrow
                            start={stackVarId}
                            end={`heap-${refId}`}
                            color={index === stack.length - 1 ? "#818cf8" : "#94a3b8"} // indigo-400 or slate-400
                            strokeWidth={2}
                            path="smooth"
                            headSize={4}
                            dashness={{ strokeLen: 4, nonStrokeLen: 4, animation: index === stack.length - 1 ? -1 : 0 }}
                            showTail={true}
                            tailShape="circle"
                            tailSize={3}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </motion.div>
        ))}
      </AnimatePresence>
      </div>
    </div>
  );
};
