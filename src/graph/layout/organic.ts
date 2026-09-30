import { Node } from '../../domain/entities/types';

export interface OrganicNodePoint {
  node: Node;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  labelAlign: 'left' | 'right';
  subtitle?: string;
  durationLabel?: string;
}

export interface OrganicEdgePath {
  id: string;
  pathD: string;
  isDashed: boolean;
  isDestabilized?: boolean;
  status: 'ACTIVE' | 'ONGOING' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';
}

export interface OrganicTreeLayout {
  nodes: OrganicNodePoint[];
  edges: OrganicEdgePath[];
  startPoint: { x: number; y: number };
  growingTip?: { x: number; y: number; isActive: boolean };
  width: number;
  height: number;
}

/**
 * Format duration spent in human-readable minimal style (e.g. '12m', '1h 5m')
 */
function formatDuration(durationMs: number): string | undefined {
  if (durationMs < 45000) return undefined;
  const totalMins = Math.floor(durationMs / 60000);
  if (totalMins < 60) return `${totalMins}m`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Botanical Branch Curve Physics:
 * Leaves the trunk tangent (peeling upward vertically), arches outward gracefully,
 * and settles into the target node horizontally like a living branch.
 */
function createBotanicalBranchPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  side: number,
  isDrooping: boolean = false
): string {
  const dx = endX - startX;
  const dy = endY - startY;

  if (isDrooping) {
    // Drooping abandoned branch: peels upward off trunk, then droops downward to dead-end
    const cp1x = startX + side * 16;
    const cp1y = startY - 34;
    const cp2x = endX - side * 44;
    const cp2y = endY - 18;
    return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
  }

  // Botanical upward peeling curve:
  // Starts heading upward with the tree's vertical momentum, then gracefully sweeps outward
  const upwardLift = Math.max(35, Math.min(65, Math.abs(dy) * 0.5 + 24));
  const cp1x = startX + side * 22;
  const cp1y = startY - upwardLift;
  const cp2x = endX - side * Math.min(60, Math.abs(dx) * 0.45);
  const cp2y = endY + (dy < -15 ? 16 : dy > 15 ? -14 : 6);

  return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
}

/**
 * Cascading Sequential Steps Physics:
 * Connects sequential steps along a branch in a gentle, meandering liquid S-curve.
 */
function createCascadingStepPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string {
  const dx = endX - startX;
  const dy = endY - startY;

  const cp1x = startX + dx * 0.45;
  const cp1y = startY + dy * 0.12 + (dy >= 0 ? 8 : -8);
  const cp2x = endX - dx * 0.42;
  const cp2y = endY - dy * 0.22 - (dy >= 0 ? 10 : -10);

  return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
}

