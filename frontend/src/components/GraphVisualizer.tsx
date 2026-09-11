'use client';

import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, Edge, Node, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { DSInferenceResult } from '@/utils/dsInference';

interface GraphVisualizerProps {
  inference: DSInferenceResult;
  heap: Record<string, any>;
  vars: Record<string, any>;
  prevHeap?: Record<string, any>;
}

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  // Using circle layout is better for general graphs, but dagre works fine as a fallback
  dagreGraph.setGraph({ rankdir: 'LR' }); // Left to Right

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 60, height: 60 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - 30,
      y: nodeWithPosition.y - 30,
    };
    return node;
  });

  return { nodes, edges };
};

export const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ inference, heap, vars, prevHeap }) => {
  // Extract adjacency matrix if present
  const matrixInfo = useMemo(() => {
    // Find a 2D array in heap
    let matrix: any[][] | null = null;
    let matrixName = '';
    
    // First check variables for a 2D array
    for (const [vName, vVal] of Object.entries(vars)) {
      if (typeof vVal === 'string' && vVal.startsWith('ref:')) {
        const arrNode = heap[vVal.slice(4)];
        if (arrNode?.type === 'array' && arrNode.items && arrNode.items.length > 0) {
          const firstItem = arrNode.items[0];
          if (firstItem && typeof firstItem === 'object' && firstItem.type === 'reference') {
            // It's an array of references (likely a 2D array)
            matrix = arrNode.items.map((rowRef: any) => {
              if (rowRef && rowRef.type === 'reference') {
                const rowNode = heap[rowRef.pointsTo];
                return rowNode?.items || [];
              }
              return [];
            });
            matrixName = vName;
            break;
          }
        }
      }
    }

    if (!matrix) return null;
    return { name: matrixName, data: matrix };
  }, [heap, vars]);

  // Construct nodes and edges from Adjacency Matrix if we found one and we don't have explicit edges
  const { initialNodes, initialEdges } = useMemo(() => {
    let nodes: Node[] = [];
    let edges: Edge[] = [];

    if (matrixInfo && matrixInfo.data && matrixInfo.data.length > 0) {
      // Build from Matrix
      const size = matrixInfo.data.length;
      for (let i = 0; i < size; i++) {
        nodes.push({
          id: `n${i}`,
          position: { x: 0, y: 0 }, // DAGRE will layout
          data: { label: String.fromCharCode(65 + i) }, // A, B, C...
          className: 'w-12 h-12 rounded-full bg-indigo-500/20 border-2 border-indigo-500 flex flex-col items-center justify-center font-bold text-indigo-700 dark:text-indigo-300 shadow-lg'
        });
        
        for (let j = 0; j < matrixInfo.data[i].length; j++) {
          const val = matrixInfo.data[i][j];
          // Check if value is primitive or reference wrapper
          const actualVal = (val && typeof val === 'object' && val.type === 'primitive') ? val.value : val;
          if (actualVal !== 0 && actualVal !== false && actualVal !== null && actualVal !== undefined) {
            edges.push({
              id: `e-n${i}-n${j}`,
              source: `n${i}`,
              target: `n${j}`,
              animated: true,
              style: { stroke: '#8b5cf6', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' }
            });
          }
        }
      }
    } else {
      // Build from inference (object based graph)
      nodes = inference.nodes.map(n => ({
        id: n.id,
        position: { x: 0, y: 0 },
        data: { label: n.label || n.id },
        className: 'w-12 h-12 rounded-full bg-indigo-500/20 border-2 border-indigo-500 flex flex-col items-center justify-center font-bold text-indigo-700 dark:text-indigo-300 shadow-lg'
      }));

      edges = inference.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: true,
        label: e.label,
        style: { stroke: '#8b5cf6', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' }
      }));
    }

    const layouted = getLayoutedElements(nodes, edges);
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges };
  }, [inference, matrixInfo]);

  return (
    <div className="w-full h-full min-h-[400px] flex gap-4 p-4 relative">
      <div className="flex-1 bg-white/50 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden relative">
        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-white dark:bg-zinc-800 rounded-md text-xs font-bold text-slate-500 shadow-sm border border-slate-200 dark:border-zinc-700 uppercase tracking-wider">
          Directed Graph
        </div>
        <ReactFlow
          nodes={initialNodes}
          edges={initialEdges}
          fitView
          attributionPosition="bottom-left"
        >
          <Background color="#94a3b8" gap={16} />
          <Controls />
        </ReactFlow>
      </div>

      {matrixInfo && matrixInfo.data && matrixInfo.data.length > 0 && (
        <div className="w-80 shrink-0 flex flex-col gap-2">
           <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl">
             <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Adjacency Matrix</div>
             <div className="overflow-x-auto">
               <table className="w-full text-center border-collapse">
                 <thead>
                   <tr>
                     <th className="p-2 border-b border-r border-slate-200 dark:border-zinc-800"></th>
                     {matrixInfo.data[0]?.map((_: any, i: number) => (
                       <th key={i} className="p-2 border-b border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-400">
                         {String.fromCharCode(65 + i)}
                       </th>
                     ))}
                   </tr>
                 </thead>
                 <tbody>
                   {matrixInfo.data.map((row: any[], i: number) => (
                     <tr key={i}>
                       <th className="p-2 border-r border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-400">
                         {String.fromCharCode(65 + i)}
                       </th>
                       {row.map((cell: any, j: number) => {
                         const val = (cell && typeof cell === 'object' && cell.type === 'primitive') ? cell.value : cell;
                         const isEdge = val !== 0 && val !== false && val !== null && val !== undefined;
                         return (
                           <td key={j} className="p-2 border-b border-slate-100 dark:border-zinc-800/50">
                             <div className={`w-6 h-6 mx-auto rounded flex items-center justify-center text-xs font-mono font-bold transition-all ${
                               isEdge 
                                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30 scale-110' 
                                : 'text-slate-400 dark:text-zinc-600'
                             }`}>
                               {Number(val) || 0}
                             </div>
                           </td>
                         )
                       })}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};
