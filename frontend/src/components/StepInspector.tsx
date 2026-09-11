'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
interface StackEntry { funcName: string; locals?: Record<string, any>; localVars?: Record<string, any>; line: number; }
interface HeapNode { type: string; value?: any; items?: any[]; fields?: Record<string, any>; pointsTo?: string; }
interface StateFrame { step: number; line: number; stack: StackEntry[]; heap: Record<string, HeapNode>; stdout: string; }

interface StepInspectorProps {
  frame: StateFrame;
  prevFrame: StateFrame | null;
  code: string;
  totalSteps: number;
}

const INDEX_NAMES = new Set([
  'i','j','k','l','m','n','left','right','mid','lo','hi',
  'start','end','low','high','min_index','max_index','minIdx','maxIdx',
  'pivot','p','q','r','idx','index','pos','temp_idx','gap',
  'min_idx','max_idx','first','last','begin','top','bottom',
]);

export default function StepInspector({ frame, prevFrame, code, totalSteps }: StepInspectorProps) {
  const codeLines = useMemo(() => code.split('\n'), [code]);
  const currentLine = codeLines[frame.line - 1]?.trim() || '';

  const router = useRouter();
  
  const handleAskAI = () => {
    const context = { 
      line: frame.line, 
      currentLine, 
      vars, 
      arrays: arrays.map(a => ({ name: a.name, items: a.items })) 
    };
    sessionStorage.setItem('algoViz_explain_context', JSON.stringify(context));
    router.push('/explain');
  };

  const topFrame = frame.stack?.[frame.stack.length - 1];
  const prevTopFrame = prevFrame?.stack?.[prevFrame?.stack?.length - 1];
  
  // Parse variables into simple key-value pairs
  const vars = useMemo(() => {
    const rawVars = topFrame?.locals || topFrame?.localVars || {};
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawVars)) {
      if (v && typeof v === 'object' && v.type) {
        if (v.type === 'primitive') result[k] = v.value;
        else if (v.type === 'reference') result[k] = 'ref:' + v.pointsTo;
      } else {
        result[k] = v;
      }
    }
    return result;
  }, [topFrame]);

  const prevVars = useMemo(() => {
    const rawVars = prevTopFrame?.locals || prevTopFrame?.localVars || {};
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawVars)) {
      if (v && typeof v === 'object' && v.type) {
        if (v.type === 'primitive') result[k] = v.value;
        else if (v.type === 'reference') result[k] = 'ref:' + v.pointsTo;
      } else {
        result[k] = v;
      }
    }
    return result;
  }, [prevTopFrame]);

  const arrays = useMemo(() => {
    const result: { addr: string; name: string; items: any[]; prevItems?: any[] }[] = [];
    const heap = frame.heap || {};
    const prevHeap = prevFrame?.heap || {};

    for (const [name, val] of Object.entries(vars)) {
      if (typeof val === 'string' && val.startsWith('ref:')) {
        const addr = val.slice(4);
        const node = heap[addr];
        if (node?.type === 'array' && node.items) {
          const prevNode = prevHeap[addr];
          result.push({ addr, name, items: node.items, prevItems: prevNode?.items });
        }
      }
    }

    for (const [addr, node] of Object.entries(heap)) {
      if (node.type === 'array' && node.items && !result.find(r => r.addr === addr)) {
        const prevNode = prevHeap[addr];
        result.push({ addr, name: 'array', items: node.items, prevItems: prevNode?.items });
      }
    }
    return result;
  }, [frame, prevFrame, vars]);

  const objects = useMemo(() => {
    const result: { addr: string; name: string; fields: Record<string, any>; type: string }[] = [];
    const heap = frame.heap || {};
    for (const [addr, node] of Object.entries(heap)) {
      if (node.type === 'object' && node.fields) {
        let name = 'object';
        for (const [vName, val] of Object.entries(vars)) {
          if (typeof val === 'string' && val === 'ref:' + addr) { name = vName; break; }
        }
        result.push({ addr, name, fields: node.fields, type: node.type });
      }
    }
    return result;
  }, [frame, vars]);

  const changedVars = useMemo(() => {
    const changed = new Set<string>();
    for (const [name, val] of Object.entries(vars)) {
      if (JSON.stringify(val) !== JSON.stringify(prevVars[name])) {
        changed.add(name);
      }
    }
    return changed;
  }, [vars, prevVars]);

  const arrayChanges = useMemo(() => {
    const changes: { arrayName: string; changedIndices: number[]; swapPair?: [number, number] }[] = [];
    for (const arr of arrays) {
      if (!arr.prevItems) continue;
      const changedIndices: number[] = [];
      for (let idx = 0; idx < arr.items.length; idx++) {
        if (arr.items[idx] !== arr.prevItems[idx]) changedIndices.push(idx);
      }
      let swapPair: [number, number] | undefined;
      if (changedIndices.length === 2) {
        const [a, b] = changedIndices;
        if (arr.items[a] === arr.prevItems[b] && arr.items[b] === arr.prevItems[a]) {
          swapPair = [a, b];
        }
      }
      if (changedIndices.length > 0) {
        changes.push({ arrayName: arr.name, changedIndices, swapPair });
      }
    }
    return changes;
  }, [arrays]);

  const pointers = useMemo(() => {
    const ptrs: { name: string; value: number }[] = [];
    if (arrays.length === 0) return ptrs;
    const maxLen = Math.max(...arrays.map(a => a.items.length));
    for (const [name, val] of Object.entries(vars)) {
      if (typeof val === 'number' && Number.isInteger(val) && val >= 0 && val < maxLen) {
        if (INDEX_NAMES.has(name) || name.includes('idx') || name.includes('index') || name.includes('Index')) {
          ptrs.push({ name, value: val });
        }
      }
    }
    return ptrs;
  }, [vars, arrays]);

  const explanation = useMemo(() => {
    const parts: string[] = [];
    const varChanges = Array.from(changedVars)
      .filter(n => !n.startsWith('ref:') && typeof vars[n] !== 'string' || !String(vars[n]).startsWith('ref:'));
    if (varChanges.length > 0) {
      for (const name of varChanges) {
        if (prevVars[name] !== undefined) {
          parts.push(name + ' changed from ' + JSON.stringify(prevVars[name]) + ' to ' + JSON.stringify(vars[name]));
        } else {
          parts.push(name + ' = ' + JSON.stringify(vars[name]));
        }
      }
    }
    for (const change of arrayChanges) {
      if (change.swapPair) {
        const [a, b] = change.swapPair;
        const arr = arrays.find(x => x.name === change.arrayName);
        if (arr) parts.push('Swapped ' + change.arrayName + '[' + a + ']=' + arr.prevItems![a] + ' ↔ ' + change.arrayName + '[' + b + ']=' + arr.prevItems![b]);
      } else if (change.changedIndices.length > 0) {
        parts.push(change.arrayName + ' modified at index ' + change.changedIndices.join(', '));
      }
    }
    return parts;
  }, [changedVars, arrayChanges, vars, prevVars, arrays]);

  const comparisonInfo = useMemo(() => {
    const line = currentLine;
    if (line.includes('if ') || line.includes('while ')) {
      const match = line.match(/(if|while)\s*[\(]?(.+?)[\)]?\s*[:{]/);
      if (match) return match[2].trim();
      const idx = line.indexOf('if ') >= 0 ? line.indexOf('if ') + 3 : line.indexOf('while ') + 6;
      return line.slice(idx).replace(/[:{()]/g, '').trim();
    }
    return null;
  }, [currentLine]);

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-transparent backdrop-blur-sm" style={{ scrollbarWidth: 'thin' }}>
      <div className="px-4 py-3 border-b border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 dark:bg-indigo-500/20 shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center justify-center text-white dark:text-indigo-400 text-xs font-bold border border-indigo-500/30">
            {frame.step}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Execution Step</div>
            <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">Line {frame.line}</div>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold px-2 py-1 bg-slate-100 dark:bg-white/5 rounded-md">{frame.step} / {totalSteps}</div>
      </div>

      <div className="px-4 py-3 border-b border-slate-200/50 dark:border-white/5 shrink-0 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
        <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2 flex items-center justify-between">
          <span>Current Line</span>
          <button 
            onClick={handleAskAI} 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold transition-colors tracking-normal border border-indigo-500/20 shadow-sm"
          >
            <span className="text-xs">✨</span>
            Ask AI Tutor
          </button>
        </div>
        <div className="bg-slate-100 dark:bg-black/30 rounded-lg px-3 py-2 font-mono text-xs text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-white/5 shadow-inner flex items-center">
          <span className="text-slate-400 dark:text-zinc-600 mr-3 border-r border-slate-200 dark:border-zinc-700 pr-3">{frame.line}</span>
          <span>{currentLine || '—'}</span>
        </div>
      </div>

      {comparisonInfo && (
        <div className="px-4 py-2.5 border-b border-slate-200/50 dark:border-zinc-800/50 shrink-0">
          <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Condition Check</div>
          <div className="bg-amber-50 dark:bg-zinc-800/40 rounded-lg px-3 py-2 font-mono text-xs text-amber-700 dark:text-amber-300 border-l-3 border-amber-500" style={{ borderLeftWidth: '3px' }}>
            {comparisonInfo}
          </div>
        </div>
      )}

      <div className="px-4 py-3 border-b border-slate-200/50 dark:border-white/5 shrink-0">
        <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Variables</div>
        <div className="space-y-1">
          {Object.entries(vars)
            .filter(([_, v]) => typeof v !== 'string' || !String(v).startsWith('ref:'))
            .map(([name, val]) => {
              const changed = changedVars.has(name);
              return (
                <motion.div
                  key={name}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono shadow-sm ${
                    changed ? 'bg-amber-100/50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20' : 'bg-white dark:bg-black/30 border border-slate-200 dark:border-white/5'
                  }`}
                  animate={changed ? { scale: [1, 1.02, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <span className="text-purple-600 dark:text-purple-400 font-semibold w-24 shrink-0 truncate">{name}</span>
                  <span className="text-slate-400 dark:text-zinc-600">=</span>
                  <span className={`${changed ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-slate-700 dark:text-zinc-300'}`}>
                    {JSON.stringify(val)}
                  </span>
                  {changed && prevVars[name] !== undefined && (
                    <span className="text-slate-400 dark:text-zinc-600 text-[10px] ml-auto bg-black/5 dark:bg-black/20 px-1.5 py-0.5 rounded">
                      was {JSON.stringify(prevVars[name])}
                    </span>
                  )}
                </motion.div>
              );
            })}
          {Object.keys(vars).filter(k => typeof vars[k] !== 'string' || !String(vars[k]).startsWith('ref:')).length === 0 && (
            <div className="text-xs text-slate-400 dark:text-zinc-600 italic py-2">No variables in scope</div>
          )}
        </div>
      </div>

      {arrays.map((arr) => {
        const change = arrayChanges.find(c => c.arrayName === arr.name);
        return (
          <div key={arr.addr} className="px-4 py-3 border-b border-slate-200/50 dark:border-zinc-800/50">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{arr.name}</div>
              <div className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-mono">
                len={arr.items.length}
              </div>
              {change?.swapPair && (
                <div className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold ml-auto">
                  ⇄ SWAP
                </div>
              )}
            </div>

            {pointers.length > 0 && (
              <div className="flex gap-1 mb-1 justify-center">
                {arr.items.map((_: any, idx: number) => {
                  const ptrsHere = pointers.filter(p => p.value === idx);
                  return (
                    <div key={idx} className="flex flex-col items-center" style={{ width: '48px' }}>
                      {ptrsHere.length > 0 ? (
                        <>
                          <div className="flex gap-0.5 flex-wrap justify-center">
                            {ptrsHere.map(p => (
                              <span key={p.name} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300 font-mono">
                                {p.name}
                              </span>
                            ))}
                          </div>
                          <span className="text-indigo-400 text-xs leading-none">↓</span>
                        </>
                      ) : (
                        <div style={{ height: '24px' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-1 justify-center flex-wrap">
              <AnimatePresence>
                {arr.items.map((item: any, idx: number) => {
                  const isChanged = change?.changedIndices.includes(idx);
                  const isSwap = change?.swapPair?.includes(idx);
                  const hasPointer = pointers.some(p => p.value === idx);

                  let boxClass = 'bg-blue-500/10 border-blue-500/30 text-blue-300';
                  if (isSwap) boxClass = 'bg-amber-500/15 border-amber-400/50 text-amber-300 border-dashed';
                  else if (isChanged) boxClass = 'bg-red-500/15 border-red-400/50 text-red-300 border-dashed';
                  else if (hasPointer) boxClass = 'bg-purple-500/10 border-purple-400/40 text-purple-300';

                  return (
                    <motion.div
                      key={idx}
                      className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg border-2 font-mono text-sm font-bold ${boxClass}`}
                      animate={isChanged ? { scale: [1, 1.15, 1] } : {}}
                      transition={{ duration: 0.3, type: 'spring' }}
                    >
                      <span>{typeof item === 'object' ? '…' : item}</span>
                      <span className="text-[8px] text-slate-400 dark:text-zinc-600 font-normal">[{idx}]</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {change?.swapPair && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-[10px] font-mono text-amber-400">
                  [{change.swapPair[0]}]={arr.prevItems?.[change.swapPair[0]]}
                </span>
                <span className="text-amber-500 font-bold">⇄</span>
                <span className="text-[10px] font-mono text-amber-400">
                  [{change.swapPair[1]}]={arr.prevItems?.[change.swapPair[1]]}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {objects.map(obj => (
        <div key={obj.addr} className="px-4 py-3 border-b border-slate-200/50 dark:border-zinc-800/50">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{obj.name}</div>
            <div className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono">object</div>
          </div>
          <div className="space-y-1">
            {Object.entries(obj.fields).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-zinc-800/30 text-xs font-mono">
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold">.{key}</span>
                <span className="text-slate-400 dark:text-zinc-600">=</span>
                <span className="text-slate-700 dark:text-zinc-300">{JSON.stringify(val)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {explanation.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-200/50 dark:border-zinc-800/50 shrink-0">
          <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">What Happened</div>
          <div className="space-y-1">
            {explanation.map((text, i) => (
              <div key={i} className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">›</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-3 shrink-0">
        <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Call Stack</div>
        <div className="space-y-1">
          {(frame.stack || []).map((entry, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-zinc-800/30 text-xs">
              <span className="text-indigo-600 dark:text-indigo-400 font-mono font-semibold">{entry.funcName || 'main'}()</span>
              <span className="text-slate-500 dark:text-zinc-600 ml-auto font-mono">:{entry.line || frame.line}</span>
            </div>
          ))}
        </div>
      </div>

      {frame.stdout && (
        <div className="px-4 py-3 border-t border-slate-200/50 dark:border-zinc-800/50 shrink-0">
          <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Program Output</div>
          <pre className="text-xs text-emerald-700 dark:text-emerald-400 font-mono bg-slate-100 dark:bg-zinc-800/40 rounded-lg p-2.5 whitespace-pre-wrap">{frame.stdout}</pre>
        </div>
      )}
    </div>
  );
}
