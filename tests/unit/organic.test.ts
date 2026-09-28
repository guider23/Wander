import { describe, it, expect } from 'vitest';
import { layoutOrganicTree } from '../../src/graph/layout/organic';
import { Node } from '../../src/domain/entities/types';

describe('Organic Tree Layout - Anti-Overlap & Collision Avoidance', () => {
  it('prevents overlap when 4 thoughts/branches sprout from the exact same node', () => {
    const rootNode: Node = {
      id: 'root-1',
      treeId: 't1',
      parentNodeId: null,
      title: 'Deep Learning Research',
      kind: 'ROOT_WORK',
      status: 'ONGOING',
      createdAt: '2026-09-28T10:00:00Z',
      updatedAt: '2026-09-28T10:00:00Z',
      completedAt: null,
      abandonedAt: null,
      deletedAt: null,
      metadataJson: null,
      schemaVersion: 1
    };

    // 4 branches sprouting from root at the exact same parent point
    const branch1: Node = {
      id: 'b1',
      treeId: 't1',
      parentNodeId: 'root-1',
      title: 'Attention mechanism paper',
      kind: 'THOUGHT',
      status: 'ONGOING',
      createdAt: '2026-09-28T10:05:00Z',
      updatedAt: '2026-09-28T10:05:00Z',
      completedAt: null,
      abandonedAt: null,
      deletedAt: null,
      metadataJson: null,
      schemaVersion: 1
    };

    const branch2: Node = {
      id: 'b2',
      treeId: 't1',
      parentNodeId: 'root-1',
      title: 'Transformer architecture notes',
      kind: 'THOUGHT',
      status: 'ONGOING',
      createdAt: '2026-09-28T10:07:00Z',
      updatedAt: '2026-09-28T10:07:00Z',
      completedAt: null,
      abandonedAt: null,
      deletedAt: null,
      metadataJson: null,
      schemaVersion: 1
    };

    const branch3: Node = {
      id: 'b3',
      treeId: 't1',
      parentNodeId: 'root-1',
      title: 'GPU cluster memory estimation',
      kind: 'THOUGHT',
      status: 'ONGOING',
      createdAt: '2026-09-28T10:10:00Z',
      updatedAt: '2026-09-28T10:10:00Z',
      completedAt: null,
      abandonedAt: null,
      deletedAt: null,
      metadataJson: null,
      schemaVersion: 1
    };

    const branch4: Node = {
      id: 'b4',
      treeId: 't1',
      parentNodeId: 'root-1',
      title: 'Dataset cleaning pipeline',
      kind: 'THOUGHT',
      status: 'ONGOING',
      createdAt: '2026-09-28T10:12:00Z',
      updatedAt: '2026-09-28T10:12:00Z',
      completedAt: null,
      abandonedAt: null,
      deletedAt: null,
      metadataJson: null,
      schemaVersion: 1
    };

    const layout = layoutOrganicTree([rootNode, branch1, branch2, branch3, branch4], 'root-1');

    expect(layout.nodes).toHaveLength(5);

    // Verify all nodes are positioned with generous non-overlapping spacing
    const pB1 = layout.nodes.find(n => n.node.id === 'b1')!;
    const pB2 = layout.nodes.find(n => n.node.id === 'b2')!;
    const pB3 = layout.nodes.find(n => n.node.id === 'b3')!;
    const pB4 = layout.nodes.find(n => n.node.id === 'b4')!;

    const branches = [pB1, pB2, pB3, pB4];

    // Every pair of branches on the same side must have at least 45px vertical clearance
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const a = branches[i];
        const b = branches[j];

        // If on same side of trunk (both left or both right)
        const aSide = a.x > layout.startPoint.x ? 1 : -1;
        const bSide = b.x > layout.startPoint.x ? 1 : -1;

        if (aSide === bSide) {
          const dy = Math.abs(a.y - b.y);
          expect(dy).toBeGreaterThanOrEqual(44);
        } else {
          // If on opposite sides, their horizontal gap is huge
          const dx = Math.abs(a.x - b.x);
          expect(dx).toBeGreaterThanOrEqual(140);
        }
      }
    }
  });

  it('handles deeply nested sub-branches without overlapping parent or siblings', () => {
    const rootNode: Node = {
      id: 'root',
      treeId: 't1',
      parentNodeId: null,
      title: 'Company launch',
      kind: 'ROOT_WORK',
      status: 'ONGOING',
      createdAt: '2026-09-28T10:00:00Z',
      updatedAt: '2026-09-28T10:00:00Z',
      completedAt: null,
      abandonedAt: null,
      deletedAt: null,
      metadataJson: null,
      schemaVersion: 1
    };

    const branchA: Node = {
      id: 'sub-a',
      treeId: 't1',
      parentNodeId: 'root',
      title: 'Marketing strategy',
      kind: 'THOUGHT',
      status: 'ONGOING',
      createdAt: '2026-09-28T10:05:00Z',
      updatedAt: '2026-09-28T10:05:00Z',
      completedAt: null,
      abandonedAt: null,
      deletedAt: null,
      metadataJson: null,
      schemaVersion: 1
    };

    const stepA1: Node = {
      id: 'step-a1',
      treeId: 't1',
      parentNodeId: 'sub-a',
      title: 'Draft landing page copy',
      kind: 'WORK_STEP',
      status: 'ONGOING',
      createdAt: '2026-09-28T10:10:00Z',
      updatedAt: '2026-09-28T10:10:00Z',
      completedAt: null,
      abandonedAt: null,
      deletedAt: null,
      metadataJson: null,
      schemaVersion: 1
    };

    const stepA2: Node = {
      id: 'step-a2',
      treeId: 't1',
      parentNodeId: 'sub-a',
      title: 'Review analytics tags',
      kind: 'WORK_STEP',
      status: 'ONGOING',
      createdAt: '2026-09-28T10:15:00Z',
      updatedAt: '2026-09-28T10:15:00Z',
      completedAt: null,
      abandonedAt: null,
      deletedAt: null,
      metadataJson: null,
      schemaVersion: 1
    };

    const layout = layoutOrganicTree([rootNode, branchA, stepA1, stepA2], 'root');

    expect(layout.nodes).toHaveLength(4);
    const pStep1 = layout.nodes.find(n => n.node.id === 'step-a1')!;
    const pStep2 = layout.nodes.find(n => n.node.id === 'step-a2')!;

    // Step 1 and Step 2 must not overlap
    const dy = Math.abs(pStep1.y - pStep2.y);
    const dx = Math.abs(pStep1.x - pStep2.x);
    expect(dy >= 40 || dx >= 100).toBe(true);
  });

  it('correctly forms separate branches when adding multiple thoughts to the same branch node (not chained to previous thought)', () => {
    const rootNode: Node = {
      id: 'root-work',
      treeId: 't1',
      parentNodeId: null,
      title: 'Main Coding Task',
      kind: 'ROOT_WORK',
      status: 'ONGOING',
      createdAt: '2026-09-28T10:00:00Z',
      updatedAt: '2026-09-28T10:00:00Z',
      completedAt: null,
      abandonedAt: null,
      deletedAt: null,
      metadataJson: null,
      schemaVersion: 1
    };

    const branchTask: Node = {
      id: 'branch-1',
      treeId: 't1',
      parentNodeId: 'root-work',
      title: 'Feature A Branch',
      kind: 'THOUGHT',
      status: 'ONGOING',
      createdAt: '2026-09-28T10:02:00Z',
      updatedAt: '2026-09-28T10:02:00Z',
      completedAt: null,
      abandonedAt: null,
      deletedAt: null,
      metadataJson: null,
      schemaVersion: 1
    };

    // User adds thought 1 to branch-1
    const thought1: Node = {
      id: 'thought-1',
      treeId: 't1',
      parentNodeId: 'branch-1',
      title: 'Thought 1 about performance',
      kind: 'THOUGHT',
      status: 'ONGOING',
      createdAt: '2026-09-28T10:05:00Z',
      updatedAt: '2026-09-28T10:05:00Z',
      completedAt: null,
      abandonedAt: null,
      deletedAt: null,
      metadataJson: null,
      schemaVersion: 1
    };

    // User adds thought 2 to the SAME branch-1
    const thought2: Node = {
      id: 'thought-2',
      treeId: 't1',
      parentNodeId: 'branch-1',
      title: 'Thought 2 about caching',
      kind: 'THOUGHT',
      status: 'ONGOING',
      createdAt: '2026-09-28T10:07:00Z',
      updatedAt: '2026-09-28T10:07:00Z',
      completedAt: null,
      abandonedAt: null,
      deletedAt: null,
      metadataJson: null,
      schemaVersion: 1
    };

    const layout = layoutOrganicTree([rootNode, branchTask, thought1, thought2], 'root-work');

    expect(layout.nodes).toHaveLength(4);

    const pT1 = layout.nodes.find(n => n.node.id === 'thought-1')!;
    const pT2 = layout.nodes.find(n => n.node.id === 'thought-2')!;

    // Both thoughts must be distinct in position
    expect(pT1.y).not.toBe(pT2.y);
    // They fan out with vertical separation of at least 40px
    expect(Math.abs(pT1.y - pT2.y)).toBeGreaterThanOrEqual(40);

    // Both edges must exist
    const edgeT1 = layout.edges.find(e => e.id === 'edge-thought-1');
    const edgeT2 = layout.edges.find(e => e.id === 'edge-thought-2');
    expect(edgeT1).toBeDefined();
    expect(edgeT2).toBeDefined();
  });
});
