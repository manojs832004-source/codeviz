'use client';

import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, Edge, Node, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

interface DivideAndConquerVisualizerProps {
  arraysInfo: { name: string; items: any[]; id: string }[];
  pointers: Record<number, string[]>;
}

const nodeWidth = 200;
const nodeHeight = 80;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = Position.Top;
    node.sourcePosition = Position.Bottom;
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
    return node;
  });

  return { nodes, edges };
};

export const DivideAndConquerVisualizer: React.FC<DivideAndConquerVisualizerProps> = ({ arraysInfo }) => {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    arraysInfo.forEach((arr, i) => {
      nodes.push({
        id: arr.id,
        position: { x: 0, y: 0 },
        data: {
          label: (
            <div className="flex flex-col items-center">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">{arr.name}</div>
              <div className="flex gap-1 border-2 border-slate-300 dark:border-zinc-600 rounded-md p-1 bg-white dark:bg-zinc-800">
                {arr.items.map((item, idx) => (
                  <div key={idx} className="w-8 h-8 flex flex-col items-center justify-center bg-slate-100 dark:bg-zinc-700 rounded text-xs font-mono font-bold">
                    <span>{typeof item === 'object' ? '…' : item}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        },
        style: {
          background: 'transparent',
          border: 'none',
          boxShadow: 'none'
        }
      });

      // Content-based heuristic for parent-child edges
      // Find the smallest other array that contains `arr` as a strict subarray
      let bestParent: { id: string, size: number } | null = null;
      
      for (const possibleParent of arraysInfo) {
        if (possibleParent.id === arr.id) continue;
        if (possibleParent.items.length <= arr.items.length) continue;
        
        let isSubarray = false;
        const pItems = possibleParent.items;
        const cItems = arr.items;
        if (cItems.length > 0) {
          for (let k = 0; k <= pItems.length - cItems.length; k++) {
            let match = true;
            for (let j = 0; j < cItems.length; j++) {
              const pVal = typeof pItems[k+j] === 'object' ? pItems[k+j]?.value : pItems[k+j];
              const cVal = typeof cItems[j] === 'object' ? cItems[j]?.value : cItems[j];
              if (pVal !== cVal) {
                match = false;
                break;
              }
            }
            if (match) {
              isSubarray = true;
              break;
            }
          }
        }
        
        if (isSubarray) {
          if (!bestParent || possibleParent.items.length < bestParent.size) {
            bestParent = { id: possibleParent.id, size: possibleParent.items.length };
          }
        }
      }

      if (bestParent) {
        edges.push({
          id: `e-${bestParent.id}-${arr.id}`,
          source: bestParent.id,
          target: arr.id,
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 2 }
        });
      }
    });

    const layouted = getLayoutedElements(nodes, edges);
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges };
  }, [arraysInfo]);

  return (
    <div className="w-full h-full min-h-[400px]">
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
  );
};
