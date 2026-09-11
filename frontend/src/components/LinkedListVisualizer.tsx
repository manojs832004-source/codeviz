'use client';

import React, { useMemo, useEffect, useState } from 'react';
import ReactFlow, { Node, Edge, MarkerType, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { DSInferenceResult } from '@/utils/dsInference';

interface LinkedListVisualizerProps {
  inference: DSInferenceResult;
}

const nodeWidth = 60;
const nodeHeight = 40;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, ranker: 'longest-path' });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
    
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
    return node;
  });

  return { nodes, edges };
};

export const LinkedListVisualizer: React.FC<LinkedListVisualizerProps> = ({ inference }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    const rfNodes: Node[] = inference.nodes.map((n) => ({
      id: n.id,
      data: { label: n.label },
      position: { x: 0, y: 0 },
      style: {
        width: nodeWidth,
        height: nodeHeight,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#34d399',
        color: '#064e3b',
        border: '2px solid #059669',
        fontWeight: 'bold',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
      }
    }));

    const rfEdges: Edge[] = inference.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'straight',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#0f766e',
      },
      style: { stroke: '#0f766e', strokeWidth: 3 }
    }));

    // For Linked List, direction is left-to-right
    const layouted = getLayoutedElements(rfNodes, rfEdges, 'LR');
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [inference]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnDoubleClick={true}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      />
    </div>
  );
};
