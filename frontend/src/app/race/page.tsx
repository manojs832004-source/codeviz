'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, AlertCircle, Trophy, CheckCircle2 } from 'lucide-react';
import { ArrayVisualizer, ElementState, ArrayElement } from '@/components/ArrayVisualizer';
import { TreeVisualizer } from '@/components/TreeVisualizer';
import { LinkedListVisualizer } from '@/components/LinkedListVisualizer';
import { VariablesTable } from '@/components/VariablesTable';
import { inferDataStructure } from '@/utils/dsInference';

interface StackEntry { funcName?: string; localVars?: Record<string, any>; locals?: Record<string, any>; line?: number; }
interface HeapNode { type: string; value?: any; items?: any[]; fields?: Record<string, any>; pointsTo?: string; }
interface StateFrame { step: number; line: number; stack: StackEntry[]; heap: Record<string, HeapNode>; stdout: string; }

interface TraceData {
  frames: StateFrame[];
  code: string;
  language: string;
}

export default function RacePage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [trace1, setTrace1] = useState<TraceData | null>(null);
  const [trace2, setTrace2] = useState<TraceData | null>(null);
  
  // Shared Playback State
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const t1 = sessionStorage.getItem('algoViz_trace_1');
      const t2 = sessionStorage.getItem('algoViz_trace_2');
      if (t1) setTrace1(JSON.parse(t1));
      if (t2) setTrace2(JSON.parse(t2));
    } catch (e) {
      console.error('Failed to parse race traces');
    }
  }, []);

  const maxSteps = Math.max(trace1?.frames.length || 0, trace2?.frames.length || 0);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      if (playRef.current) clearInterval(playRef.current);
    } else {
      if (currentStep >= maxSteps - 1) return;
      setIsPlaying(true);
      playRef.current = setInterval(() => {
        setCurrentStep(s => {
          if (s >= maxSteps - 2) {
            clearInterval(playRef.current!);
            setIsPlaying(false);
          }
          return Math.min(s + 1, maxSteps - 1);
        });
      }, 800);
    }
  }, [isPlaying, maxSteps, currentStep]);

  useEffect(() => {
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, []);

  if (!mounted) return null;

  if (!trace1 || !trace2) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-slate-900">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold dark:text-zinc-100">Race Data Missing</h2>
        <button onClick={() => router.push('/')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg">Back to Editor</button>
      </div>
    );
  }

  const renderCompetitor = (trace: TraceData, name: string) => {
    const isFinished = currentStep >= trace.frames.length - 1;
    const effectiveStep = Math.min(currentStep, trace.frames.length - 1);
    const frame = trace.frames[effectiveStep];
    const prevFrame = effectiveStep > 0 ? trace.frames[effectiveStep - 1] : null;
    const codeLines = trace.code.split('\n');
    const currentLineStr = codeLines[frame.line - 1]?.trim() || '';

    const topFrame = frame.stack?.[frame.stack.length - 1];
    const vars: Record<string, any> = {};
    const rawVars = topFrame?.locals || topFrame?.localVars || {};
    for (const [k, v] of Object.entries(rawVars)) {
      if (v && typeof v === 'object' && (v as any).type === 'primitive') vars[k] = (v as any).value;
      else if (v && typeof v === 'object' && (v as any).type === 'reference') vars[k] = 'ref:' + (v as any).pointsTo;
      else vars[k] = v;
    }

    const arraysInfo: { name: string; items: any[] }[] = [];
    for (const [addr, node] of Object.entries(frame.heap || {})) {
      if (node.type === 'array' && node.items) arraysInfo.push({ name: 'array', items: node.items });
    }

    const dsInference = inferDataStructure(frame.heap, topFrame?.locals || topFrame?.localVars || {});
    
    // Arrays logic
    const normalizeArray = (rawArr: any[]) => rawArr.map(v => (v && typeof v === 'object' && v.type === 'primitive') ? v.value : (v && typeof v === 'object' && v.type === 'reference') ? v.pointsTo : v);
    
    let arrayVals: any[] = [];
    for (const key in frame.heap) {
      if (frame.heap[key].type === 'array' || Array.isArray(frame.heap[key].value)) {
        arrayVals = normalizeArray(frame.heap[key].value || frame.heap[key].items || []);
        break;
      }
    }
    if (arrayVals.length === 0) {
      const locals = frame.stack[0]?.locals || frame.stack[0]?.localVars || {};
      for (const key in locals) {
        if (locals[key]?.type === 'array' || Array.isArray(locals[key]?.value)) {
          arrayVals = normalizeArray(locals[key].value || []);
          break;
        }
      }
    }
    const commonIndexNames = ['i', 'j', 'k', 'idx', 'index', 'left', 'right', 'mid', 'low', 'high', 'start', 'end', 'curr', 'ptr', 'min_index', 'max_index', 'minIdx', 'maxIdx'];
    const bracketVars = new Set<string>();
    const bracketMatches = currentLineStr.match(/\[([a-zA-Z_]\w*)\]/g);
    if (bracketMatches) {
      bracketMatches.forEach(m => bracketVars.add(m.slice(1, -1)));
    }

    const activeIndices: number[] = [];
    const pointersByValue: Record<number, string[]> = {};
    Object.entries(vars).forEach(([key, v]) => {
      const numVal = Number(v);
      if (v !== '' && v !== null && !isNaN(numVal)) {
        if (commonIndexNames.includes(key) || bracketVars.has(key)) {
          if (!pointersByValue[numVal]) pointersByValue[numVal] = [];
          pointersByValue[numVal].push(key);
          activeIndices.push(numVal);
        }
      }
    });

    let comparingIndices: [number, number] | undefined;
    if (currentLineStr.includes('if') && (currentLineStr.includes('<') || currentLineStr.includes('>')) && activeIndices.length >= 2) {
      comparingIndices = [activeIndices[activeIndices.length - 2], activeIndices[activeIndices.length - 1]];
    }

    const iVal = typeof vars['i'] === 'number' ? vars['i'] : -1;
    const arrayElements: ArrayElement[] = arrayVals.map((val, idx) => ({
      value: val,
      state: comparingIndices?.includes(idx) ? 'comparing' : (iVal >= 0 && idx < iVal) ? 'sorted' : 'default'
    }));

    const isWinner = isFinished && currentStep < maxSteps - 1;

    return (
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden relative shadow-sm">
        <div className={`px-4 py-3 flex items-center justify-between border-b ${isFinished ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50' : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800'}`}>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-zinc-200">{name}</span>
            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">{trace.language}</span>
          </div>
          {isFinished ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {isWinner ? <Trophy className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {isWinner ? 'Winner!' : 'Finished'} ({trace.frames.length} steps)
            </div>
          ) : (
            <div className="text-xs font-bold text-slate-400">Step {effectiveStep + 1}</div>
          )}
        </div>
        
        <div className="px-4 py-2 border-b border-slate-100 dark:border-zinc-800/50 bg-slate-50 dark:bg-zinc-950/50 truncate">
          <code className={`font-mono text-xs ${isFinished ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
            {isFinished ? '// Execution completed' : currentLineStr || '—'}
          </code>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 relative">
          <VariablesTable vars={vars} className="absolute top-4 left-4 scale-75 origin-top-left" />
          {dsInference.type === 'binary_tree' ? <TreeVisualizer inference={dsInference} /> :
           dsInference.type === 'linked_list' ? <LinkedListVisualizer inference={dsInference} /> :
           arrayElements.length > 0 ? (
             <div className="scale-90 transform-gpu origin-top w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-700 px-2 py-8">
               <div className="min-w-max flex justify-center pb-4 pt-2">
                 <ArrayVisualizer steps={[{ id: frame.step, description: '', array: arrayElements }]} pointers={pointersByValue} activeIndices={activeIndices} variant="separated" />
               </div>
             </div>
           ) : <span className="text-sm text-slate-400 italic">No structure</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-zinc-300 relative">
      {/* Mesh Gradient Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden hidden dark:block z-0">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen" />
         <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[60%] bg-amber-600/15 rounded-full blur-[120px] mix-blend-screen" />
      </div>

      {/* Header */}
      <header className="relative z-20 h-16 flex items-center justify-between px-6 bg-white/70 dark:bg-[#0B0F19]/70 border-b border-slate-200 dark:border-white/5 shrink-0 backdrop-blur-xl">
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="w-4 h-4" /> Exit Race Mode
        </button>
        <div className="text-sm font-bold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-slate-800 dark:text-zinc-200">Algorithm Race</span>
        </div>
        <div className="w-24" />
      </header>

      {/* Race Area */}
      <div className="relative z-10 flex-1 flex gap-4 p-4 md:p-6 overflow-hidden">
        {renderCompetitor(trace1, "Algorithm 1")}
        {renderCompetitor(trace2, "Algorithm 2")}
      </div>

      {/* Scrubber */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl z-40 w-full max-w-2xl transition-all">
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => { setIsPlaying(false); setCurrentStep(s => Math.max(0, s - 1)); }}
            disabled={currentStep === 0}
            className="p-2.5 rounded-full text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-white/10 transition disabled:opacity-30"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          <button 
            onClick={handlePlayPause}
            className="w-14 h-14 flex items-center justify-center rounded-full bg-amber-600 text-white hover:bg-amber-500 shadow-lg shadow-amber-600/30 transition-all active:scale-95"
          >
            {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
          </button>
          <button 
            onClick={() => { setIsPlaying(false); setCurrentStep(s => Math.min(maxSteps - 1, s + 1)); }}
            disabled={currentStep === maxSteps - 1}
            className="p-2.5 rounded-full text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-white/10 transition disabled:opacity-30"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col group">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-zinc-500 mb-1.5 px-1 uppercase tracking-widest">
            <span>Race Timeline</span>
            <span>{Math.round((currentStep / (maxSteps - 1)) * 100)}%</span>
          </div>
          <input 
            type="range" 
            min={0} max={maxSteps - 1} 
            value={currentStep}
            onChange={(e) => { setIsPlaying(false); setCurrentStep(Number(e.target.value)); }}
            className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            style={{
              background: `linear-gradient(to right, #d97706 ${(currentStep / (maxSteps - 1)) * 100}%, transparent 0)`
            }}
          />
        </div>
      </div>
    </div>
  );
}
