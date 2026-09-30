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
    highContrast: false
  };

  constructor() {
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

  save() {
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

    delete: async (nodeId: string): Promise<{ success: boolean }> => {
      if (window.attentionApp) return window.attentionApp.nodes.delete(nodeId);
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
      if (data.trees) mockStorage.trees = data.trees;
      if (data.nodes) mockStorage.nodes = data.nodes;
      if (data.sessions) mockStorage.sessions = data.sessions;
      if (data.events) mockStorage.events = data.events;
      if (data.settings) mockStorage.settings = data.settings;
      mockStorage.save();
      return {
        importedTrees: (data.trees || []).length,
        importedNodes: (data.nodes || []).length,
        importedEvents: (data.events || []).length
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
    check: async () => {
      if (window.attentionApp?.updater) {
        return window.attentionApp.updater.check();
      }
      try {
        const res = await fetch('https://api.github.com/repos/guider23/Wander/releases/latest');
        if (!res.ok) return { available: false, error: `GitHub API status ${res.status}` };
        const data = await res.json();
        return {
          available: true,
          tagName: data.tag_name,
          name: data.name || data.tag_name,
          body: data.body || '',
          publishedAt: data.published_at,
          htmlUrl: data.html_url,
          assets: data.assets?.map((a: any) => ({
            name: a.name,
            browserDownloadUrl: a.browser_download_url,
            size: a.size
          })) || []
        };
      } catch (err: any) {
        return { available: false, error: err.message };
      }
    },
    install: async (url: string) => {
      if (window.attentionApp?.updater) {
        return window.attentionApp.updater.install(url);
      }
      window.open(url, '_blank');
      return { success: true };
    }
  }
};
