'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrayVisualizer, ElementState, ArrayElement } from '@/components/ArrayVisualizer';
import { TreeVisualizer } from '@/components/TreeVisualizer';
import { LinkedListVisualizer } from '@/components/LinkedListVisualizer';
import { inferDataStructure } from '@/utils/dsInference';

interface StackEntry { funcName?: string; name?: string; localVars?: Record<string, any>; locals?: Record<string, any>; line?: number; }
interface HeapNode { type: string; value?: any; items?: any[]; fields?: Record<string, any>; pointsTo?: string; }
interface StateFrame { step: number; line: number; stack: StackEntry[]; heap: Record<string, HeapNode>; stdout: string; }

interface StepCardProps {
  frame: StateFrame;
  prevFrame: StateFrame | null;
  codeLines: string[];
}

export default function StepCard({ frame, prevFrame, codeLines }: StepCardProps) {
  const router = useRouter();
  const currentLine = codeLines[frame.line - 1]?.trim() || '';

  // Extract variables for AI context and display
  const topFrame = frame.stack?.[frame.stack.length - 1];
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

  // Extract array info for AI context
  const arraysInfo = useMemo(() => {
    const result: { name: string; items: any[] }[] = [];
    const heap = frame.heap || {};
    for (const [name, val] of Object.entries(vars)) {
      if (typeof val === 'string' && val.startsWith('ref:')) {
        const addr = val.slice(4);
        const node = heap[addr];
        if (node?.type === 'array' && node.items) {
          result.push({ name, items: node.items });
        }
      }
    }
    for (const [addr, node] of Object.entries(heap)) {
      if (node.type === 'array' && node.items && !result.find(r => r.name === 'array')) {
        result.push({ name: 'array', items: node.items });
      }
    }
    return result;
  }, [frame, vars]);

  const handleAskAI = () => {
    const context = {
      line: frame.line,
      currentLine,
      vars,
      arrays: arraysInfo
    };
    sessionStorage.setItem('algoViz_explain_context', JSON.stringify(context));
    router.push('/explain');
  };

  // Inference Engine
  const dsInference = useMemo(() => {
    const locals = frame.stack[0]?.locals || frame.stack[0]?.localVars || {};
    return inferDataStructure(frame.heap, locals);
  }, [frame]);

  const visualizerProps = useMemo(() => {
    const normalizeArray = (rawArr: any[]) => {
      return rawArr.map(v => (v && typeof v === 'object' && v.type === 'primitive') ? v.value : (v && typeof v === 'object' && v.type === 'reference') ? v.pointsTo : v);
    };

    let arrayVals: any[] = [];
    for (const key in frame.heap) {
      if (frame.heap[key].type === 'array' || Array.isArray(frame.heap[key].value)) {
        arrayVals = normalizeArray(frame.heap[key].value || []);
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

    const locals = frame.stack[0]?.locals || frame.stack[0]?.localVars || {};
    const pointersByValue: Record<number, string[]> = {};
    const activeIndices: number[] = [];
    
    Object.entries(locals).forEach(([key, v]: [string, any]) => {
      if (v && v.type === 'primitive' && !isNaN(Number(v.value))) {
        const val = Number(v.value);
        if (!pointersByValue[val]) pointersByValue[val] = [];
        pointersByValue[val].push(key);
        activeIndices.push(val);
      }
    });

    let comparingIndices: [number, number] | undefined;
    const isCompareStmt = currentLine.includes('if') && (currentLine.includes('<') || currentLine.includes('>') || currentLine.includes('=='));
    if (isCompareStmt && activeIndices.length >= 2) {
      comparingIndices = [activeIndices[activeIndices.length - 2], activeIndices[activeIndices.length - 1]];
    }

    const iVal = locals['i'] ? Number(locals['i'].value) : -1;
    let sortedBoundary: number | undefined;
    if (iVal >= 0) {
      sortedBoundary = iVal;
    }

    const arrayElements: ArrayElement[] = arrayVals.map((val, idx) => {
      let state: ElementState = 'default';
      if (comparingIndices && comparingIndices.includes(idx)) {
        state = 'comparing';
      } else if (sortedBoundary !== undefined && idx < sortedBoundary) {
        state = 'sorted';
      }
      return { value: val, state };
    });

    return {
      steps: [{ 
        id: frame.step, 
        description: swapIndices ? `Swapping elements at index ${swapIndices[0]} and ${swapIndices[1]}` : 
                     isCompareStmt ? `Comparing elements` : '',
        array: arrayElements 
      }],
      pointers: pointersByValue,
      activeIndices,
      swapIndices,
      comparingIndices,
      sortedBoundary
    };
  }, [frame, prevFrame, currentLine]);

  return (
    <div className="flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow h-full">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {frame.step}
          </div>
          <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Line {frame.line}</span>
        </div>
        <button 
          onClick={handleAskAI} 
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-colors"
        >
          <span>✨</span> Ask AI
        </button>
      </div>

      {/* Code Snippet */}
      <div className="px-4 py-2 border-b border-slate-100 dark:border-zinc-800/50 bg-slate-50 dark:bg-zinc-950/50 shrink-0">
        <code className="font-mono text-xs text-indigo-700 dark:text-indigo-300">
          {currentLine || '—'}
        </code>
      </div>

      {/* Dynamic Data Structure Visualization */}
      <div className="h-44 shrink-0 flex items-center justify-center border-b border-slate-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 overflow-hidden relative">
        {dsInference.type === 'binary_tree' ? (
          <TreeVisualizer inference={dsInference} />
        ) : dsInference.type === 'linked_list' ? (
          <LinkedListVisualizer inference={dsInference} />
        ) : visualizerProps.steps[0].array.length > 0 ? (
          <div className="scale-[0.65] transform-gpu origin-center">
            <ArrayVisualizer {...visualizerProps} variant="separated" />
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">No structure detected</span>
        )}
      </div>

      {/* Variables View */}
      <div className="flex-1 p-4 bg-slate-50/50 dark:bg-zinc-950/50 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-1.5">
          {Object.entries(vars)
            .filter(([_, v]) => typeof v !== 'string' || !String(v).startsWith('ref:'))
            .map(([name, val]) => (
              <div key={name} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-purple-600 dark:text-purple-400 font-semibold w-16 truncate">{name}</span>
                <span className="text-slate-400">=</span>
                <span className="text-slate-700 dark:text-zinc-300 font-bold">{JSON.stringify(val)}</span>
              </div>
            ))}
          {Object.keys(vars).filter(k => typeof vars[k] !== 'string' || !String(vars[k]).startsWith('ref:')).length === 0 && (
            <div className="text-xs text-slate-400 italic">No local primitives</div>
          )}

          {frame.stdout && (
            <div className="mt-4 pt-3 border-t border-slate-700/50">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Console Output</div>
              <pre className="text-xs text-emerald-400 font-mono bg-zinc-900 rounded-lg p-2.5 whitespace-pre-wrap max-h-24 overflow-y-auto border border-emerald-900/30 shadow-inner">
                {frame.stdout}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
