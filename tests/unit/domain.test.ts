import { describe, it, expect } from 'vitest';
import { reconstructState, applyEvent, createInitialState } from '../../src/domain/reducers/reconstruct';
import { DomainEvent } from '../../src/domain/events/types';

describe('Domain State & Event Reconstruction', () => {
  it('handles WORK_STARTED to create tree, root node, and active session', () => {
    const event: DomainEvent = {
      id: 'e1',
      type: 'WORK_STARTED',
      treeId: 'tree-1',
      sessionId: 'session-1',
      nodeId: 'node-1',
      occurredAt: '2026-09-28T10:00:00.000Z',
      createdAt: '2026-09-28T10:00:00.000Z',
      sequence: 1,
      schemaVersion: 1,
      payload: {
        title: 'Instagram DM'
      }
    };

    const state = applyEvent(createInitialState(), event);
    expect(state.activeTreeId).toBe('tree-1');
    expect(state.activeSessionId).toBe('session-1');
    expect(state.activeNodeId).toBe('node-1');

    expect(state.trees['tree-1']).toBeDefined();
    expect(state.trees['tree-1'].status).toBe('ACTIVE');
    expect(state.trees['tree-1'].relationshipType).toBe('NEW_WORK');

    expect(state.nodes['node-1']).toBeDefined();
    expect(state.nodes['node-1'].title).toBe('Instagram DM');
    expect(state.nodes['node-1'].kind).toBe('ROOT_WORK');

    expect(state.sessions['session-1']).toBeDefined();
    expect(state.sessions['session-1'].status).toBe('ACTIVE');
    expect(state.sessions['session-1'].focusNodeId).toBe('node-1');
  });

  it('captures a thought without changing focus', () => {
    const events: DomainEvent[] = [
      {
        id: 'e1',
        type: 'WORK_STARTED',
        treeId: 'tree-1',
        sessionId: 'session-1',
        nodeId: 'node-1',
        occurredAt: '2026-09-28T10:00:00.000Z',
        createdAt: '2026-09-28T10:00:00.000Z',
        sequence: 1,
        schemaVersion: 1,
        payload: { title: 'Instagram DM' }
      },
      {
        id: 'e2',
        type: 'THOUGHT_CAPTURED',
        treeId: 'tree-1',
        sessionId: 'session-1',
        nodeId: 'node-2',
        occurredAt: '2026-09-28T10:14:00.000Z',
        createdAt: '2026-09-28T10:14:00.000Z',
        sequence: 2,
        schemaVersion: 1,
        payload: {
          title: 'Product idea',
          parentNodeId: 'node-1'
        }
      }
    ];

    const state = reconstructState(events);
    expect(state.activeTreeId).toBe('tree-1');
    expect(state.activeSessionId).toBe('session-1');
    expect(state.activeNodeId).toBe('node-1'); // Focus unchanged!

    expect(state.nodes['node-2']).toBeDefined();
    expect(state.nodes['node-2'].title).toBe('Product idea');
    expect(state.nodes['node-2'].kind).toBe('THOUGHT');
    expect(state.nodes['node-2'].parentNodeId).toBe('node-1');
  });

  it('switches focus to a branch within the same tree', () => {
    const events: DomainEvent[] = [
      {
        id: 'e1',
        type: 'WORK_STARTED',
        treeId: 'tree-1',
        sessionId: 'session-1',
        nodeId: 'node-1',
        occurredAt: '2026-09-28T10:00:00.000Z',
        createdAt: '2026-09-28T10:00:00.000Z',
        sequence: 1,
        schemaVersion: 1,
        payload: { title: 'Instagram DM' }
      },
      {
        id: 'e2',
        type: 'THOUGHT_CAPTURED',
        treeId: 'tree-1',
        sessionId: 'session-1',
        nodeId: 'node-2',
        occurredAt: '2026-09-28T10:14:00.000Z',
        createdAt: '2026-09-28T10:14:00.000Z',
        sequence: 2,
        schemaVersion: 1,
        payload: { title: 'Product idea', parentNodeId: 'node-1' }
      },
      {
        id: 'e3',
        type: 'FOCUS_SWITCHED',
        treeId: 'tree-1',
        sessionId: 'session-2',
        nodeId: 'node-2',
        occurredAt: '2026-09-28T10:16:00.000Z',
        createdAt: '2026-09-28T10:16:00.000Z',
        sequence: 3,
        schemaVersion: 1,
        payload: {
          previousSessionId: 'session-1',
          targetNodeId: 'node-2'
        }
      }
    ];

    const state = reconstructState(events);
    expect(state.activeTreeId).toBe('tree-1');
    expect(state.activeSessionId).toBe('session-2');
    expect(state.activeNodeId).toBe('node-2');
    expect(state.sessions['session-1'].status).toBe('PAUSED');
    expect(state.sessions['session-2'].status).toBe('ACTIVE');
    expect(state.sessions['session-2'].previousSessionId).toBe('session-1');
  });

  it('adds sequential steps on a branch', () => {
    const events: DomainEvent[] = [
      {
        id: 'e1',
        type: 'WORK_STARTED',
        treeId: 'tree-1',
        sessionId: 'session-1',
        nodeId: 'node-1',
        occurredAt: '2026-09-28T10:00:00.000Z',
        createdAt: '2026-09-28T10:00:00.000Z',
        sequence: 1,
        schemaVersion: 1,
        payload: { title: 'Instagram DM' }
      },
      {
        id: 'e2',
        type: 'BRANCH_CREATED',
        treeId: 'tree-1',
        sessionId: 'session-1',
        nodeId: 'node-2',
        occurredAt: '2026-09-28T10:14:00.000Z',
        createdAt: '2026-09-28T10:14:00.000Z',
        sequence: 2,
        schemaVersion: 1,
        payload: { title: 'Product idea', parentNodeId: 'node-1' }
      },
      {
        id: 'e3',
        type: 'FOCUS_SWITCHED',
        treeId: 'tree-1',
        sessionId: 'session-2',
        nodeId: 'node-2',
        occurredAt: '2026-09-28T10:16:00.000Z',
        createdAt: '2026-09-28T10:16:00.000Z',
        sequence: 3,
        schemaVersion: 1,
        payload: { previousSessionId: 'session-1', targetNodeId: 'node-2' }
      },
      {
        id: 'e4',
        type: 'WORK_STEP_ADDED',
        treeId: 'tree-1',
        sessionId: 'session-2',
        nodeId: 'node-3',
        occurredAt: '2026-09-28T10:21:00.000Z',
        createdAt: '2026-09-28T10:21:00.000Z',
        sequence: 4,
        schemaVersion: 1,
        payload: { title: 'Meta review', parentNodeId: 'node-2' }
      },
      {
        id: 'e5',
        type: 'WORK_STEP_ADDED',
        treeId: 'tree-1',
        sessionId: 'session-2',
        nodeId: 'node-4',
        occurredAt: '2026-09-28T10:28:00.000Z',
        createdAt: '2026-09-28T10:28:00.000Z',
        sequence: 5,
        schemaVersion: 1,
        payload: { title: 'Business registration', parentNodeId: 'node-3' }
      }
    ];

    const state = reconstructState(events);
    expect(state.nodes['node-3'].parentNodeId).toBe('node-2');
    expect(state.nodes['node-4'].parentNodeId).toBe('node-3');
    expect(state.activeNodeId).toBe('node-4');
  });

  it('creates continuation tree when resuming a historical node', () => {
    const events: DomainEvent[] = [
      {
        id: 'e1',
        type: 'WORK_STARTED',
        treeId: 'tree-1',
        sessionId: 'session-1',
        nodeId: 'node-1',
        occurredAt: '2026-09-28T10:00:00.000Z',
        createdAt: '2026-09-28T10:00:00.000Z',
        sequence: 1,
        schemaVersion: 1,
        payload: { title: 'Instagram DM' }
      },
      {
        id: 'e2',
        type: 'SESSION_PAUSED',
        treeId: 'tree-1',
        sessionId: 'session-1',
        nodeId: 'node-1',
        occurredAt: '2026-09-28T10:30:00.000Z',
        createdAt: '2026-09-28T10:30:00.000Z',
        sequence: 2,
        schemaVersion: 1,
        payload: {}
      },
      {
        id: 'e3',
        type: 'TREE_CONTINUATION_STARTED',
        treeId: 'tree-2',
        sessionId: 'session-2',
        nodeId: 'node-cont-1',
        occurredAt: '2026-09-28T14:00:00.000Z',
        createdAt: '2026-09-28T14:00:00.000Z',
        sequence: 3,
        schemaVersion: 1,
        payload: {
          originTreeId: 'tree-1',
          originNodeId: 'node-1',
          originSessionId: 'session-1',
          rootTitle: 'Continue: Instagram DM',
          relationshipType: 'CONTINUATION'
        }
      }
    ];

    const state = reconstructState(events);
    expect(state.trees['tree-1'].status).toBe('PAUSED');
    expect(state.trees['tree-2'].relationshipType).toBe('CONTINUATION');
    expect(state.trees['tree-2'].originTreeId).toBe('tree-1');
    expect(state.trees['tree-2'].originNodeId).toBe('node-1');
    expect(state.activeTreeId).toBe('tree-2');
    expect(state.activeSessionId).toBe('session-2');
    expect(state.activeNodeId).toBe('node-cont-1');
  });

  it('cascades deletion down child nodes upon NODE_DELETED', () => {
    const events: DomainEvent[] = [
      {
        id: 'e1',
        type: 'WORK_STARTED',
        treeId: 'tree-1',
        sessionId: 'session-1',
        nodeId: 'node-root',
        occurredAt: '2026-09-28T10:00:00.000Z',
        createdAt: '2026-09-28T10:00:00.000Z',
        sequence: 1,
        schemaVersion: 1,
        payload: { title: 'Main Project' }
      },
      {
        id: 'e2',
        type: 'THOUGHT_CAPTURED',
        treeId: 'tree-1',
        sessionId: 'session-1',
        nodeId: 'node-child-1',
        occurredAt: '2026-09-28T10:05:00.000Z',
        createdAt: '2026-09-28T10:05:00.000Z',
        sequence: 2,
        schemaVersion: 1,
        payload: { title: 'Side thought', parentNodeId: 'node-root' }
      },
      {
        id: 'e3',
        type: 'WORK_STEP_ADDED',
        treeId: 'tree-1',
        sessionId: 'session-1',
        nodeId: 'node-grandchild-1',
        occurredAt: '2026-09-28T10:10:00.000Z',
        createdAt: '2026-09-28T10:10:00.000Z',
        sequence: 3,
        schemaVersion: 1,
        payload: { title: 'Sub detail', parentNodeId: 'node-child-1' }
      },
      {
        id: 'e4',
        type: 'NODE_DELETED',
        treeId: 'tree-1',
        sessionId: 'session-1',
        nodeId: 'node-child-1',
        occurredAt: '2026-09-28T10:15:00.000Z',
        createdAt: '2026-09-28T10:15:00.000Z',
        sequence: 4,
        schemaVersion: 1,
        payload: { reason: 'Cascade delete' }
      }
    ];

    const state = reconstructState(events);
    expect(state.nodes['node-root'].deletedAt).toBeNull();
    expect(state.nodes['node-child-1'].deletedAt).toBe('2026-09-28T10:15:00.000Z');
    expect(state.nodes['node-grandchild-1'].deletedAt).toBe('2026-09-28T10:15:00.000Z');
  });

  it('marks tree as deleted on TREE_DELETED and clears active session/tree', () => {
    const events: DomainEvent[] = [
      {
        id: 'e1',
        type: 'WORK_STARTED',
        treeId: 'tree-1',
        sessionId: 'session-1',
        nodeId: 'node-root',
        occurredAt: '2026-09-28T10:00:00.000Z',
        createdAt: '2026-09-28T10:00:00.000Z',
        sequence: 1,
        schemaVersion: 1,
        payload: { title: 'Main Project' }
      },
      {
        id: 'e2',
        type: 'TREE_DELETED',
        treeId: 'tree-1',
        sessionId: 'session-1',
        nodeId: 'node-root',
        occurredAt: '2026-09-28T10:20:00.000Z',
        createdAt: '2026-09-28T10:20:00.000Z',
        sequence: 2,
        schemaVersion: 1,
        payload: { reason: 'User deleted from history' }
      }
    ];

    const state = reconstructState(events);
    expect(state.trees['tree-1'].deletedAt).toBe('2026-09-28T10:20:00.000Z');
    expect(state.activeTreeId).toBeNull();
    expect(state.activeSessionId).toBeNull();
    expect(state.activeNodeId).toBeNull();
  });
});
