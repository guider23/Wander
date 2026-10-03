import { v4 as uuidv4 } from 'uuid';
import { Tree, Session, Node, AppSettings } from '../domain/entities/types';
import { DomainEvent } from '../domain/events/types';

export interface ActiveContextDTO {
  activeTree: Tree | null;
  activeSession: Session | null;
  activeNode: Node | null;
  nodes: Node[];
  sessions: Session[];
  events: DomainEvent[];
}

export interface TreeDetailDTO {
  tree: Tree;
  nodes: Node[];
  sessions: Session[];
  events: DomainEvent[];
  originTree?: Tree | null;
  originNode?: Node | null;
}

export interface HistoryItemDTO {
  tree: Tree;
  rootNode: Node | null;
  nodeCount: number;
  sessionCount: number;
  totalDurationSeconds: number;
  lastActivityAt: string;
}

// Fallback in-memory state for dev server when not inside Electron
class MockAttentionStorage {
  trees: Tree[] = [];
  sessions: Session[] = [];
  nodes: Node[] = [];
  events: DomainEvent[] = [];
  settings: AppSettings = {
    timeFormat: '12h',
    reducedMotion: false,
    highContrast: false,
    continuumMode: 'auto',
    autoDock: true,
    alwaysOnTop: true,
    startDocked: false
  };

  constructor() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('attention_path_mock_db');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.trees = parsed.trees || [];
          this.sessions = parsed.sessions || [];
          this.nodes = parsed.nodes || [];
          this.events = parsed.events || [];
          this.settings = parsed.settings || this.settings;
        } catch {
          // ignore
        }
      }
    }
  }

  save() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        'attention_path_mock_db',
        JSON.stringify({
          trees: this.trees,
          sessions: this.sessions,
          nodes: this.nodes,
          events: this.events,
          settings: this.settings
        })
      );
    }
  }

  getActiveTree(): Tree | null {
    return this.trees.find((t) => t.status === 'ACTIVE' && !t.deletedAt) || null;
  }

  getActiveSession(): Session | null {
    return this.sessions.find((s) => s.status === 'ACTIVE') || null;
  }
}

const mockStorage = new MockAttentionStorage();

