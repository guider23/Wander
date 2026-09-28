import { Node } from '../../domain/entities/types';

export interface LayoutNode {
  node: Node;
  x: number;
  y: number;
  isTrunk: boolean;
  depth: number;
}

export interface LayoutEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isContinuous: boolean;
  status: 'ACTIVE' | 'ONGOING' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';
  pathD: string;
}

export interface GraphLayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  trunkX: number;
}

export function layoutGraph(
  nodes: Node[],
  activeNodeId: string | null,
  options: {
    viewportWidth?: number;
    nodeSpacingY?: number;
    branchSpacingX?: number;
  } = {}
): GraphLayoutResult {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges: [], width: 800, height: 400, trunkX: 400 };
  }

  const nodeSpacingY = options.nodeSpacingY || 80;
  const branchSpacingX = options.branchSpacingX || 220;
  const minWidth = options.viewportWidth || 900;
  const startY = 70;

  // Build node lookup & child tree
  const nodeMap = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();

  for (const n of nodes) {
    nodeMap.set(n.id, n);
    childrenMap.set(n.id, []);
  }

  let rootNode: Node | null = null;
  for (const n of nodes) {
    if (!n.parentNodeId || !nodeMap.has(n.parentNodeId)) {
      if (!rootNode) rootNode = n;
    } else {
      const parentChildren = childrenMap.get(n.parentNodeId);
      if (parentChildren) {
        parentChildren.push(n);
      }
    }
  }

  if (!rootNode) {
    rootNode = nodes[0];
  }

  // Identify sequential paths vs new branches
  // Rule:
  // Root node is on trunk (column 0).
  // First WORK_STEP child of a node continues in the SAME column!
  // Subsequent children or THOUGHTs branch out into new columns (positive or negative offset).
  const layoutNodes: LayoutNode[] = [];
  const assignedCoords = new Map<string, { x: number; y: number; column: number; depth: number }>();

  // Collect branch column allocations
  let rightBranchCol = 1;
  let leftBranchCol = -1;
  let currentY = startY;

  // Recursive placement
  function placeSubtree(nodeId: string, currentColumn: number, depth: number): void {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    const y = currentY;
    currentY += nodeSpacingY;

    assignedCoords.set(nodeId, { x: 0, y, column: currentColumn, depth });

    const children = childrenMap.get(nodeId) || [];
    // Sort children by createdAt
    children.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let continuousChild: Node | null = null;
    const branchChildren: Node[] = [];

    // The primary continuation child stays on the same column
    for (const child of children) {
      if (!continuousChild && child.kind === 'WORK_STEP') {
        continuousChild = child;
      } else {
        branchChildren.push(child);
      }
    }

    // Process continuous child first so it stays on the same vertical line
    if (continuousChild) {
      placeSubtree(continuousChild.id, currentColumn, depth + 1);
    }

    // Process other branch children
    for (const bChild of branchChildren) {
      // Alternate left and right for branches
      let nextCol: number;
      if (currentColumn === 0) {
        if (Math.abs(rightBranchCol) <= Math.abs(leftBranchCol)) {
          nextCol = rightBranchCol++;
        } else {
          nextCol = leftBranchCol--;
        }
      } else if (currentColumn > 0) {
        nextCol = rightBranchCol++;
      } else {
        nextCol = leftBranchCol--;
      }
      placeSubtree(bChild.id, nextCol, depth + 1);
    }
  }

  placeSubtree(rootNode.id, 0, 0);

  // Compute column min and max
  let minCol = 0;
  let maxCol = 0;
  for (const info of assignedCoords.values()) {
    if (info.column < minCol) minCol = info.column;
    if (info.column > maxCol) maxCol = info.column;
  }

  const totalCols = maxCol - minCol;
  const contentWidth = Math.max(minWidth, (totalCols + 2) * branchSpacingX);
  const trunkX = Math.max(branchSpacingX * (Math.abs(minCol) + 1), contentWidth / 2);

  // Materialize LayoutNodes
  for (const [nodeId, info] of assignedCoords.entries()) {
    const node = nodeMap.get(nodeId)!;
    const x = trunkX + info.column * branchSpacingX;
    layoutNodes.push({
      node,
      x,
      y: info.y,
      isTrunk: info.column === 0,
      depth: info.depth
    });
  }

  // Materialize LayoutEdges
  const edges: LayoutEdge[] = [];
  for (const [nodeId, children] of childrenMap.entries()) {
    const parentCoord = assignedCoords.get(nodeId);
    if (!parentCoord) continue;
    const parentX = trunkX + parentCoord.column * branchSpacingX;
    const parentY = parentCoord.y;

    for (const child of children) {
      const childCoord = assignedCoords.get(child.id);
      if (!childCoord) continue;
      const childX = trunkX + childCoord.column * branchSpacingX;
      const childY = childCoord.y;

      const isContinuous = parentCoord.column === childCoord.column;
      const status = child.status;

      let pathD: string;
      if (isContinuous) {
        // Straight vertical line
        pathD = `M ${parentX} ${parentY + 12} L ${childX} ${childY - 12}`;
      } else {
        // Natural curve from parent to branched child
        const midY = (parentY + childY) / 2;
        pathD = `M ${parentX} ${parentY + 12} C ${parentX} ${midY}, ${childX} ${midY}, ${childX} ${childY - 12}`;
      }

      edges.push({
        id: `edge-${nodeId}-${child.id}`,
        sourceNodeId: nodeId,
        targetNodeId: child.id,
        startX: parentX,
        startY: parentY,
        endX: childX,
        endY: childY,
        isContinuous,
        status: child.id === activeNodeId ? 'ACTIVE' : status,
        pathD
      });
    }
  }

  const maxY = layoutNodes.reduce((max, n) => Math.max(max, n.y), startY);
  const height = Math.max(600, maxY + 120);

  return {
    nodes: layoutNodes,
    edges,
    width: contentWidth,
    height,
    trunkX
  };
}
