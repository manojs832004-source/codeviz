export type DSType = 'array' | 'divide_and_conquer' | 'binary_tree' | 'linked_list' | 'graph' | 'map';

interface HeapNode {
  type: string;
  value?: any;
  items?: any[];
  fields?: Record<string, any>;
  pointsTo?: string;
  className?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface DSInferenceResult {
  type: DSType;
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootId?: string;
}

export function inferDataStructure(heap: Record<string, HeapNode>, locals: Record<string, any>): DSInferenceResult {
  let hasLeftRight = false;
  let hasNext = false;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let detectedType: DSType = 'array';

  // Find all objects in heap to determine the structure type
  const objectNodes = Object.entries(heap).filter(([_, node]) => node.type === 'object' || node.type === 'dict' || node.fields);

  for (const [id, node] of objectNodes) {
    const fields = node.fields || {};
    // Create a node representation
    let label = '';
    if (fields['val'] !== undefined) label = String(fields['val'].value || fields['val']);
    else if (fields['value'] !== undefined) label = String(fields['value'].value || fields['value']);
    else if (fields['data'] !== undefined) label = String(fields['data'].value || fields['data']);
    else if (fields['item'] !== undefined) label = String(fields['item'].value || fields['item']);
    else label = node.className || 'Object';

    nodes.push({ id, label });

    // Create edges for any pointer fields
    for (const [fieldName, fieldVal] of Object.entries(fields)) {
      if (fieldVal && typeof fieldVal === 'object' && fieldVal.type === 'reference' && fieldVal.pointsTo) {
        if (fieldVal.pointsTo !== 'null' && fieldVal.pointsTo !== '0') {
          edges.push({
            id: `${id}-${fieldName}-${fieldVal.pointsTo}`,
            source: id,
            target: fieldVal.pointsTo,
            label: fieldName
          });
        }
      }
    }
  }

  // Detect strict Adjacency Matrix (NxN 2D array)
  let hasAdjacencyMatrix = false;
  const arrays = Object.values(heap).filter(n => n.type === 'array' && n.items && n.items.length > 0);
  for (const arr of arrays) {
    const firstItem = arr.items![0];
    if (firstItem && typeof firstItem === 'object' && firstItem.type === 'reference') {
      const rowNode = heap[firstItem.pointsTo];
      if (rowNode && rowNode.type === 'array' && rowNode.items?.length === arr.items?.length) {
        hasAdjacencyMatrix = true;
        break;
      }
    }
  }

  const isGraphClass = Object.values(heap).some(n => n.className?.toLowerCase().includes('graph'));
  const isMapClass = Object.values(heap).some(n => {
    const cls = n.className?.toLowerCase() || '';
    return cls === 'dict' || cls.endsWith('map');
  });

  // Map inference
  if (isMapClass) {
    detectedType = 'map';
  } else if (nodes.length > 0 && edges.length > 0) {
    let maxOutDegree = 0;
    let hasCyclesOrMerge = false; // in-degree > 1 means it's not a simple tree/list
    
    const outDegree: Record<string, number> = {};
    const inDegree: Record<string, number> = {};
    
    nodes.forEach(n => { outDegree[n.id] = 0; inDegree[n.id] = 0; });
    edges.forEach(e => {
      outDegree[e.source] = (outDegree[e.source] || 0) + 1;
      inDegree[e.target] = (inDegree[e.target] || 0) + 1;
      if (inDegree[e.target] > 1) hasCyclesOrMerge = true;
      // Self loops or back edges (simple heuristic: if source === target, it's a cycle)
      if (e.source === e.target) hasCyclesOrMerge = true;
    });
    
    maxOutDegree = Math.max(0, ...Object.values(outDegree));
    
    if (hasCyclesOrMerge || isGraphClass) {
      detectedType = 'graph';
    } else if (maxOutDegree <= 1) {
      detectedType = 'linked_list';
    } else if (maxOutDegree <= 2) {
      detectedType = 'binary_tree';
    } else {
      detectedType = 'graph'; // generic tree or graph
    }
  } else if (hasAdjacencyMatrix) {
    detectedType = 'graph';
  } else if (arrays.length > 1) {
    detectedType = 'divide_and_conquer';
  }

  // Find the root (a node with no incoming edges, referenced by a local variable)
  let rootId: string | undefined;
  
  // First, check if any local variable points to a node in our graph
  for (const [_, local] of Object.entries(locals)) {
    if (local && local.type === 'reference' && local.pointsTo) {
      const targetNode = heap[local.pointsTo];
      if (targetNode) {
        if (detectedType === 'map') {
           const cls = targetNode.className?.toLowerCase() || '';
           if (cls === 'dict' || cls.endsWith('map')) {
              rootId = local.pointsTo;
              break;
           }
        } else if (nodes.find(n => n.id === local.pointsTo)) {
          rootId = local.pointsTo;
          break; // Just take the first one for now, usually 'root' or 'head'
        }
      }
    }
  }

  // If no local points to it, find a node with 0 in-degree
  if (!rootId && nodes.length > 0) {
    const hasIncoming = new Set(edges.map(e => e.target));
    const roots = nodes.filter(n => !hasIncoming.has(n.id));
    if (roots.length > 0) rootId = roots[0].id;
  }

  return { type: detectedType, nodes, edges, rootId };
}
