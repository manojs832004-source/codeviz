'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { ArrowLeft, Sun, Moon, Play, Pause, SkipBack, SkipForward, AlertCircle, Keyboard } from 'lucide-react';
import { ArrayVisualizer, ElementState, ArrayElement } from '@/components/ArrayVisualizer';
import { TreeVisualizer } from '@/components/TreeVisualizer';
import { LinkedListVisualizer } from '@/components/LinkedListVisualizer';
import { inferDataStructure } from '@/utils/dsInference';
import { ChatPanel, ChatContext } from '@/components/ChatPanel';
import { CallStackVisualizer } from '@/components/CallStackVisualizer';
import { Xwrapper } from 'react-xarrows';
import { Info } from 'lucide-react';
import { DivideAndConquerVisualizer } from '@/components/DivideAndConquerVisualizer';
import { GraphVisualizer } from '@/components/GraphVisualizer';
import { MapVisualizer } from '@/components/MapVisualizer';
import ImportVisualizer from '@/components/ImportVisualizer';

const CodeEditor = dynamic(() => import('@/components/CodeEditor'), { ssr: false });

interface StackEntry { funcName?: string; name?: string; localVars?: Record<string, any>; locals?: Record<string, any>; line?: number; }
interface HeapNode { type: string; value?: any; items?: any[]; fields?: Record<string, any>; pointsTo?: string; }
interface StateFrame { step: number; line: number; stack: StackEntry[]; heap: Record<string, HeapNode>; stdout: string; actionExplanation?: string; }

interface TraceData {
  frames: StateFrame[];
  code: string;
  language: string;
}

