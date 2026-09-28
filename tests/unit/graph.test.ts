import { describe, it, expect } from 'vitest';
import { layoutGraph } from '../../src/graph/layout';
import { Node } from '../../src/domain/entities/types';

describe('Graph Layout Engine', () => {
  it('places root on trunk and renders sequential work on the same vertical line', () => {
    const nodes: Node[] = [
      {
        id: 'n1',
        treeId: 't1',
        parentNodeId: null,
        title: 'Instagram DM',
        kind: 'ROOT_WORK',
        status: 'ONGOING',
        createdAt: '2026-09-28T10:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: 1
      },
      {
        id: 'n2',
        treeId: 't1',
        parentNodeId: 'n1',
        title: 'Product idea',
        kind: 'THOUGHT',
        status: 'ONGOING',
        createdAt: '2026-09-28T10:14:00Z',
        updatedAt: '2026-09-28T10:14:00Z',
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: 1
      },
      {
        id: 'n3',
        treeId: 't1',
        parentNodeId: 'n2',
        title: 'Meta review',
        kind: 'WORK_STEP',
        status: 'ONGOING',
        createdAt: '2026-09-28T10:21:00Z',
        updatedAt: '2026-09-28T10:21:00Z',
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: 1
      },
      {
        id: 'n4',
        treeId: 't1',
        parentNodeId: 'n3',
        title: 'Business registration',
        kind: 'WORK_STEP',
        status: 'ONGOING',
        createdAt: '2026-09-28T10:28:00Z',
        updatedAt: '2026-09-28T10:28:00Z',
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: 1
      },
      {
        id: 'n5',
        treeId: 't1',
        parentNodeId: 'n4',
        title: 'Bank account',
        kind: 'WORK_STEP',
        status: 'ONGOING',
        createdAt: '2026-09-28T10:35:00Z',
        updatedAt: '2026-09-28T10:35:00Z',
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: 1
      }
    ];

    const result = layoutGraph(nodes, 'n5');
    expect(result.nodes).toHaveLength(5);

    const rootLayout = result.nodes.find((n) => n.node.id === 'n1')!;
    const productLayout = result.nodes.find((n) => n.node.id === 'n2')!;
    const metaLayout = result.nodes.find((n) => n.node.id === 'n3')!;
    const regLayout = result.nodes.find((n) => n.node.id === 'n4')!;
    const bankLayout = result.nodes.find((n) => n.node.id === 'n5')!;

    // Root is on trunk
    expect(rootLayout.isTrunk).toBe(true);
    expect(rootLayout.x).toBe(result.trunkX);

    // Product idea branched off
    expect(productLayout.x).not.toBe(result.trunkX);

    // CRITICAL: Meta review -> Business registration -> Bank account MUST share the SAME X coordinate!
    expect(metaLayout.x).toBe(productLayout.x);
    expect(regLayout.x).toBe(productLayout.x);
    expect(bankLayout.x).toBe(productLayout.x);

    // Y coordinates increase downwards
    expect(productLayout.y).toBeLessThan(metaLayout.y);
    expect(metaLayout.y).toBeLessThan(regLayout.y);
    expect(regLayout.y).toBeLessThan(bankLayout.y);

    // Edges exist
    expect(result.edges.length).toBe(4);
    const continuousEdges = result.edges.filter((e) => e.isContinuous);
    expect(continuousEdges.length).toBe(3); // n2->n3, n3->n4, n4->n5 are continuous straight vertical lines!
  });
});
