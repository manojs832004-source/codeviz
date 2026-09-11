import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DSInferenceResult } from '../utils/dsInference';
import Xarrow from 'react-xarrows';

interface MapVisualizerProps {
  inference: DSInferenceResult;
  heap: Record<string, any>;
}

export function MapVisualizer({ inference, heap }: MapVisualizerProps) {
  // Extract key-value pairs
  const entries = useMemo(() => {
    if (!inference.rootId || !heap[inference.rootId]) return [];
    
    const rootNode = heap[inference.rootId];
    const results: { key: string, value: string, isRef: boolean, pointsTo?: string, keyId: string }[] = [];
    
    // Python dict
    if (rootNode.className === 'dict') {
      const fields = rootNode.fields || {};
      Object.entries(fields).forEach(([k, v]: [string, any], idx) => {
        if (v.type === 'primitive') {
          results.push({ key: k, value: String(v.value), isRef: false, keyId: `map-k-${idx}` });
        } else if (v.type === 'reference') {
          // Resolve reference value
          const target = heap[v.pointsTo];
          let displayVal = 'ref';
          if (target && target.type === 'primitive') displayVal = String(target.value);
          else if (target && target.className) displayVal = `${target.className}`;
          results.push({ key: k, value: displayVal, isRef: true, pointsTo: v.pointsTo, keyId: `map-k-${idx}` });
        }
      });
      return results;
    }

    // Java Map (HashMap, TreeMap, etc)
    const isJavaMap = rootNode.className?.includes('Map');
    if (isJavaMap) {
      // Find the 'table' array
      let tableRef = rootNode.fields?.table?.pointsTo;
      if (!tableRef) {
        // sometimes TreeMap doesn't have a table, it has a root node
        tableRef = rootNode.fields?.root?.pointsTo;
      }
      
      if (tableRef && heap[tableRef]) {
        const traverseNode = (nodeId: string) => {
          if (!nodeId || nodeId === 'null' || nodeId === '0') return;
          const node = heap[nodeId];
          if (!node || node.type !== 'object') return;
          
          const keyField = node.fields?.key;
          const valField = node.fields?.value;
          
          if (keyField) {
            // resolve key
            let keyStr = '?';
            if (keyField.type === 'primitive') keyStr = String(keyField.value);
            else if (keyField.type === 'reference' && heap[keyField.pointsTo]) {
               const kObj = heap[keyField.pointsTo];
               if (kObj.type === 'primitive') keyStr = String(kObj.value);
               else if (kObj.fields?.value) keyStr = String(kObj.fields.value.value);
               else keyStr = `ref:${keyField.pointsTo}`;
            }

            // resolve value
            let valStr = '?';
            let isRef = false;
            let pointsTo = undefined;
            if (valField?.type === 'primitive') valStr = String(valField.value);
            else if (valField?.type === 'reference') {
              const vObj = heap[valField.pointsTo];
              if (vObj && vObj.type === 'primitive') valStr = String(vObj.value);
              else if (vObj && vObj.fields?.value) valStr = String(vObj.fields.value.value); // wrapped Integer
              else {
                isRef = true;
                pointsTo = valField.pointsTo;
                valStr = vObj?.className || 'ref';
              }
            }

            results.push({ key: keyStr, value: valStr, isRef, pointsTo, keyId: `map-node-${nodeId}` });
          }

          // Traverse next (HashMap linked list)
          if (node.fields?.next?.pointsTo) {
             traverseNode(node.fields.next.pointsTo);
          }
          // Traverse left/right (TreeMap)
          if (node.fields?.left?.pointsTo) traverseNode(node.fields.left.pointsTo);
          if (node.fields?.right?.pointsTo) traverseNode(node.fields.right.pointsTo);
        };

        const tableObj = heap[tableRef];
        if (tableObj.type === 'array' && tableObj.value) {
          tableObj.value.forEach((element: any) => {
            if (element.type === 'reference') {
              traverseNode(element.pointsTo);
            }
          });
        } else {
          // Maybe it's directly a node (TreeMap)
          traverseNode(tableRef);
        }
      }
    }

    return results;
  }, [inference, heap]);

  const mapName = inference.rootId ? heap[inference.rootId]?.className || 'Dictionary' : 'Map';

  return (
    <div className="flex flex-col items-center justify-center p-8 w-full">
      <div className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden max-w-2xl w-full">
        <div className="bg-slate-100 dark:bg-zinc-900/50 px-4 py-3 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center">
          <h3 className="font-mono text-sm font-semibold text-slate-700 dark:text-zinc-200">{mapName}</h3>
          <span className="text-xs font-medium px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-md">Size: {entries.length}</span>
        </div>
        
        <div className="p-6 overflow-x-auto">
          {entries.length === 0 ? (
            <div className="text-center text-slate-400 italic py-8">Map is empty</div>
          ) : (
            <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-3 items-center">
              {/* Table Header */}
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">Key</div>
              <div className="w-6"></div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">Value</div>
              
              {/* Table Body */}
              <AnimatePresence>
                {entries.map((entry) => (
                  <React.Fragment key={entry.keyId}>
                    {/* Key */}
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="px-4 py-2 bg-slate-50 dark:bg-zinc-900/50 rounded-lg border border-slate-200 dark:border-zinc-700 font-mono text-sm text-indigo-600 dark:text-indigo-400 shadow-sm"
                    >
                      {entry.key}
                    </motion.div>
                    
                    {/* Arrow */}
                    <div className="flex justify-center text-slate-300 dark:text-zinc-600 font-mono">
                      →
                    </div>
                    
                    {/* Value */}
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      id={entry.isRef && entry.pointsTo ? `map-val-${entry.pointsTo}` : undefined}
                      className={`px-4 py-2 rounded-lg border font-mono text-sm shadow-sm ${
                        entry.isRef 
                          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 border-dashed'
                          : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200'
                      }`}
                    >
                      {entry.value}
                    </motion.div>

                    {/* Draw arrow if it's a reference pointing to another heap object */}
                    {entry.isRef && entry.pointsTo && heap[entry.pointsTo] && (
                      <Xarrow
                        start={`map-val-${entry.pointsTo}`}
                        end={`heap-${entry.pointsTo}`}
                        color="#f59e0b" // amber-500
                        strokeWidth={2}
                        path="smooth"
                        dashness={{ strokeLen: 4, nonStrokeLen: 4, animation: -1 }}
                        headSize={4}
                      />
                    )}
                  </React.Fragment>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