export default function VisualizePage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [traceData, setTraceData] = useState<TraceData | null>(null);
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [isExplaining, setIsExplaining] = useState(false);
  
  // Playback State
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playRef = useRef<NodeJS.Timeout | null>(null);
  
  const [aiExplanations, setAiExplanations] = useState<Record<number, string>>({});
  const [isGeneratingExplain, setIsGeneratingExplain] = useState(false);

  // Debounced fetch for dynamic AI explanations
  useEffect(() => {
    if (!traceData || !traceData.frames || !traceData.frames[currentStep]) return;
    
    // Skip if we already have it
    if (aiExplanations[currentStep]) return;
    
    // Debounce to avoid spamming backend during fast playback
    const timer = setTimeout(async () => {
      setIsGeneratingExplain(true);
      try {
        const frame = traceData.frames[currentStep];
        const prevFrame = currentStep > 0 ? traceData.frames[currentStep - 1] : frame;
        const displayLine = currentStep > 0 ? prevFrame.line : frame.line;
        
        const vars = frame.stack?.[0]?.locals || frame.stack?.[0]?.localVars || {};
        const codeLines = traceData.code.split('\n');
        const currentLine = displayLine && displayLine > 0 && displayLine <= codeLines.length 
          ? codeLines[displayLine - 1].trim() 
          : '';
          
        const res = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: {
              currentLine,
              vars,
              arrays: frame.heap
            }
          })
        });
        
        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let currentText = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Decode the chunk (Vercel's text stream format sometimes includes leading characters, we just take raw)
            const chunk = decoder.decode(value, { stream: true });
            currentText += chunk;
            
            // Update state incrementally so it animates like typing
            setAiExplanations(prev => ({ ...prev, [currentStep]: currentText }));
          }
        }
      } catch (err) {
        console.error("Failed to fetch AI explanation:", err);
      } finally {
        setIsGeneratingExplain(false);
      }
    }, isPlaying ? 800 : 300); // Wait longer if playing, fetch quickly if paused
    
    return () => clearTimeout(timer);
  }, [currentStep, isPlaying, traceData, aiExplanations]);

  useEffect(() => {
    setMounted(true);
    const saved = sessionStorage.getItem('algoViz_trace');
    if (saved) {
      try {
        setTraceData(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse trace data');
      }
    }
    const savedExp = sessionStorage.getItem('algoViz_explanations');
    if (savedExp) {
      try {
        setExplanations(JSON.parse(savedExp));
      } catch (e) {
        console.error('Failed to parse explanations');
      }
    } else if (saved) {
      // If we don't have explanations in sessionStorage, fetch them asynchronously
      try {
        const parsedTrace = JSON.parse(saved);
        setIsExplaining(true);
        fetch('/api/analyze-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: parsedTrace.code })
        })
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setExplanations(data);
            sessionStorage.setItem('algoViz_explanations', JSON.stringify(data));
          }
        })
        .catch(console.error)
        .finally(() => setIsExplaining(false));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      if (playRef.current) clearInterval(playRef.current);
    } else {
      if (!traceData || currentStep >= traceData.frames.length - 1) return;
      setIsPlaying(true);
      playRef.current = setInterval(() => {
        setCurrentStep(s => {
          if (s >= traceData.frames.length - 2) {
            clearInterval(playRef.current!);
            setIsPlaying(false);
          }
          return Math.min(s + 1, traceData.frames.length - 1);
        });
      }, 800 / playbackSpeed);
    }
  }, [isPlaying, traceData, currentStep, playbackSpeed]);

  useEffect(() => {
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, []);

  // ⌨️ Keyboard navigation: Left/Right arrows
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!traceData) return;
      // Don't capture keys when typing in an input/textarea
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') {
        setIsPlaying(false);
        if (playRef.current) clearInterval(playRef.current);
        setCurrentStep(s => Math.min(traceData.frames.length - 1, s + 1));
      } else if (e.key === 'ArrowLeft') {
        setIsPlaying(false);
        if (playRef.current) clearInterval(playRef.current);
        setCurrentStep(s => Math.max(0, s - 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        handlePlayPause();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [traceData, handlePlayPause]);

  if (!mounted) return null;

  if (!traceData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-slate-900 dark:text-zinc-100">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-zinc-800 text-center max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No Trace Found</h2>
          <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6">
            We couldn't find any execution data. Please return to the editor, write some code, and click Visualize.
          </p>
          <button 
            onClick={() => router.push('/')}
            className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Editor
          </button>
        </div>
      </div>
    );
  }

  const { frames, code, language } = traceData;
  const frame = frames[currentStep];
  const prevFrame = currentStep > 0 ? frames[currentStep - 1] : null;
  const displayLine = prevFrame ? prevFrame.line : frame.line;
  const codeLines = code.split('\n');
  const currentLineStr = codeLines[displayLine - 1]?.trim() || '';

  // Extract variables for AI context and display
  const topFrame = frame.stack?.[frame.stack.length - 1];
  const vars: Record<string, any> = {};
  const rawVars = topFrame?.locals || topFrame?.localVars || {};
  for (const [k, v] of Object.entries(rawVars)) {
    if (v && typeof v === 'object' && (v as any).type) {
      if ((v as any).type === 'primitive') vars[k] = (v as any).value;
      else if ((v as any).type === 'reference') vars[k] = 'ref:' + (v as any).pointsTo;
    } else {
      vars[k] = v;
    }
  }

  const prevTopFrame = prevFrame?.stack?.[prevFrame?.stack?.length - 1];
  const prevVars: Record<string, any> = {};
  const rawPrevVars = prevTopFrame?.locals || prevTopFrame?.localVars || {};
  for (const [k, v] of Object.entries(rawPrevVars)) {
    if (v && typeof v === 'object' && (v as any).type) {
      if ((v as any).type === 'primitive') prevVars[k] = (v as any).value;
      else if ((v as any).type === 'reference') prevVars[k] = 'ref:' + (v as any).pointsTo;
    } else {
      prevVars[k] = v;
    }
  }

  // Arrays Info
  const arraysInfo: { name: string; items: any[] }[] = [];
  const heap = frame.heap || {};
  for (const [name, val] of Object.entries(vars)) {
    if (typeof val === 'string' && val.startsWith('ref:')) {
      const addr = val.slice(4);
      const node = heap[addr];
      if (node?.type === 'array' && node.items) {
        arraysInfo.push({ name, items: node.items });
      }
    }
  }
  for (const [addr, node] of Object.entries(heap)) {
    if (node.type === 'array' && node.items && !arraysInfo.find(r => r.name === 'array')) {
      arraysInfo.push({ name: 'array', items: node.items });
    }
  }

  const chatContext: ChatContext = {
    step: currentStep + 1,
    line: displayLine,
    currentLine: currentLineStr,
    vars,
    arrays: arraysInfo,
    explanation: explanations[displayLine] || frame.actionExplanation,
    code,
  };

  // DS Inference
  const dsInference = inferDataStructure(frame.heap, topFrame?.locals || topFrame?.localVars || {});

  const isDeclarationLine = currentLineStr.startsWith('import ') || 
                            currentLineStr.startsWith('#include ') || 
                            currentLineStr.startsWith('from ') ||
                            currentLineStr.startsWith('class ') || 
                            currentLineStr.startsWith('public class ') ||
                            currentLineStr.startsWith('struct ') ||
                            currentLineStr.startsWith('interface ');

  // Array Visualizer Props Calculation
  const normalizeArray = (rawArr: any[]) => rawArr.map(v => (v && typeof v === 'object' && v.type === 'primitive') ? v.value : (v && typeof v === 'object' && v.type === 'reference') ? v.pointsTo : v);
  
  let arrayVals: any[] = [];
  let arrayHeapId = '';
  for (const key in frame.heap) {
    if (frame.heap[key].type === 'array' || Array.isArray(frame.heap[key].value)) {
      arrayVals = normalizeArray(frame.heap[key].value || frame.heap[key].items || []);
      arrayHeapId = key;
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

  let prevArrayVals: any[] = [];
  if (prevFrame) {
    for (const key in prevFrame.heap) {
      if (prevFrame.heap[key].type === 'array' || Array.isArray(prevFrame.heap[key].value)) {
        prevArrayVals = normalizeArray(prevFrame.heap[key].value || []);
        break;
      }
    }
    if (prevArrayVals.length === 0) {
      const pLocals = prevFrame.stack[0]?.locals || prevFrame.stack[0]?.localVars || {};
      for (const key in pLocals) {
        if (pLocals[key]?.type === 'array' || Array.isArray(pLocals[key]?.value)) {
          prevArrayVals = normalizeArray(pLocals[key].value || []);
          break;
        }
      }
    }
  }

  let swapIndices: [number, number] | undefined;
  if (prevArrayVals.length === arrayVals.length && arrayVals.length > 0) {
    const diffs: number[] = [];
    for (let k = 0; k < arrayVals.length; k++) {
      if (arrayVals[k] !== prevArrayVals[k]) diffs.push(k);
    }
    if (diffs.length === 2) {
      swapIndices = [diffs[0], diffs[1]];
    }
  }
  
  const commonIndexNames = ['i', 'j', 'k', 'idx', 'index', 'left', 'right', 'mid', 'low', 'high', 'start', 'end', 'curr', 'ptr', 'min_index', 'max_index', 'minIdx', 'maxIdx'];
  const bracketVars = new Set<string>();
  const bracketMatches = currentLineStr.match(/\[([a-zA-Z_]\w*)\]/g);
  if (bracketMatches) {
    bracketMatches.forEach(m => bracketVars.add(m.slice(1, -1)));
  }

  const pointersByValue: Record<number, string[]> = {};
  const activeIndices: number[] = [];
  Object.entries(vars).forEach(([key, v]) => {
    const numVal = Number(v);
    if (v !== '' && v !== null && typeof v !== 'boolean' && !isNaN(numVal) && Number.isInteger(numVal)) {
      // Allow any integer variable within array bounds to be shown as a pointer
      if (arrayVals.length > 0 && numVal >= 0 && numVal <= arrayVals.length) {
        if (!pointersByValue[numVal]) pointersByValue[numVal] = [];
        pointersByValue[numVal].push(key);
        activeIndices.push(numVal);
      }
    }
  });

  let isSwapLine = false;
  let activeSwapIndices: [number, number] | undefined;
  
  if (swapIndices && arrayVals[swapIndices[0]] === prevArrayVals[swapIndices[1]] && arrayVals[swapIndices[1]] === prevArrayVals[swapIndices[0]]) {
    // Pure 1-step swap (e.g. Python tuple unpacking)
    isSwapLine = true;
    activeSwapIndices = swapIndices;
  } else if (prevArrayVals.length === arrayVals.length && arrayVals.length > 0) {
    // Check for a 3-step swap modification (where elements changed)
    const diffs: number[] = [];
    for (let k = 0; k < arrayVals.length; k++) {
      if (arrayVals[k] !== prevArrayVals[k]) diffs.push(k);
    }
    if (diffs.length > 0) {
      isSwapLine = true;
      // Just highlight the changed elements during this step
      if (diffs.length === 2) activeSwapIndices = [diffs[0], diffs[1]];
      else if (diffs.length === 1 && activeIndices && activeIndices.length >= 2) {
         // Attempt to guess the other swap index based on active pointers
         const otherPointer = activeIndices.find(idx => idx !== diffs[0]);
         if (otherPointer !== undefined) {
             activeSwapIndices = [diffs[0], otherPointer];
         }
      }
    }
  }

  let swapPhase: 1 | 2 | 3 | null = null;
  const tempValue = vars['temp'] ?? vars['tmp'] ?? vars['t']; // Fallback for UI if available, but not used for logic
  const hasTempVar = tempValue !== undefined;

  let comparingIndices: [number, number] | undefined;
  // If no array modifications happened, but we have multiple active indices (pointers), they are likely being compared
  if (!isSwapLine && activeIndices.length >= 2) {
    comparingIndices = [activeIndices[activeIndices.length - 2], activeIndices[activeIndices.length - 1]];
  }

  // Rule-based explanation
  let ruleBasedExplanation = "Executing line...";
  if (isSwapLine) {
    ruleBasedExplanation = "Modifying array elements.";
  } else if (comparingIndices) {
    ruleBasedExplanation = `Comparing array elements or evaluating condition.`;
  } else {
    const changes = [];
    for (const key in vars) {
      if (typeof vars[key] !== 'string' || !String(vars[key]).startsWith('ref:')) {
        if (JSON.stringify(vars[key]) !== JSON.stringify(prevVars[key])) {
          changes.push(`${key} = ${JSON.stringify(vars[key])}`);
        }
      }
    }
    if (changes.length > 0) {
      ruleBasedExplanation = `Updated variables: ${changes.join(', ')}`;
    } else if (currentLineStr.includes('return')) {
      ruleBasedExplanation = "Returning from function.";
    } else if (currentLineStr.includes('def ') || currentLineStr.includes('class ')) {
      ruleBasedExplanation = "Defining function/class.";
    } else {
      ruleBasedExplanation = `Executing: ${currentLineStr.trim()}`;
    }
  }

  const iVal = typeof vars['i'] === 'number' ? vars['i'] : -1;
  const arrayElements: ArrayElement[] = arrayVals.map((val, idx) => {
    let state: ElementState = 'default';
    // Mid-swap: highlight the two swapping elements amber
    if (activeSwapIndices && (idx === activeSwapIndices[0] || idx === activeSwapIndices[1])) {
      state = 'comparing'; // reuse 'comparing' (amber) style for mid-swap
    } else if (comparingIndices?.includes(idx)) {
      state = 'comparing';
    } else if (iVal >= 0 && idx < iVal) {
      state = 'sorted';
    }
    return { value: val, state };
  });

  const visualizerProps = {
    steps: [{ id: frame.step, description: swapIndices ? 'Swapping elements' : comparingIndices ? 'Comparing elements' : '', array: arrayElements }],
    pointers: pointersByValue,
    activeIndices,
    swapIndices,
  };

  // Swap banner details
  const swapBannerMsg = swapPhase === 1
    ? `📦 Saving value ${tempValue} into temp`
    : swapPhase === 2
    ? `🔀 Overwriting arr[${activeSwapIndices?.[0]}] — array is mid-swap`
    : swapPhase === 3
    ? `✅ Restoring temp (${tempValue}) into arr[${activeSwapIndices?.[1]}] — swap complete`
    : null;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-zinc-300 transition-colors duration-300 relative">
      
      {/* Mesh Gradient Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden hidden dark:block z-0">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen" />
         <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[60%] bg-purple-600/15 rounded-full blur-[120px] mix-blend-screen" />
      </div>

      {/* Header */}
      <header className="relative z-20 h-16 flex items-center justify-between px-6 bg-white/70 dark:bg-[#0B0F19]/70 border-b border-slate-200 dark:border-white/5 shrink-0 backdrop-blur-xl">
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Exit Focus Mode
        </button>

        {/* Progress Bar in header */}
        <div className="flex-1 mx-8 flex flex-col gap-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Step {currentStep + 1} of {frames.length}</span>
            <span className="text-[10px] font-bold text-indigo-500">{Math.round(((currentStep + 1) / frames.length) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${((currentStep + 1) / frames.length) * 100}%`,
                background: `linear-gradient(to right, #6366f1, ${currentStep >= frames.length - 1 ? '#22c55e' : '#a855f7'})`
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Keyboard hint badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
            <Keyboard className="w-3 h-3" />
            <span>← →</span>
          </div>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800 transition flex items-center justify-center">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        
        {/* Left: Code Editor */}
        <div className="w-[30%] min-w-[300px] flex flex-col border-r border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-black/20 backdrop-blur-md relative z-10">
          <CodeEditor 
            code={code} 
            language={language}
            onChange={() => {}} 
            activeLine={displayLine}
          />
        </div>

        {/* Center: Visualizer Canvas */}
        <div className="flex-1 relative bg-transparent overflow-hidden flex flex-col">
          <Xwrapper>
            <CallStackVisualizer stack={frame.stack} />
            
            <div className={`flex-1 relative flex items-center justify-center p-8 border-4 border-dashed rounded-2xl transition-all duration-500 m-8 mb-48
              ${Object.keys(frame.heap || {}).length > Object.keys(prevFrame?.heap || {}).length 
                ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-[0_0_30px_rgba(99,102,241,0.2)]' 
                : 'border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30'}
            `}>
              {/* Heap Memory Header */}
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-white/90 dark:bg-zinc-800/90 rounded-md shadow-sm border border-slate-200 dark:border-zinc-700 z-10">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Heap Memory (Dynamic Storage)</span>
                <div className="group relative flex items-center">
                  <Info className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500 cursor-help transition-colors" />
                  <div className="absolute left-0 top-full mt-2 w-64 p-2 bg-slate-800 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    Flexible, long-term warehouse for storing large objects like Arrays, Trees, and Graphs. Stack variables point here.
                  </div>
                </div>
              </div>

              {isDeclarationLine ? (
                <ImportVisualizer lineContent={currentLineStr} />
              ) : dsInference.type === 'binary_tree' ? (
                <TreeVisualizer inference={dsInference} />
              ) : dsInference.type === 'graph' ? (
              <GraphVisualizer inference={dsInference} heap={frame.heap} vars={vars} prevHeap={prevFrame?.heap} />
            ) : dsInference.type === 'map' ? (
              <MapVisualizer inference={dsInference} heap={frame.heap} />
            ) : dsInference.type === 'divide_and_conquer' ? (
              <DivideAndConquerVisualizer arraysInfo={arraysInfo.map((a, i) => ({ ...a, id: `arr-${i}` }))} pointers={pointersByValue} />
            ) : dsInference.type === 'linked_list' ? (
              <LinkedListVisualizer inference={dsInference} />
            ) : visualizerProps.steps[0].array.length > 0 ? (
                <div className="scale-110 transform-gpu origin-top w-full max-w-4xl overflow-x-auto px-4 py-16 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-700">
                  <div className="min-w-max flex justify-center pb-8 pt-4">
                    <div id={`heap-${arrayHeapId}`}>
                      <ArrayVisualizer {...visualizerProps} variant="separated" />
                    </div>
                  </div>
                </div>
              ) : (
              <div className="text-slate-400 italic font-medium flex flex-col items-center">
                <span className="text-4xl mb-3 opacity-50">🔮</span>
                Waiting for data structures...
              </div>
            )}
          </div>
          </Xwrapper>

          {/* Swap Phase Banner — shown during 3-line swap */}
          {swapBannerMsg && activeSwapIndices && (
            <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-full px-4">
              <div className={`backdrop-blur-md border rounded-2xl px-4 py-3 shadow-xl flex items-center gap-4 ${
                swapPhase === 3
                  ? 'bg-green-50/95 dark:bg-green-900/30 border-green-300 dark:border-green-500/30'
                  : 'bg-amber-50/95 dark:bg-amber-900/30 border-amber-300 dark:border-amber-500/30'
              }`}>
                {/* Phase steps */}
                <div className="flex items-center gap-2 shrink-0">
                  {[1,2,3].map(p => (
                    <div key={p} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      swapPhase === p
                        ? 'bg-amber-500 border-amber-500 text-white scale-110'
                        : (swapPhase ?? 0) > p
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white dark:bg-zinc-800 border-slate-300 dark:border-zinc-600 text-slate-400'
                    }`}>{p}</div>
                  ))}
                  <div className="w-px h-6 bg-slate-300 dark:bg-zinc-600 mx-1" />
                </div>

                {/* Message */}
                <p className={`text-sm font-semibold flex-1 ${swapPhase === 3 ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                  {swapBannerMsg}
                </p>

                {/* Temp box — always visible during swap */}
                {hasTempVar && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">temp</span>
                      <div className="px-3 py-1.5 bg-amber-400 dark:bg-amber-500 text-white font-bold text-sm rounded-lg shadow-md border-2 border-amber-500 dark:border-amber-400 min-w-[40px] text-center">
                        {tempValue ?? '?'}
                      </div>
                    </div>
                    <div className="text-slate-400 text-lg">→</div>
                    <div className="flex gap-1.5">
                      {activeSwapIndices.map((idx, pos) => (
                        <div key={pos} className="flex flex-col items-center">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">arr[{idx}]</span>
                          <div className={`px-3 py-1.5 font-bold text-sm rounded-lg border-2 min-w-[40px] text-center ${
                            swapPhase === 3 && pos === 1
                              ? 'bg-green-400 dark:bg-green-600 text-white border-green-500'
                              : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-amber-400 dark:border-amber-500'
                          }`}>
                            {arrayVals[idx] ?? '?'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step Explanation Banner */}
          {!swapBannerMsg && (
            <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-30 max-w-xl w-full px-4">
              <div className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md border border-indigo-200 dark:border-indigo-500/20 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-lg transition-all duration-300">
                <span className="text-indigo-500 mt-0.5 shrink-0 animate-pulse">🤖</span>
                <p className="text-sm text-slate-700 dark:text-zinc-200 leading-relaxed font-medium">
                  {aiExplanations[currentStep] ? (
                    aiExplanations[currentStep]
                  ) : isGeneratingExplain ? (
                    <span className="text-indigo-400 animate-pulse">AI is analyzing this step...</span>
                  ) : (
                    ruleBasedExplanation
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Scrubber / Playback Controls */}
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
                className="w-14 h-14 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
              >
                {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
              </button>
              <button 
                onClick={() => { setIsPlaying(false); setCurrentStep(s => Math.min(frames.length - 1, s + 1)); }}
                disabled={currentStep === frames.length - 1}
                className="p-2.5 rounded-full text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-white/10 transition disabled:opacity-30"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col group">
              <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-zinc-500 mb-1.5 px-1 uppercase tracking-widest">
                <span>Timeline</span>
                <span>{Math.round((currentStep / (frames.length - 1)) * 100)}%</span>
              </div>
              <input 
                type="range" 
                min={0} 
                max={frames.length - 1} 
                value={currentStep}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentStep(Number(e.target.value));
                }}
                className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                style={{
                  background: `linear-gradient(to right, #6366f1 ${(currentStep / (frames.length - 1)) * 100}%, transparent 0)`
                }}
              />
            </div>
            
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <select
                value={playbackSpeed}
                onChange={(e) => {
                  setPlaybackSpeed(Number(e.target.value));
                  if (isPlaying) {
                    setIsPlaying(false); // pause to let them re-play with new speed easily, or we could handle dynamic interval update
                  }
                }}
                className="bg-transparent border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold text-xs rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={0.5}>0.5x Speed</option>
                <option value={1}>1.0x Speed</option>
                <option value={1.5}>1.5x Speed</option>
                <option value={2}>2.0x Speed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right: AI Tutor Panel */}
        <ChatPanel context={chatContext} />

      </div>
    </div>
  );
}