export const api = {
  sessions: {
    start: async (title: string): Promise<{ tree: Tree; session: Session; node: Node }> => {
      if (window.attentionApp) {
        return window.attentionApp.sessions.start(title);
      }
      const treeId = uuidv4();
      const nodeId = uuidv4();
      const sessionId = uuidv4();
      const now = new Date().toISOString();

      // pause current
      mockStorage.trees.forEach((t) => {
        if (t.status === 'ACTIVE') t.status = 'PAUSED';
      });
      mockStorage.sessions.forEach((s) => {
        if (s.status === 'ACTIVE') {
          s.status = 'PAUSED';
          s.endedAt = now;
        }
      });

      const rootNode: Node = {
        id: nodeId,
        treeId,
        parentNodeId: null,
        title,
        kind: 'ROOT_WORK',
        status: 'ONGOING',
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: 1
      };
      const tree: Tree = {
        id: treeId,
        rootNodeId: nodeId,
        originTreeId: null,
        originNodeId: null,
        originSessionId: null,
        relationshipType: 'NEW_WORK',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        endedAt: null,
        deletedAt: null,
        schemaVersion: 1
      };
      const session: Session = {
        id: sessionId,
        treeId,
        focusNodeId: nodeId,
        previousSessionId: null,
        status: 'ACTIVE',
        startedAt: now,
        endedAt: null,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1
      };

      mockStorage.nodes.push(rootNode);
      mockStorage.trees.unshift(tree);
      mockStorage.sessions.unshift(session);
      mockStorage.save();
      return { tree, session, node: rootNode };
    },

    pause: async (): Promise<{ success: boolean }> => {
      if (window.attentionApp) return window.attentionApp.sessions.pause();
      const now = new Date().toISOString();
      mockStorage.sessions.forEach((s) => {
        if (s.status === 'ACTIVE') {
          s.status = 'PAUSED';
          s.endedAt = now;
        }
      });
      mockStorage.trees.forEach((t) => {
        if (t.status === 'ACTIVE') t.status = 'PAUSED';
      });
      mockStorage.save();
      return { success: true };
    },

    resume: async (treeId: string, focusNodeId?: string): Promise<Session> => {
      if (window.attentionApp) return window.attentionApp.sessions.resume(treeId, focusNodeId);
      const tree = mockStorage.trees.find((t) => t.id === treeId);
      if (!tree) throw new Error('Tree not found');
      const now = new Date().toISOString();
      const newSessionId = uuidv4();

      let targetNodeId = focusNodeId;
      if (!targetNodeId) {
        const treeSessions = mockStorage.sessions.filter((s) => s.treeId === treeId);
        if (treeSessions.length > 0) {
          treeSessions.sort((a, b) => new Date(b.updatedAt || b.startedAt).getTime() - new Date(a.updatedAt || a.startedAt).getTime());
          for (const s of treeSessions) {
            if (s.focusNodeId) {
              const node = mockStorage.nodes.find((n) => n.id === s.focusNodeId && !n.deletedAt);
              if (node) {
                targetNodeId = s.focusNodeId;
                break;
              }
            }
          }
        }
      }
      if (!targetNodeId) {
        targetNodeId = tree.rootNodeId;
      }

      mockStorage.sessions.forEach((s) => {
        if (s.status === 'ACTIVE') {
          s.status = 'PAUSED';
          s.endedAt = now;
        }
      });
      tree.status = 'ACTIVE';

      const session: Session = {
        id: newSessionId,
        treeId,
        focusNodeId: targetNodeId,
        previousSessionId: null,
        status: 'ACTIVE',
        startedAt: now,
        endedAt: null,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1
      };
      mockStorage.sessions.unshift(session);
      mockStorage.save();
      return session;
    },

    switchFocus: async (targetNodeId: string): Promise<Session> => {
      if (window.attentionApp) return window.attentionApp.sessions.switchFocus(targetNodeId);
      const targetNode = mockStorage.nodes.find((n) => n.id === targetNodeId);
      if (!targetNode) throw new Error('Target node not found');
      const now = new Date().toISOString();
      const newSessionId = uuidv4();

      mockStorage.sessions.forEach((s) => {
        if (s.status === 'ACTIVE') {
          s.status = 'PAUSED';
          s.endedAt = now;
        }
      });
      const session: Session = {
        id: newSessionId,
        treeId: targetNode.treeId,
        focusNodeId: targetNodeId,
        previousSessionId: null,
        status: 'ACTIVE',
        startedAt: now,
        endedAt: null,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1
      };
      mockStorage.sessions.unshift(session);
      mockStorage.save();
      return session;
    },

    resumeContinuation: async (
      originTreeId: string,
      originNodeId: string,
      rootTitle?: string
    ): Promise<{ tree: Tree; session: Session; node: Node }> => {
      if (window.attentionApp) {
        return window.attentionApp.sessions.resumeContinuation(originTreeId, originNodeId, rootTitle);
      }
      const originNode = mockStorage.nodes.find((n) => n.id === originNodeId);
      if (!originNode) throw new Error('Origin node not found');
      const now = new Date().toISOString();
      const newTreeId = uuidv4();
      const newNodeId = uuidv4();
      const newSessionId = uuidv4();
      const title = rootTitle || `Continue: ${originNode.title}`;

      mockStorage.sessions.forEach((s) => {
        if (s.status === 'ACTIVE') {
          s.status = 'PAUSED';
          s.endedAt = now;
        }
      });
      mockStorage.trees.forEach((t) => {
        if (t.status === 'ACTIVE') t.status = 'PAUSED';
      });

      const rootNode: Node = {
        id: newNodeId,
        treeId: newTreeId,
        parentNodeId: null,
        title,
        kind: 'RETURN_ANCHOR',
        status: 'ONGOING',
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: 1
      };
      const tree: Tree = {
        id: newTreeId,
        rootNodeId: newNodeId,
        originTreeId,
        originNodeId,
        originSessionId: null,
        relationshipType: 'CONTINUATION',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        endedAt: null,
        deletedAt: null,
        schemaVersion: 1
      };
      const session: Session = {
        id: newSessionId,
        treeId: newTreeId,
        focusNodeId: newNodeId,
        previousSessionId: null,
        status: 'ACTIVE',
        startedAt: now,
        endedAt: null,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1
      };

      mockStorage.nodes.push(rootNode);
      mockStorage.trees.unshift(tree);
      mockStorage.sessions.unshift(session);
      mockStorage.save();
      return { tree, session, node: rootNode };
    }
  },

  nodes: {
    captureThought: async (title: string, parentNodeId: string): Promise<Node> => {
      if (window.attentionApp) return window.attentionApp.nodes.captureThought(title, parentNodeId);
      const parent = mockStorage.nodes.find((n) => n.id === parentNodeId);
      if (!parent) throw new Error('Parent not found');
      const now = new Date().toISOString();
      const node: Node = {
        id: uuidv4(),
        treeId: parent.treeId,
        parentNodeId,
        title,
        kind: 'THOUGHT',
        status: 'ONGOING',
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: 1
      };
      mockStorage.nodes.push(node);
      mockStorage.save();
      return node;
    },

    addStep: async (title: string, parentNodeId: string): Promise<{ node: Node; session: Session }> => {
      if (window.attentionApp) return window.attentionApp.nodes.addStep(title, parentNodeId);
      const parent = mockStorage.nodes.find((n) => n.id === parentNodeId);
      if (!parent) throw new Error('Parent not found');
      const now = new Date().toISOString();
      const node: Node = {
        id: uuidv4(),
        treeId: parent.treeId,
        parentNodeId,
        title,
        kind: 'WORK_STEP',
        status: 'ONGOING',
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: 1
      };
      mockStorage.nodes.push(node);
      let session = mockStorage.getActiveSession();
      if (!session) {
        session = {
          id: uuidv4(),
          treeId: parent.treeId,
          focusNodeId: node.id,
          previousSessionId: null,
          status: 'ACTIVE',
          startedAt: now,
          endedAt: null,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1
        };
        mockStorage.sessions.unshift(session);
      } else {
        session.focusNodeId = node.id;
      }
      mockStorage.save();
      return { node, session };
    },

    createBranch: async (title: string, parentNodeId: string): Promise<Node> => {
      if (window.attentionApp) return window.attentionApp.nodes.createBranch(title, parentNodeId);
      const parent = mockStorage.nodes.find((n) => n.id === parentNodeId);
      if (!parent) throw new Error('Parent not found');
      const now = new Date().toISOString();
      const node: Node = {
        id: uuidv4(),
        treeId: parent.treeId,
        parentNodeId,
        title,
        kind: 'WORK_STEP',
        status: 'ONGOING',
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        abandonedAt: null,
        deletedAt: null,
        metadataJson: null,
        schemaVersion: 1
      };
      mockStorage.nodes.push(node);
      mockStorage.save();
      return node;
    },

    complete: async (nodeId: string, note?: string): Promise<{ success: boolean }> => {
      if (window.attentionApp) return window.attentionApp.nodes.complete(nodeId, note);
      const node = mockStorage.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.status = 'COMPLETED';
        node.completedAt = new Date().toISOString();
      }
      const activeSession = mockStorage.getActiveSession();
      if (activeSession && activeSession.focusNodeId === nodeId) {
        activeSession.status = 'COMPLETED';
        activeSession.endedAt = new Date().toISOString();
      }
      mockStorage.save();
      return { success: true };
    },

    abandon: async (nodeId: string, reason?: string): Promise<{ success: boolean }> => {
      if (window.attentionApp) return window.attentionApp.nodes.abandon(nodeId, reason);
      const node = mockStorage.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.status = 'ABANDONED';
        node.abandonedAt = new Date().toISOString();
      }
      const activeSession = mockStorage.getActiveSession();
      if (activeSession && activeSession.focusNodeId === nodeId) {
        activeSession.status = 'ABANDONED';
        activeSession.endedAt = new Date().toISOString();
      }
      mockStorage.save();
      return { success: true };
    },

    abandonAllOpenBranches: async (): Promise<{ count: number }> => {
      if (window.attentionApp) return window.attentionApp.nodes.abandonAllOpenBranches();
      const activeTree = mockStorage.trees.find((t) => t.status === 'ACTIVE');
      if (!activeTree) return { count: 0 };
      const now = new Date().toISOString();
      let count = 0;
      mockStorage.nodes.forEach((n) => {
        if (n.treeId === activeTree.id && n.id !== activeTree.rootNodeId && n.status === 'ONGOING') {
          n.status = 'ABANDONED';
          n.abandonedAt = now;
          count++;
        }
      });
      mockStorage.save();
      return { count };
    },

    rename: async (nodeId: string, newTitle: string): Promise<{ success: boolean }> => {
      if (window.attentionApp) return window.attentionApp.nodes.rename(nodeId, newTitle);
      const node = mockStorage.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.title = newTitle;
        node.updatedAt = new Date().toISOString();
      }
      mockStorage.save();
      return { success: true };
    },

    delete: async (nodeId: string, preferredFallbackNodeId?: string): Promise<{ success: boolean }> => {
      if (window.attentionApp) return window.attentionApp.nodes.delete(nodeId, preferredFallbackNodeId);
      const now = new Date().toISOString();
      const node = mockStorage.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.deletedAt = now;
        const markChildren = (parentId: string) => {
          mockStorage.nodes
            .filter((n) => n.parentNodeId === parentId && !n.deletedAt)
            .forEach((child) => {
              child.deletedAt = now;
              markChildren(child.id);
            });
        };
        markChildren(nodeId);

        const activeSession = mockStorage.sessions.find((s) => s.status === 'ACTIVE');
        if (activeSession && activeSession.focusNodeId === nodeId) {
          if (preferredFallbackNodeId) {
            activeSession.focusNodeId = preferredFallbackNodeId;
          } else if (node.parentNodeId) {
            const siblings = mockStorage.nodes.filter(
              (n) => n.parentNodeId === node.parentNodeId && n.id !== nodeId && !n.deletedAt
            );
            if (siblings.length > 0) {
              activeSession.focusNodeId = siblings[0].id;
            } else {
              activeSession.focusNodeId = node.parentNodeId;
            }
          }
        }
      }
      mockStorage.save();
      return { success: true };
    },

    reactivate: async (nodeId: string): Promise<{ success: boolean }> => {
      if (window.attentionApp) return window.attentionApp.nodes.reactivate(nodeId);
      const node = mockStorage.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.status = 'ONGOING';
        node.abandonedAt = null;
        node.completedAt = null;
        node.deletedAt = null;
        node.updatedAt = new Date().toISOString();
        const activeTree = mockStorage.trees.find((t) => t.id === node.treeId);
        if (activeTree && (activeTree.status === 'ABANDONED' || activeTree.status === 'COMPLETED')) {
          activeTree.status = 'ACTIVE';
          activeTree.endedAt = null;
          activeTree.updatedAt = new Date().toISOString();
        }
        const activeSession = mockStorage.getActiveSession();
        if (activeSession) {
          activeSession.focusNodeId = nodeId;
          activeSession.status = 'ACTIVE';
          activeSession.endedAt = null;
        }
      }
      mockStorage.save();
      return { success: true };
    },

    restore: async (nodeId: string): Promise<{ success: boolean }> => {
      if (window.attentionApp) return window.attentionApp.nodes.restore(nodeId);
      const node = mockStorage.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.deletedAt = null;
        const unmarkChildren = (parentId: string) => {
          mockStorage.nodes
            .filter((n) => n.parentNodeId === parentId)
            .forEach((child) => {
              child.deletedAt = null;
              unmarkChildren(child.id);
            });
        };
        unmarkChildren(nodeId);
      }
      mockStorage.save();
      return { success: true };
    }
  },

  trees: {
    delete: async (treeId: string): Promise<{ success: boolean }> => {
      if (window.attentionApp) return window.attentionApp.trees.delete(treeId);
      const tree = mockStorage.trees.find((t) => t.id === treeId);
      if (tree) {
        tree.deletedAt = new Date().toISOString();
      }
      mockStorage.save();
      return { success: true };
    },

    getActiveContext: async (): Promise<ActiveContextDTO> => {
      if (window.attentionApp) return window.attentionApp.trees.getActiveContext();
      let tree = mockStorage.getActiveTree();
      if (!tree && mockStorage.trees.length > 0) {
        const nonDeleted = mockStorage.trees.filter((t) => !t.deletedAt);
        if (nonDeleted.length > 0) {
          nonDeleted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          tree = nonDeleted[0];
          tree.status = 'ACTIVE';
          mockStorage.save();
        }
      }
      let session = mockStorage.getActiveSession();
      if (!session && tree) {
        let targetNodeId = tree.rootNodeId;
        const treeSessions = mockStorage.sessions.filter((s) => s.treeId === tree!.id);
        if (treeSessions.length > 0) {
          treeSessions.sort((a, b) => new Date(b.updatedAt || b.startedAt).getTime() - new Date(a.updatedAt || a.startedAt).getTime());
          for (const s of treeSessions) {
            if (s.focusNodeId) {
              const node = mockStorage.nodes.find((n) => n.id === s.focusNodeId && !n.deletedAt);
              if (node) {
                targetNodeId = s.focusNodeId;
                break;
              }
            }
          }
        }
        session = {
          id: uuidv4(),
          treeId: tree.id,
          focusNodeId: targetNodeId,
          previousSessionId: null,
          status: 'ACTIVE',
          startedAt: new Date().toISOString(),
          endedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          schemaVersion: 1
        };
        mockStorage.sessions.unshift(session);
        mockStorage.save();
      }
      const node = session ? mockStorage.nodes.find((n) => n.id === session.focusNodeId) || null : null;
      const nodes = tree ? mockStorage.nodes.filter((n) => n.treeId === tree!.id && !n.deletedAt) : [];
      const sessions = tree ? mockStorage.sessions.filter((s) => s.treeId === tree!.id) : [];
      const events = tree ? mockStorage.events.filter((e) => e.treeId === tree!.id) : [];

      return {
        activeTree: tree,
        activeSession: session,
        activeNode: node,
        nodes,
        sessions,
        events
      };
    },

    getTree: async (treeId: string): Promise<TreeDetailDTO | null> => {
      if (window.attentionApp) return window.attentionApp.trees.getTree(treeId);
      const tree = mockStorage.trees.find((t) => t.id === treeId && !t.deletedAt);
      if (!tree) return null;
      const nodes = mockStorage.nodes.filter((n) => n.treeId === treeId && !n.deletedAt);
      const sessions = mockStorage.sessions.filter((s) => s.treeId === treeId);
      const events = mockStorage.events.filter((e) => e.treeId === treeId);
      const originTree = tree.originTreeId ? mockStorage.trees.find((t) => t.id === tree.originTreeId) || null : null;
      const originNode = tree.originNodeId ? mockStorage.nodes.find((n) => n.id === tree.originNodeId) || null : null;

      return {
        tree,
        nodes,
        sessions,
        events,
        originTree,
        originNode
      };
    }
  },

  history: {
    list: async (): Promise<HistoryItemDTO[]> => {
      if (window.attentionApp) return window.attentionApp.history.list();
      return mockStorage.trees
        .filter((t) => !t.deletedAt)
        .map((tree) => {
          const treeNodes = mockStorage.nodes.filter((n) => n.treeId === tree.id && !n.deletedAt);
          const treeSessions = mockStorage.sessions.filter((s) => s.treeId === tree.id);
          const rootNode = treeNodes.find((n) => n.id === tree.rootNodeId) || null;

          let totalDurationSeconds = 0;
          for (const s of treeSessions) {
            const start = new Date(s.startedAt).getTime();
            const end = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
            if (!isNaN(start) && !isNaN(end) && end >= start) {
              totalDurationSeconds += Math.floor((end - start) / 1000);
            }
          }

          return {
            tree,
            rootNode,
            nodeCount: treeNodes.length,
            sessionCount: treeSessions.length,
            totalDurationSeconds,
            lastActivityAt: tree.updatedAt
          };
        });
    }
  },

  settings: {
    get: async (): Promise<AppSettings> => {
      if (window.attentionApp) return window.attentionApp.settings.get();
      return mockStorage.settings;
    },
    save: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
      if (window.attentionApp) return window.attentionApp.settings.save(settings);
      mockStorage.settings = { ...mockStorage.settings, ...settings };
      mockStorage.save();
      return mockStorage.settings;
    }
  },

  data: {
    export: async () => {
      if (window.attentionApp) return window.attentionApp.data.export();
      return {
        exportedAt: new Date().toISOString(),
        schemaVersion: 1,
        trees: mockStorage.trees,
        nodes: mockStorage.nodes,
        sessions: mockStorage.sessions,
        events: mockStorage.events,
        settings: mockStorage.settings
      };
    },
    import: async (data: any) => {
      if (window.attentionApp) return window.attentionApp.data.import(data);
      if (!data || (typeof data !== 'object' && !Array.isArray(data))) {
        throw new Error('Invalid export data payload: expected an object or array');
      }

      let rawTrees: any[] = [];
      let rawNodes: any[] = [];
      let rawSessions: any[] = [];
      let rawEvents: any[] = [];
      let rawSettings: any = null;

      if (Array.isArray(data)) {
        for (const item of data) {
          if (!item || typeof item !== 'object') continue;
          if (item.rootNodeId || item.root_node_id || item.relationshipType || item.relationship_type) {
            rawTrees.push(item);
          } else if (item.title !== undefined || item.kind !== undefined || item.parentNodeId !== undefined || item.parent_node_id !== undefined) {
            rawNodes.push(item);
          } else if (item.focusNodeId !== undefined || item.focus_node_id !== undefined) {
            rawSessions.push(item);
          } else if (item.type !== undefined) {
            rawEvents.push(item);
          }
        }
      } else {
        const payload = data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data;
        if (Array.isArray(payload.trees)) rawTrees.push(...payload.trees);
        else if (payload.tree && typeof payload.tree === 'object') rawTrees.push(payload.tree);

        if (Array.isArray(payload.nodes)) rawNodes.push(...payload.nodes);
        else if (payload.node && typeof payload.node === 'object') rawNodes.push(payload.node);

        if (Array.isArray(payload.sessions)) rawSessions.push(...payload.sessions);
        else if (payload.session && typeof payload.session === 'object') rawSessions.push(payload.session);

        if (Array.isArray(payload.events)) rawEvents.push(...payload.events);
        else if (payload.event && typeof payload.event === 'object') rawEvents.push(payload.event);

        if (payload.settings && typeof payload.settings === 'object') {
          rawSettings = payload.settings;
        }
      }

      const now = new Date().toISOString();

      for (const t of rawTrees) {
        const id = String(t.id || uuidv4());
        const rootNodeId = String(t.rootNodeId || t.root_node_id || '');
        const treeObj: Tree = {
          id,
          rootNodeId,
          originTreeId: t.originTreeId || t.origin_tree_id || null,
          originNodeId: t.originNodeId || t.origin_node_id || null,
          originSessionId: t.originSessionId || t.origin_session_id || null,
          relationshipType: t.relationshipType || t.relationship_type || 'NEW_WORK',
          status: t.status || 'ACTIVE',
          createdAt: t.createdAt || t.created_at || now,
          updatedAt: t.updatedAt || t.updated_at || now,
          endedAt: t.endedAt || t.ended_at || null,
          deletedAt: t.deletedAt || t.deleted_at || null,
          schemaVersion: Number(t.schemaVersion || t.schema_version || 1)
        };
        const idx = mockStorage.trees.findIndex((x) => x.id === id);
        if (idx >= 0) mockStorage.trees[idx] = treeObj;
        else mockStorage.trees.push(treeObj);
      }

      for (const n of rawNodes) {
        const id = String(n.id || uuidv4());
        const parentNodeId = n.parentNodeId || n.parent_node_id || null;
        const nodeObj: Node = {
          id,
          treeId: String(n.treeId || n.tree_id || (mockStorage.trees[0]?.id || '')),
          parentNodeId,
          title: String(n.title ?? 'Untitled').trim() || 'Untitled',
          kind: n.kind || (parentNodeId ? 'WORK_STEP' : 'ROOT_WORK'),
          status: n.status || 'ONGOING',
          createdAt: n.createdAt || n.created_at || now,
          updatedAt: n.updatedAt || n.updated_at || now,
          completedAt: n.completedAt || n.completed_at || null,
          abandonedAt: n.abandonedAt || n.abandoned_at || null,
          deletedAt: n.deletedAt || n.deleted_at || null,
          metadataJson: typeof n.metadataJson === 'string' ? n.metadataJson : n.metadata_json || null,
          schemaVersion: Number(n.schemaVersion || n.schema_version || 1)
        };
        const idx = mockStorage.nodes.findIndex((x) => x.id === id);
        if (idx >= 0) mockStorage.nodes[idx] = nodeObj;
        else mockStorage.nodes.push(nodeObj);
      }

      for (const s of rawSessions) {
        const id = String(s.id || uuidv4());
        const sessionObj: Session = {
          id,
          treeId: String(s.treeId || s.tree_id || (mockStorage.trees[0]?.id || '')),
          focusNodeId: String(s.focusNodeId || s.focus_node_id || ''),
          previousSessionId: s.previousSessionId || s.previous_session_id || null,
          status: s.status || 'ACTIVE',
          startedAt: s.startedAt || s.started_at || now,
          endedAt: s.endedAt || s.ended_at || null,
          createdAt: s.createdAt || s.created_at || now,
          updatedAt: s.updatedAt || s.updated_at || now,
          schemaVersion: Number(s.schemaVersion || s.schema_version || 1)
        };
        const idx = mockStorage.sessions.findIndex((x) => x.id === id);
        if (idx >= 0) mockStorage.sessions[idx] = sessionObj;
        else mockStorage.sessions.push(sessionObj);
      }

      for (const e of rawEvents) {
        const id = String(e.id || uuidv4());
        const eventObj: DomainEvent = {
          id,
          type: e.type || 'SYSTEM_SNAPSHOT',
          treeId: e.treeId || e.tree_id || null,
          sessionId: e.sessionId || e.session_id || null,
          nodeId: e.nodeId || e.node_id || null,
          occurredAt: e.occurredAt || e.occurred_at || now,
          createdAt: e.createdAt || e.created_at || now,
          sequence: typeof e.sequence === 'number' ? e.sequence : mockStorage.events.length + 1,
          payload: e.payload ?? (e.payload_json ? JSON.parse(e.payload_json) : {}),
          schemaVersion: Number(e.schemaVersion || e.schema_version || 1)
        };
        const idx = mockStorage.events.findIndex((x) => x.id === id);
        if (idx >= 0) mockStorage.events[idx] = eventObj;
        else mockStorage.events.push(eventObj);
      }

      if (rawSettings) {
        mockStorage.settings = { ...mockStorage.settings, ...rawSettings };
      }

      const targetTree = mockStorage.trees.find((t) => !t.deletedAt);
      if (targetTree) {
        mockStorage.trees.forEach((t) => {
          if (t.id === targetTree.id) t.status = 'ACTIVE';
          else if (t.status === 'ACTIVE') t.status = 'PAUSED';
        });
      }

      mockStorage.save();
      return {
        importedTrees: rawTrees.length,
        importedNodes: rawNodes.length,
        importedSessions: rawSessions.length,
        importedEvents: rawEvents.length,
        activeTreeId: targetTree ? targetTree.id : null
      };
    },
    deleteAll: async () => {
      if (window.attentionApp) return window.attentionApp.data.deleteAll();
      mockStorage.trees = [];
      mockStorage.nodes = [];
      mockStorage.sessions = [];
      mockStorage.events = [];
      mockStorage.save();
      return { success: true };
    },
    createBackup: async (): Promise<{ success: boolean; filename?: string; backupPath?: string }> => {
      if (window.attentionApp?.data?.createBackup) {
        return window.attentionApp.data.createBackup();
      }
      const data = await api.data.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wander-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true, filename: a.download };
    },
    openBackupsFolder: async (): Promise<{ success: boolean; backupsDir?: string }> => {
      if (window.attentionApp?.data?.openBackupsFolder) {
        return window.attentionApp.data.openBackupsFolder();
      }
      return { success: false };
    }
  },

  gdrive: {
    connect: async (): Promise<{ success: boolean; email?: string; error?: string }> => {
      if (window.attentionApp?.gdrive?.connect) {
        return window.attentionApp.gdrive.connect();
      }
      return { success: false, error: 'Desktop integration required' };
    },
    disconnect: async (): Promise<{ success: boolean }> => {
      if (window.attentionApp?.gdrive?.disconnect) {
        return window.attentionApp.gdrive.disconnect();
      }
      return { success: true };
    },
    getStatus: async (): Promise<{ isConnected: boolean; email?: string; lastSyncAt?: string }> => {
      if (window.attentionApp?.gdrive?.getStatus) {
        return window.attentionApp.gdrive.getStatus();
      }
      return { isConnected: false };
    },
    sync: async (): Promise<{ success: boolean; filename?: string; error?: string }> => {
      if (window.attentionApp?.gdrive?.sync) {
        return window.attentionApp.gdrive.sync();
      }
      return { success: false, error: 'Desktop integration required' };
    },
    listBackups: async (): Promise<{ id: string; name: string; size?: string; createdTime?: string }[]> => {
      if (window.attentionApp?.gdrive?.listBackups) {
        return window.attentionApp.gdrive.listBackups();
      }
      return [];
    },
    restoreLatest: async (
      fileId?: string
    ): Promise<{
      success: boolean;
      importedTrees: number;
      importedNodes: number;
      filename?: string;
      error?: string;
    }> => {
      if (window.attentionApp?.gdrive?.restoreLatest) {
        return window.attentionApp.gdrive.restoreLatest(fileId);
      }
      return { success: false, importedTrees: 0, importedNodes: 0, error: 'Desktop integration required' };
    },
    checkBackups: async (): Promise<{ id: string; name: string; size?: string; createdTime?: string } | null> => {
      if (window.attentionApp?.gdrive?.checkBackups) {
        return window.attentionApp.gdrive.checkBackups();
      }
      return null;
    }
  },

  window: {
    dock: async () => {
      if (window.attentionApp?.windowControls) {
        return window.attentionApp.windowControls.dock();
      }
    },
    expand: async () => {
      if (window.attentionApp?.windowControls) {
        return window.attentionApp.windowControls.expand();
      }
    },
    close: async () => {
      if (window.attentionApp?.windowControls) {
        return window.attentionApp.windowControls.close();
      }
    },
    minimize: async () => {
      if (window.attentionApp?.windowControls) {
        return window.attentionApp.windowControls.minimize();
      }
    },
    onDockChanged: (cb: (docked: boolean) => void) => {
      if (window.attentionApp?.windowControls) {
        return window.attentionApp.windowControls.onDockChanged(cb);
      }
      return () => {};
    },
    onDockStart: (cb: () => void) => {
      if (window.attentionApp?.windowControls?.onDockStart) {
        return window.attentionApp.windowControls.onDockStart(cb);
      }
      return () => {};
    }
  },

  updater: {
    getVersion: async (): Promise<string> => {
      if (window.attentionApp?.updater?.getVersion) {
        return window.attentionApp.updater.getVersion();
      }
      return '1.0.2';
    },
    check: async () => {
      if (window.attentionApp?.updater?.check) {
        return window.attentionApp.updater.check();
      }
      try {
        const res = await fetch('https://api.github.com/repos/guider23/Wander/releases/latest');
        if (!res.ok) return { stage: 'error', currentVersion: '1.0.2', error: `GitHub API status ${res.status}` };
        const data = await res.json();
        return {
          stage: 'available',
          currentVersion: '1.0.2',
          latestVersion: data.tag_name,
          releaseName: data.name || data.tag_name,
          releaseNotes: data.body || '',
          releaseUrl: data.html_url
        };
      } catch (err: any) {
        return { stage: 'error', currentVersion: '1.0.2', error: err.message };
      }
    },
    startDownload: async (url?: string): Promise<string> => {
      if (window.attentionApp?.updater?.startDownload) {
        return window.attentionApp.updater.startDownload(url);
      }
      if (url) window.open(url, '_blank');
      return '';
    },
    getStatus: async () => {
      if (window.attentionApp?.updater?.getStatus) {
        return window.attentionApp.updater.getStatus();
      }
      return { stage: 'idle', currentVersion: '1.0.2' };
    },
    install: async (url?: string) => {
      if (window.attentionApp?.updater?.install) {
        return window.attentionApp.updater.install(url);
      }
      if (url) window.open(url, '_blank');
      return { success: true };
    },
    onProgress: (callback: (status: any) => void) => {
      if (window.attentionApp?.updater?.onProgress) {
        return window.attentionApp.updater.onProgress(callback);
      }
      return () => {};
    }
  }
};
