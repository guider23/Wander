import { Tree, Session, Node } from '../entities/types';
import { DomainEvent } from '../events/types';

export interface AttentionAppState {
  trees: Record<string, Tree>;
  sessions: Record<string, Session>;
  nodes: Record<string, Node>;
  activeTreeId: string | null;
  activeSessionId: string | null;
  activeNodeId: string | null;
}

export function createInitialState(): AttentionAppState {
  return {
    trees: {},
    sessions: {},
    nodes: {},
    activeTreeId: null,
    activeSessionId: null,
    activeNodeId: null
  };
}

export function applyEvent(state: AttentionAppState, event: DomainEvent): AttentionAppState {
  const trees = { ...state.trees };
  const sessions = { ...state.sessions };
  const nodes = { ...state.nodes };
  let { activeTreeId, activeSessionId, activeNodeId } = state;

  switch (event.type) {
    case 'WORK_STARTED': {
      if (!event.treeId || !event.sessionId || !event.nodeId) break;
      const rootNode: Node = {
        id: event.nodeId,
        treeId: event.treeId,
        parentNodeId: null,
        title: event.payload.title,
        kind: event.payload.kind || 'ROOT_WORK',
        status: 'ONGOING',
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: event.schemaVersion
      };
      nodes[event.nodeId] = rootNode;

      const newTree: Tree = {
        id: event.treeId,
        rootNodeId: event.nodeId,
        originTreeId: null,
        originNodeId: null,
        originSessionId: null,
        relationshipType: 'NEW_WORK',
        status: 'ACTIVE',
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        endedAt: null,
        deletedAt: null,
        schemaVersion: event.schemaVersion
      };
      // If there was an active tree, pause it
      if (activeTreeId && trees[activeTreeId] && trees[activeTreeId].status === 'ACTIVE') {
        trees[activeTreeId] = {
          ...trees[activeTreeId],
          status: 'PAUSED',
          updatedAt: event.occurredAt
        };
      }
      trees[event.treeId] = newTree;

      // If there was an active session, pause it
      if (activeSessionId && sessions[activeSessionId] && sessions[activeSessionId].status === 'ACTIVE') {
        sessions[activeSessionId] = {
          ...sessions[activeSessionId],
          status: 'PAUSED',
          endedAt: event.occurredAt,
          updatedAt: event.occurredAt
        };
      }

      const newSession: Session = {
        id: event.sessionId,
        treeId: event.treeId,
        focusNodeId: event.nodeId,
        previousSessionId: null,
        status: 'ACTIVE',
        startedAt: event.occurredAt,
        endedAt: null,
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        schemaVersion: event.schemaVersion
      };
      sessions[event.sessionId] = newSession;

      activeTreeId = event.treeId;
      activeSessionId = event.sessionId;
      activeNodeId = event.nodeId;
      break;
    }

    case 'THOUGHT_CAPTURED': {
      if (!event.treeId || !event.nodeId) break;
      const thoughtNode: Node = {
        id: event.nodeId,
        treeId: event.treeId,
        parentNodeId: event.payload.parentNodeId,
        title: event.payload.title,
        kind: 'THOUGHT',
        status: 'ONGOING',
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: event.schemaVersion
      };
      nodes[event.nodeId] = thoughtNode;
      // Note: Focus does NOT change
      break;
    }

    case 'BRANCH_CREATED': {
      if (!event.treeId || !event.nodeId) break;
      const branchNode: Node = {
        id: event.nodeId,
        treeId: event.treeId,
        parentNodeId: event.payload.parentNodeId,
        title: event.payload.title,
        kind: event.payload.kind || 'WORK_STEP',
        status: 'ONGOING',
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: event.schemaVersion
      };
      nodes[event.nodeId] = branchNode;
      break;
    }

    case 'WORK_STEP_ADDED': {
      if (!event.treeId || !event.nodeId) break;
      const stepNode: Node = {
        id: event.nodeId,
        treeId: event.treeId,
        parentNodeId: event.payload.parentNodeId,
        title: event.payload.title,
        kind: event.payload.kind || 'WORK_STEP',
        status: 'ONGOING',
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: event.schemaVersion
      };
      nodes[event.nodeId] = stepNode;

      // When adding a step to the current path, attention progresses to this step
      if (activeSessionId && sessions[activeSessionId]) {
        sessions[activeSessionId] = {
          ...sessions[activeSessionId],
          focusNodeId: event.nodeId,
          updatedAt: event.occurredAt
        };
        activeNodeId = event.nodeId;
      }
      break;
    }

    case 'FOCUS_SWITCHED': {
      if (!event.treeId || !event.sessionId) break;
      const targetNodeId = event.payload.targetNodeId;

      // Pause/end old active session
      if (activeSessionId && sessions[activeSessionId] && sessions[activeSessionId].status === 'ACTIVE') {
        sessions[activeSessionId] = {
          ...sessions[activeSessionId],
          status: 'PAUSED',
          endedAt: event.occurredAt,
          updatedAt: event.occurredAt
        };
      }

      const newSession: Session = {
        id: event.sessionId,
        treeId: event.treeId,
        focusNodeId: targetNodeId,
        previousSessionId: event.payload.previousSessionId || activeSessionId,
        status: 'ACTIVE',
        startedAt: event.occurredAt,
        endedAt: null,
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        schemaVersion: event.schemaVersion
      };
      sessions[event.sessionId] = newSession;

      activeTreeId = event.treeId;
      activeSessionId = event.sessionId;
      activeNodeId = targetNodeId;
      break;
    }

    case 'TREE_SWITCHED': {
      const targetTreeId = event.payload.targetTreeId;
      if (trees[targetTreeId]) {
        if (activeTreeId && trees[activeTreeId] && trees[activeTreeId].status === 'ACTIVE') {
          trees[activeTreeId] = {
            ...trees[activeTreeId],
            status: 'PAUSED',
            updatedAt: event.occurredAt
          };
        }
        if (activeSessionId && sessions[activeSessionId] && sessions[activeSessionId].status === 'ACTIVE') {
          sessions[activeSessionId] = {
            ...sessions[activeSessionId],
            status: 'PAUSED',
            endedAt: event.occurredAt,
            updatedAt: event.occurredAt
          };
        }
        trees[targetTreeId] = {
          ...trees[targetTreeId],
          status: 'ACTIVE',
          updatedAt: event.occurredAt
        };
        activeTreeId = targetTreeId;
        // Find latest session for this tree or leave null
        const treeSessions = Object.values(sessions)
          .filter((s) => s.treeId === targetTreeId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        if (treeSessions.length > 0) {
          activeSessionId = treeSessions[0].id;
          activeNodeId = treeSessions[0].focusNodeId;
        } else {
          activeSessionId = null;
          activeNodeId = trees[targetTreeId].rootNodeId;
        }
      }
      break;
    }

    case 'SESSION_PAUSED': {
      if (activeSessionId && sessions[activeSessionId]) {
        sessions[activeSessionId] = {
          ...sessions[activeSessionId],
          status: 'PAUSED',
          endedAt: event.occurredAt,
          updatedAt: event.occurredAt
        };
      }
      if (activeTreeId && trees[activeTreeId]) {
        trees[activeTreeId] = {
          ...trees[activeTreeId],
          status: 'PAUSED',
          updatedAt: event.occurredAt
        };
      }
      activeSessionId = null;
      break;
    }

    case 'SESSION_RESUMED': {
      if (!event.treeId || !event.sessionId) break;
      const targetNodeId = event.payload.focusNodeId;
      if (trees[event.treeId]) {
        trees[event.treeId] = {
          ...trees[event.treeId],
          status: 'ACTIVE',
          updatedAt: event.occurredAt
        };
      }
      const resumedSession: Session = {
        id: event.sessionId,
        treeId: event.treeId,
        focusNodeId: targetNodeId,
        previousSessionId: activeSessionId,
        status: 'ACTIVE',
        startedAt: event.occurredAt,
        endedAt: null,
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        schemaVersion: event.schemaVersion
      };
      sessions[event.sessionId] = resumedSession;
      activeTreeId = event.treeId;
      activeSessionId = event.sessionId;
      activeNodeId = targetNodeId;
      break;
    }

    case 'RETURNED_TO_NODE': {
      // Returned to node indicates the conscious intent to return to an earlier node
      break;
    }

    case 'TREE_CONTINUATION_STARTED': {
      if (!event.treeId || !event.sessionId || !event.nodeId) break;
      // Pause prior active session/tree if any
      if (activeSessionId && sessions[activeSessionId] && sessions[activeSessionId].status === 'ACTIVE') {
        sessions[activeSessionId] = {
          ...sessions[activeSessionId],
          status: 'PAUSED',
          endedAt: event.occurredAt,
          updatedAt: event.occurredAt
        };
      }
      if (activeTreeId && trees[activeTreeId] && trees[activeTreeId].status === 'ACTIVE') {
        trees[activeTreeId] = {
          ...trees[activeTreeId],
          status: 'PAUSED',
          updatedAt: event.occurredAt
        };
      }

      const rootNode: Node = {
        id: event.nodeId,
        treeId: event.treeId,
        parentNodeId: null,
        title: event.payload.rootTitle,
        kind: 'RETURN_ANCHOR',
        status: 'ONGOING',
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: event.schemaVersion
      };
      nodes[event.nodeId] = rootNode;

      const continuationTree: Tree = {
        id: event.treeId,
        rootNodeId: event.nodeId,
        originTreeId: event.payload.originTreeId,
        originNodeId: event.payload.originNodeId,
        originSessionId: event.payload.originSessionId,
        relationshipType: 'CONTINUATION',
        status: 'ACTIVE',
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        endedAt: null,
        deletedAt: null,
        schemaVersion: event.schemaVersion
      };
      trees[event.treeId] = continuationTree;

      const newSession: Session = {
        id: event.sessionId,
        treeId: event.treeId,
        focusNodeId: event.nodeId,
        previousSessionId: event.payload.originSessionId,
        status: 'ACTIVE',
        startedAt: event.occurredAt,
        endedAt: null,
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        schemaVersion: event.schemaVersion
      };
      sessions[event.sessionId] = newSession;

      activeTreeId = event.treeId;
      activeSessionId = event.sessionId;
      activeNodeId = event.nodeId;
      break;
    }

    case 'PATH_COMPLETED': {
      const targetNodeId = event.payload.nodeId;
      if (nodes[targetNodeId]) {
        nodes[targetNodeId] = {
          ...nodes[targetNodeId],
          status: 'COMPLETED',
          completedAt: event.occurredAt,
          updatedAt: event.occurredAt
        };
      }
      if (activeNodeId === targetNodeId && activeSessionId && sessions[activeSessionId]) {
        sessions[activeSessionId] = {
          ...sessions[activeSessionId],
          status: 'COMPLETED',
          endedAt: event.occurredAt,
          updatedAt: event.occurredAt
        };
        // Check if root node was completed, if so tree is completed
        if (activeTreeId && trees[activeTreeId] && trees[activeTreeId].rootNodeId === targetNodeId) {
          trees[activeTreeId] = {
            ...trees[activeTreeId],
            status: 'COMPLETED',
            endedAt: event.occurredAt,
            updatedAt: event.occurredAt
          };
        }
        activeSessionId = null;
      }
      break;
    }

    case 'PATH_ABANDONED': {
      const targetNodeId = event.payload.nodeId;
      if (nodes[targetNodeId]) {
        nodes[targetNodeId] = {
          ...nodes[targetNodeId],
          status: 'ABANDONED',
          abandonedAt: event.occurredAt,
          updatedAt: event.occurredAt
        };
      }
      if (activeNodeId === targetNodeId && activeSessionId && sessions[activeSessionId]) {
        sessions[activeSessionId] = {
          ...sessions[activeSessionId],
          status: 'ABANDONED',
          endedAt: event.occurredAt,
          updatedAt: event.occurredAt
        };
        if (activeTreeId && trees[activeTreeId] && trees[activeTreeId].rootNodeId === targetNodeId) {
          trees[activeTreeId] = {
            ...trees[activeTreeId],
            status: 'ABANDONED',
            endedAt: event.occurredAt,
            updatedAt: event.occurredAt
          };
        }
        activeSessionId = null;
      }
      break;
    }

    case 'SESSION_INTERRUPTED': {
      if (event.sessionId && sessions[event.sessionId]) {
        sessions[event.sessionId] = {
          ...sessions[event.sessionId],
          status: 'INTERRUPTED',
          endedAt: event.occurredAt,
          updatedAt: event.occurredAt
        };
      }
      if (event.treeId && trees[event.treeId] && trees[event.treeId].status === 'ACTIVE') {
        trees[event.treeId] = {
          ...trees[event.treeId],
          status: 'INTERRUPTED',
          updatedAt: event.occurredAt
        };
      }
      if (activeSessionId === event.sessionId) {
        activeSessionId = null;
      }
      break;
    }

    case 'NODE_RENAMED': {
      if (event.nodeId && nodes[event.nodeId]) {
        nodes[event.nodeId] = {
          ...nodes[event.nodeId],
          title: event.payload.newTitle,
          updatedAt: event.occurredAt
        };
      }
      break;
    }

    case 'NODE_DELETED': {
      if (event.nodeId && nodes[event.nodeId]) {
        nodes[event.nodeId] = {
          ...nodes[event.nodeId],
          deletedAt: event.occurredAt,
          updatedAt: event.occurredAt
        };
      }
      if (event.nodeId) {
        const markChildren = (parentId: string) => {
          Object.values(nodes).forEach((n) => {
            if (n.parentNodeId === parentId && !n.deletedAt) {
              nodes[n.id] = {
                ...n,
                deletedAt: event.occurredAt,
                updatedAt: event.occurredAt
              };
              markChildren(n.id);
            }
          });
        };
        markChildren(event.nodeId);
      }
      if (activeNodeId && nodes[activeNodeId]?.deletedAt) {
        activeNodeId = null;
      }
      break;
    }

    case 'TREE_DELETED': {
      if (event.treeId && trees[event.treeId]) {
        trees[event.treeId] = {
          ...trees[event.treeId],
          deletedAt: event.occurredAt,
          updatedAt: event.occurredAt
        };
      }
      if (activeTreeId === event.treeId) {
        activeTreeId = null;
        activeSessionId = null;
        activeNodeId = null;
      }
      break;
    }
  }

  return {
    trees,
    sessions,
    nodes,
    activeTreeId,
    activeSessionId,
    activeNodeId
  };
}

export function reconstructState(events: DomainEvent[]): AttentionAppState {
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence);
  let state = createInitialState();
  for (const event of sorted) {
    state = applyEvent(state, event);
  }
  return state;
}