export function layoutOrganicTree(
  nodes: Node[],
  _activeNodeId: string | null,
  options: {
    width?: number;
    height?: number;
  } = {}
): OrganicTreeLayout {
  const baseWidth = Math.max(1400, options.width || 1400);
  const baseHeight = Math.max(1200, options.height || 1200);
  const centerX = baseWidth * 0.46;

  if (nodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      startPoint: { x: centerX, y: baseHeight - 120 },
      width: baseWidth,
      height: baseHeight
    };
  }

  // Node lookup and hierarchy maps
  const nodeMap = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
    childrenMap.set(n.id, []);
  }

  // Identify root node
  let rootNode: Node = nodes[0];
  for (const n of nodes) {
    if (!n.parentNodeId || !nodeMap.has(n.parentNodeId)) {
      rootNode = n;
    } else {
      childrenMap.get(n.parentNodeId)?.push(n);
    }
  }

  const startY = baseHeight - 120;
  const topY = 130;
  const startPoint = { x: centerX, y: startY };

  const getNodeDuration = (n: Node): number => {
    const start = new Date(n.createdAt).getTime();
    let end = Date.now();
    if (n.completedAt) end = new Date(n.completedAt).getTime();
    else if (n.abandonedAt) end = new Date(n.abandonedAt).getTime();
    return Math.max(0, end - start);
  };

  // Undulating trunk curve formula (continuous organic botanical spine)
  function getTrunkPoint(t: number): { x: number; y: number } {
    // t goes from 0 (bottom start anchor) to 1 (top of trunk)
    const y = startY - (startY - topY) * t;
    // Multi-harmonic gentle organic river undulation
    const wave = Math.sin(t * Math.PI * 3.0) * 42 + Math.cos(t * Math.PI * 1.5) * 20;
    const x = centerX + wave;
    return { x, y };
  }

  // Identify nodes that belong to the main trunk spine
  const trunkNodes: Node[] = [rootNode];
  let curr = rootNode;
  while (true) {
    const children = childrenMap.get(curr.id) || [];
    const workSteps = children.filter((c) => c.kind === 'WORK_STEP');
    workSteps.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // The primary work sequence forms the continuous trunk spine
    // Any additional steps added to the same parent node branch out organically
    const nextTrunkNode = workSteps[0];

    if (nextTrunkNode) {
      trunkNodes.push(nextTrunkNode);
      curr = nextTrunkNode;
    } else {
      break;
    }
  }

  // Position trunk nodes along the undulating spine
  // In the reference sketch, the trunk spans gracefully from bottom to top
  const positions = new Map<string, { x: number; y: number; side: number; isTrunk: boolean }>();
  const parentLinks = new Map<string, { parentId: string; side: number; isStepCascade: boolean; sproutX?: number; sproutY?: number }>();

  const trunkCount = trunkNodes.length;
  trunkNodes.forEach((node, idx) => {
    // Root node starts at the base (t = 0.16); subsequent steps climb up the trunk
    const t = trunkCount === 1 ? 0.16 : 0.16 + (idx / Math.max(1, trunkCount - 1)) * 0.70;
    const pt = getTrunkPoint(t);
    positions.set(node.id, { x: pt.x, y: pt.y, side: 0, isTrunk: true });
  });

  const isTrunkActive = trunkNodes.some((n) => n.status === 'ONGOING');

  // Build the complete smooth cubic bezier spline for the trunk from t = 0 to t = 1
  const trunkSamples: { x: number; y: number }[] = [];
  const sampleCount = 40;
  for (let i = 0; i <= sampleCount; i++) {
    trunkSamples.push(getTrunkPoint(i / sampleCount));
  }

  let trunkPathD = `M ${trunkSamples[0].x} ${trunkSamples[0].y}`;
  for (let i = 0; i < trunkSamples.length - 1; i++) {
    const p0 = i > 0 ? trunkSamples[i - 1] : trunkSamples[i];
    const p1 = trunkSamples[i];
    const p2 = trunkSamples[i + 1];
    const p3 = i < trunkSamples.length - 2 ? trunkSamples[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    trunkPathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  const isTrunkDestabilized = rootNode.status === 'ABANDONED' || trunkNodes.some((n) => n.status === 'ABANDONED');
  const resultEdges: OrganicEdgePath[] = [
    {
      id: 'trunk-main',
      pathD: trunkPathD,
      isDashed: isTrunkDestabilized,
      isDestabilized: isTrunkDestabilized,
      status: rootNode.status
    }
  ];

  // Layout Branches & Thoughts using Botanical Peeling Physics & Fanning
  const layoutBranchesAndThoughts = (parentNode: Node) => {
    const parentPos = positions.get(parentNode.id);
    if (!parentPos) return;

    const allChildren = childrenMap.get(parentNode.id) || [];
    const unplacedChildren = allChildren.filter((c) => !positions.has(c.id));
    if (unplacedChildren.length === 0) return;

    unplacedChildren.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (parentPos.isTrunk) {
      // Natural Tree Growth Principle:
      // As the center tree grows upward with time, older branches formed earlier remain at lower heights.
      // New branches sprout at the current higher level near the growing tip, alternating left and right!
      const nonTrunkChildren = allChildren.filter((c) => !positions.has(c.id) || unplacedChildren.some((u) => u.id === c.id));
      nonTrunkChildren.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      unplacedChildren.forEach((child) => {
        const isAbandoned = child.status === 'ABANDONED';
        const branchIdx = nonTrunkChildren.indexOf(child);
        const totalBranches = Math.max(1, nonTrunkChildren.length);
        const side = isAbandoned ? -1 : (branchIdx % 2 === 0 ? 1 : -1);

        const tProgress = totalBranches === 1
          ? 0.50
          : 0.25 + (branchIdx / Math.max(1, totalBranches - 1)) * 0.60;

        const trunkSproutPt = getTrunkPoint(tProgress);

        const durationMs = getNodeDuration(child);
        const subChildren = childrenMap.get(child.id) || [];
        const timeBonus = Math.min(110, Math.sqrt(durationMs / 1000) * 3);

        const baseLength = 110 + timeBonus + subChildren.length * 28;
        const lengthStagger = (branchIdx % 3) * 24;
        const branchLength = baseLength + lengthStagger;

        let yOffset = isAbandoned ? +28 : (branchIdx % 2 === 0 ? -32 : +22);
        const sproutX = trunkSproutPt.x + branchLength * side;
        const sproutY = trunkSproutPt.y + yOffset;

        positions.set(child.id, {
          x: sproutX,
          y: sproutY,
          side,
          isTrunk: false
        });

        // Link directly to the trunk attachment point
        parentLinks.set(child.id, {
          parentId: parentNode.id,
          sproutX: trunkSproutPt.x,
          sproutY: trunkSproutPt.y,
          side,
          isStepCascade: false
        });

        // Recursively layout all sub-branches of this child
        layoutBranchesAndThoughts(child);
      });
    } else {
      // Branch Node: All child thoughts and steps sprout directly from this branch node!
      // They fan out as separate branches from the current position instead of chaining onto each other.
      const branchSide = parentPos.side || 1;
      const fanOffsets = [-36, +38, -80, +82, -124, +126];

      unplacedChildren.forEach((child) => {
        const childIdx = allChildren.indexOf(child);
        const isAbandoned = child.status === 'ABANDONED';
        const durationMs = getNodeDuration(child);
        const subChildren = childrenMap.get(child.id) || [];
        const timeBonus = Math.min(90, Math.sqrt(durationMs / 1000) * 2.8);

        const baseLength = 95 + timeBonus + subChildren.length * 24;
        const lengthStagger = (childIdx % 3) * 24;
        const branchLength = baseLength + lengthStagger;

        let yOffset = fanOffsets[childIdx % fanOffsets.length] || (-36 - childIdx * 42);
        if (isAbandoned) {
          yOffset = Math.abs(yOffset) + 16; // Abandoned thoughts droop downward
        }

        const sproutX = parentPos.x + branchLength * branchSide;
        const sproutY = parentPos.y + yOffset;

        positions.set(child.id, {
          x: sproutX,
          y: sproutY,
          side: branchSide,
          isTrunk: false
        });

        // Only cascade linearly if it is the ONE single work step child of a work step
        // When there are multiple children on this node, each forms a distinct branching curve!
        const isStepCascade =
          child.kind === 'WORK_STEP' &&
          allChildren.length === 1 &&
          !isAbandoned &&
          parentNode.kind === 'WORK_STEP';

        parentLinks.set(child.id, {
          parentId: parentNode.id,
          side: branchSide,
          isStepCascade
        });

        // Recursively layout sub-children of this branch
        layoutBranchesAndThoughts(child);
      });
    }
  };

  // Run branch and thought layout starting from all trunk nodes
  trunkNodes.forEach((tNode) => {
    layoutBranchesAndThoughts(tNode);
  });

  // Global Anti-Collision Bounding-Box Solver
  // Ensures zero overlaps between labels or markers
  const allNodeIds = Array.from(positions.keys());
  for (let pass = 0; pass < 10; pass++) {
    let hadCollision = false;

    for (let i = 0; i < allNodeIds.length; i++) {
      const idA = allNodeIds[i];
      const posA = positions.get(idA)!;
      const nodeA = nodeMap.get(idA)!;
      const textLenA = Math.max(nodeA.title.length, 12);
      const widthA = Math.min(230, textLenA * 7.5 + 40);

      const leftA = posA.side === -1 ? posA.x - 18 - widthA : posA.x - 10;
      const rightA = posA.side === -1 ? posA.x + 10 : posA.x + 18 + widthA;
      const topA = posA.y - 18;
      const bottomA = posA.y + 24;

      for (let j = i + 1; j < allNodeIds.length; j++) {
        const idB = allNodeIds[j];
        const posB = positions.get(idB)!;
        const nodeB = nodeMap.get(idB)!;
        const textLenB = Math.max(nodeB.title.length, 12);
        const widthB = Math.min(230, textLenB * 7.5 + 40);

        const leftB = posB.side === -1 ? posB.x - 18 - widthB : posB.x - 10;
        const rightB = posB.side === -1 ? posB.x + 10 : posB.x + 18 + widthB;
        const topB = posB.y - 18;
        const bottomB = posB.y + 24;

        const overlapX = Math.min(rightA + 20, rightB + 20) - Math.max(leftA, leftB);
        const overlapY = Math.min(bottomA + 16, bottomB + 16) - Math.max(topA, topB);

        if (overlapX > 0 && overlapY > 0) {
          hadCollision = true;
          const push = overlapY + 12;

          if (posA.isTrunk && !posB.isTrunk) {
            posB.y += (posB.y >= posA.y ? 1 : -1) * push;
            posB.x += (posB.side || 1) * 20;
          } else if (!posA.isTrunk && posB.isTrunk) {
            posA.y += (posA.y >= posB.y ? 1 : -1) * push;
            posA.x += (posA.side || 1) * 20;
          } else {
            const half = push / 2;
            if (posA.y <= posB.y) {
              posA.y -= half;
              posB.y += half;
            } else {
              posA.y += half;
              posB.y -= half;
            }
          }
        }
      }
    }
    if (!hadCollision) break;
  }

  // Construct Final Branch Curves Using Botanical Physics
  parentLinks.forEach(({ parentId, side, isStepCascade, sproutX, sproutY }, childId) => {
    const childNode = nodeMap.get(childId);
    const childPos = positions.get(childId);
    const parentPos = positions.get(parentId);
    if (!childNode || !childPos || !parentPos) return;

    const isAbandoned = childNode.status === 'ABANDONED';
    const originX = sproutX ?? parentPos.x;
    const originY = sproutY ?? parentPos.y;

    let pathD = '';
    if (isStepCascade) {
      pathD = createCascadingStepPath(originX, originY, childPos.x, childPos.y);
    } else {
      pathD = createBotanicalBranchPath(originX, originY, childPos.x, childPos.y, side, isAbandoned);
    }

    resultEdges.push({
      id: `edge-${childId}`,
      pathD,
      isDashed: isAbandoned,
      isDestabilized: isAbandoned,
      status: childNode.status
    });
  });

  // Populate Result Nodes
  const resultNodes: OrganicNodePoint[] = [];
  let minX = startPoint.x;
  let maxX = startPoint.x;
  let minY = topY;
  let maxY = startPoint.y;

  nodes.forEach((node) => {
    const pos = positions.get(node.id);
    if (!pos) return;

    const durationLabel = formatDuration(getNodeDuration(node));
    let subtitle: string | undefined;

    if (node.id === rootNode.id) {
      subtitle = '(original task)';
    } else if (node.status === 'ABANDONED') {
      subtitle = '(forgot to return)';
    } else if (node.status === 'COMPLETED') {
      subtitle = '(completed)';
    } else if (node.kind === 'THOUGHT') {
      subtitle = '(thought)';
    }

    const labelAlign = pos.side === -1 ? 'right' : 'left';
    const labelX = pos.side === -1 ? pos.x - 16 : pos.x + 16;
    const labelY = pos.y + 4;

    resultNodes.push({
      node,
      x: pos.x,
      y: pos.y,
      labelX,
      labelY,
      labelAlign,
      subtitle,
      durationLabel
    });

    minX = Math.min(minX, pos.x - 240);
    maxX = Math.max(maxX, pos.x + 240);
    minY = Math.min(minY, pos.y - 60);
    maxY = Math.max(maxY, pos.y + 60);
  });

  const finalWidth = Math.max(baseWidth, maxX + 200);
  const finalHeight = Math.max(baseHeight, (startY - minY) + 260);

  const topTip = getTrunkPoint(1);

  return {
    nodes: resultNodes,
    edges: resultEdges,
    startPoint,
    growingTip: {
      x: topTip.x,
      y: topTip.y,
      isActive: isTrunkActive
    },
    width: finalWidth,
    height: finalHeight
  };
}
