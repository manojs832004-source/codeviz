'use client';

import React, { useMemo, useEffect, useState } from 'react';
import ReactFlow, { Node, Edge, MarkerType, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { DSInferenceResult } from '@/utils/dsInference';

interface TreeVisualizerProps {
  inference: DSInferenceResult;
}

const nodeWidth = 40;
const nodeHeight = 40;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const isHorizontal = direction === 'LR';
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
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
    // Shift position since dagre treats x, y as center
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
    return node;
  });

  return { nodes, edges };
};

export const TreeVisualizer: React.FC<TreeVisualizerProps> = ({ inference }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    const rfNodes: Node[] = inference.nodes.map((n) => ({
      id: n.id,
      data: { label: n.label },
      position: { x: 0, y: 0 },
      style: {
        width: 40,
        height: 40,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#818cf8',
        color: '#fff',
        border: '2px solid #4f46e5',
        fontWeight: 'bold'
      }
    }));

    const rfEdges: Edge[] = inference.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#64748b',
      },
      style: { stroke: '#64748b', strokeWidth: 2 }
    }));

    // For Tree, direction is top-to-bottom
    const layouted = getLayoutedElements(rfNodes, rfEdges, 'TB');
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
