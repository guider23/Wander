import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { EventRepository } from '../db/repositories/event-repository';
import { TreeRepository } from '../db/repositories/tree-repository';
import { SessionRepository } from '../db/repositories/session-repository';
import { NodeRepository } from '../db/repositories/node-repository';
import { SettingsRepository } from '../db/repositories/settings-repository';
import { Tree, Session, Node } from '../../src/domain/entities/types';

export class ApplicationService {
  public eventRepo: EventRepository;
  public treeRepo: TreeRepository;
  public sessionRepo: SessionRepository;
  public nodeRepo: NodeRepository;
  public settingsRepo: SettingsRepository;

  constructor(private db: Database.Database) {
    this.eventRepo = new EventRepository(db);
    this.treeRepo = new TreeRepository(db);
    this.sessionRepo = new SessionRepository(db);
    this.nodeRepo = new NodeRepository(db);
    this.settingsRepo = new SettingsRepository(db);
  }

  // Crash / shutdown recovery on startup: seamlessly restore exact last focus
  recoverInterruptedSessions(): void {
    const activeSession = this.sessionRepo.getActive();
    if (activeSession) {
      const now = new Date().toISOString();
      const lastFocusNodeId = activeSession.focusNodeId;
      const lastTreeId = activeSession.treeId;

      const runTx = this.db.transaction(() => {
        this.eventRepo.append({
          id: uuidv4(),
          type: 'SESSION_INTERRUPTED',
          treeId: lastTreeId,
          sessionId: activeSession.id,
          nodeId: lastFocusNodeId,
          occurredAt: now,
          createdAt: now,
          schemaVersion: 1,
          payload: { reason: 'Application restarted' }
        });

        activeSession.status = 'INTERRUPTED';
        activeSession.endedAt = now;
        activeSession.updatedAt = now;
        this.sessionRepo.save(activeSession);

        const tree = this.treeRepo.getById(lastTreeId);
        if (tree && !tree.deletedAt) {
          tree.status = 'ACTIVE';
          tree.updatedAt = now;
          this.treeRepo.save(tree);

          const resumedSessionId = uuidv4();
          const resumedSession: Session = {
            id: resumedSessionId,
            treeId: lastTreeId,
            focusNodeId: lastFocusNodeId,
            previousSessionId: activeSession.id,
            status: 'ACTIVE',
            startedAt: now,
            endedAt: null,
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1
          };
          this.sessionRepo.save(resumedSession);
        }
      });
      runTx();
    }
  }

  startWork(title: string): { tree: Tree; session: Session; node: Node } {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('Work title cannot be empty');

    const treeId = uuidv4();
    const nodeId = uuidv4();
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const runTx = this.db.transaction(() => {
      // Pause any existing active tree and session
      const currentActiveSession = this.sessionRepo.getActive();
      if (currentActiveSession) {
        currentActiveSession.status = 'PAUSED';
        currentActiveSession.endedAt = now;
        currentActiveSession.updatedAt = now;
        this.sessionRepo.save(currentActiveSession);
      }

      const currentActiveTree = this.treeRepo.getActive();
      if (currentActiveTree) {
        currentActiveTree.status = 'PAUSED';
        currentActiveTree.updatedAt = now;
        this.treeRepo.save(currentActiveTree);
      }

      const rootNode: Node = {
        id: nodeId,
        treeId,
        parentNodeId: null,
        title: trimmed,
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
      this.nodeRepo.save(rootNode);

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
      this.treeRepo.save(tree);

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
      this.sessionRepo.save(session);

      this.eventRepo.append({
        id: uuidv4(),
        type: 'WORK_STARTED',
        treeId,
        sessionId,
        nodeId,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
        payload: { title: trimmed }
      });

      return { tree, session, node: rootNode };
    });

    return runTx();
  }

  captureThought(title: string, parentNodeId: string): Node {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('Thought title cannot be empty');

    const parentNode = this.nodeRepo.getById(parentNodeId);
    if (!parentNode) throw new Error(`Parent node ${parentNodeId} not found`);

    const nodeId = uuidv4();
    const now = new Date().toISOString();

    const runTx = this.db.transaction(() => {
      const thoughtNode: Node = {
        id: nodeId,
        treeId: parentNode.treeId,
        parentNodeId,
        title: trimmed,
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
      this.nodeRepo.save(thoughtNode);

      const activeSession = this.sessionRepo.getActive();
      this.eventRepo.append({
        id: uuidv4(),
        type: 'THOUGHT_CAPTURED',
        treeId: parentNode.treeId,
        sessionId: activeSession ? activeSession.id : null,
        nodeId,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
        payload: {
          title: trimmed,
          parentNodeId
        }
      });

      return thoughtNode;
    });

    return runTx();
  }

  addStep(title: string, parentNodeId: string): { node: Node; session: Session } {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('Step title cannot be empty');

    const parentNode = this.nodeRepo.getById(parentNodeId);
    if (!parentNode) throw new Error(`Parent node ${parentNodeId} not found`);

    const nodeId = uuidv4();
    const now = new Date().toISOString();

    const runTx = this.db.transaction(() => {
      const stepNode: Node = {
        id: nodeId,
        treeId: parentNode.treeId,
        parentNodeId,
        title: trimmed,
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
      this.nodeRepo.save(stepNode);

      let activeSession = this.sessionRepo.getActive();
      if (!activeSession || activeSession.treeId !== parentNode.treeId) {
        // If not currently in this tree, start a new active session
        const newSessionId = uuidv4();
        activeSession = {
          id: newSessionId,
          treeId: parentNode.treeId,
          focusNodeId: nodeId,
          previousSessionId: activeSession ? activeSession.id : null,
          status: 'ACTIVE',
          startedAt: now,
          endedAt: null,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1
        };
      } else {
        activeSession.focusNodeId = nodeId;
        activeSession.updatedAt = now;
      }
      this.sessionRepo.save(activeSession);

      this.eventRepo.append({
        id: uuidv4(),
        type: 'WORK_STEP_ADDED',
        treeId: parentNode.treeId,
        sessionId: activeSession.id,
        nodeId,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
        payload: {
          title: trimmed,
          parentNodeId
        }
      });

      return { node: stepNode, session: activeSession };
    });

    return runTx();
  }

  createBranch(title: string, parentNodeId: string): Node {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('Branch title cannot be empty');

    const parentNode = this.nodeRepo.getById(parentNodeId);
    if (!parentNode) throw new Error(`Parent node ${parentNodeId} not found`);

    const nodeId = uuidv4();
    const now = new Date().toISOString();

    const runTx = this.db.transaction(() => {
      const branchNode: Node = {
        id: nodeId,
        treeId: parentNode.treeId,
        parentNodeId,
        title: trimmed,
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
      this.nodeRepo.save(branchNode);

      const activeSession = this.sessionRepo.getActive();
      this.eventRepo.append({
        id: uuidv4(),
        type: 'BRANCH_CREATED',
        treeId: parentNode.treeId,
        sessionId: activeSession ? activeSession.id : null,
        nodeId,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
        payload: {
          title: trimmed,
          parentNodeId
        }
      });

      return branchNode;
    });

    return runTx();
  }

  switchFocus(targetNodeId: string): Session {
    const targetNode = this.nodeRepo.getById(targetNodeId);
    if (!targetNode) throw new Error(`Target node ${targetNodeId} not found`);

    const now = new Date().toISOString();
    const newSessionId = uuidv4();

    const runTx = this.db.transaction(() => {
      const currentActiveSession = this.sessionRepo.getActive();
      if (currentActiveSession) {
        currentActiveSession.status = 'PAUSED';
        currentActiveSession.endedAt = now;
        currentActiveSession.updatedAt = now;
        this.sessionRepo.save(currentActiveSession);
      }

      // Check if target tree is different
      const currentActiveTree = this.treeRepo.getActive();
      if (currentActiveTree && currentActiveTree.id !== targetNode.treeId) {
        currentActiveTree.status = 'PAUSED';
        currentActiveTree.updatedAt = now;
        this.treeRepo.save(currentActiveTree);
      }

      const targetTree = this.treeRepo.getById(targetNode.treeId);
      if (targetTree) {
        targetTree.status = 'ACTIVE';
        targetTree.updatedAt = now;
        this.treeRepo.save(targetTree);
      }

      const newSession: Session = {
        id: newSessionId,
        treeId: targetNode.treeId,
        focusNodeId: targetNodeId,
        previousSessionId: currentActiveSession ? currentActiveSession.id : null,
        status: 'ACTIVE',
        startedAt: now,
        endedAt: null,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1
      };
      this.sessionRepo.save(newSession);

      this.eventRepo.append({
        id: uuidv4(),
        type: 'FOCUS_SWITCHED',
        treeId: targetNode.treeId,
        sessionId: newSessionId,
        nodeId: targetNodeId,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
        payload: {
          previousSessionId: currentActiveSession ? currentActiveSession.id : null,
          targetNodeId
        }
      });

      return newSession;
    });

    return runTx();
  }

  pauseActiveSession(): void {
    const activeSession = this.sessionRepo.getActive();
    if (!activeSession) return;

    const now = new Date().toISOString();
    const runTx = this.db.transaction(() => {
      activeSession.status = 'PAUSED';
      activeSession.endedAt = now;
      activeSession.updatedAt = now;
      this.sessionRepo.save(activeSession);

      const tree = this.treeRepo.getById(activeSession.treeId);
      if (tree && tree.status === 'ACTIVE') {
        tree.status = 'PAUSED';
        tree.updatedAt = now;
        this.treeRepo.save(tree);
      }

      this.eventRepo.append({
        id: uuidv4(),
        type: 'SESSION_PAUSED',
        treeId: activeSession.treeId,
        sessionId: activeSession.id,
        nodeId: activeSession.focusNodeId,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
        payload: {}
      });
    });

    runTx();
  }

  resumeSession(treeId: string, focusNodeId?: string): Session {
    const tree = this.treeRepo.getById(treeId);
    if (!tree) throw new Error(`Tree ${treeId} not found`);

    const now = new Date().toISOString();
    const newSessionId = uuidv4();

    // Start where the user focused at last in this tree
    let targetNodeId = focusNodeId;
    if (!targetNodeId) {
      const treeSessions = this.sessionRepo.listByTree(treeId);
      if (treeSessions.length > 0) {
        treeSessions.sort((a: Session, b: Session) => new Date(b.updatedAt || b.startedAt).getTime() - new Date(a.updatedAt || a.startedAt).getTime());
        for (const s of treeSessions) {
          if (s.focusNodeId) {
            const node = this.nodeRepo.getById(s.focusNodeId);
            if (node && !node.deletedAt) {
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

    const runTx = this.db.transaction(() => {
      // Pause any current active session
      const currentActiveSession = this.sessionRepo.getActive();
      if (currentActiveSession) {
        currentActiveSession.status = 'PAUSED';
        currentActiveSession.endedAt = now;
        currentActiveSession.updatedAt = now;
        this.sessionRepo.save(currentActiveSession);
      }

      const currentActiveTree = this.treeRepo.getActive();
      if (currentActiveTree && currentActiveTree.id !== treeId) {
        currentActiveTree.status = 'PAUSED';
        currentActiveTree.updatedAt = now;
        this.treeRepo.save(currentActiveTree);
      }

      tree.status = 'ACTIVE';
      tree.updatedAt = now;
      this.treeRepo.save(tree);

      const newSession: Session = {
        id: newSessionId,
        treeId,
        focusNodeId: targetNodeId,
        previousSessionId: currentActiveSession ? currentActiveSession.id : null,
        status: 'ACTIVE',
        startedAt: now,
        endedAt: null,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1
      };
      this.sessionRepo.save(newSession);

      this.eventRepo.append({
        id: uuidv4(),
        type: 'SESSION_RESUMED',
        treeId,
        sessionId: newSessionId,
        nodeId: targetNodeId,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
        payload: {
          focusNodeId: targetNodeId
        }
      });

      return newSession;
    });

    return runTx();
  }

  resumeContinuation(originTreeId: string, originNodeId: string, rootTitle?: string): { tree: Tree; session: Session; node: Node } {
    const originTree = this.treeRepo.getById(originTreeId);
    if (!originTree) throw new Error(`Origin tree ${originTreeId} not found`);
    const originNode = this.nodeRepo.getById(originNodeId);
    if (!originNode) throw new Error(`Origin node ${originNodeId} not found`);

    const now = new Date().toISOString();
    const newTreeId = uuidv4();
    const newNodeId = uuidv4();
    const newSessionId = uuidv4();
    const title = rootTitle || `Continue: ${originNode.title}`;

    const runTx = this.db.transaction(() => {
      // Pause current active tree/session
      const currentActiveSession = this.sessionRepo.getActive();
      if (currentActiveSession) {
        currentActiveSession.status = 'PAUSED';
        currentActiveSession.endedAt = now;
        currentActiveSession.updatedAt = now;
        this.sessionRepo.save(currentActiveSession);
      }
      const currentActiveTree = this.treeRepo.getActive();
      if (currentActiveTree) {
        currentActiveTree.status = 'PAUSED';
        currentActiveTree.updatedAt = now;
        this.treeRepo.save(currentActiveTree);
      }

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
      this.nodeRepo.save(rootNode);

      const newTree: Tree = {
        id: newTreeId,
        rootNodeId: newNodeId,
        originTreeId,
        originNodeId,
        originSessionId: currentActiveSession ? currentActiveSession.id : null,
        relationshipType: 'CONTINUATION',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        endedAt: null,
        deletedAt: null,
        schemaVersion: 1
      };
      this.treeRepo.save(newTree);

      const newSession: Session = {
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
      this.sessionRepo.save(newSession);

      this.eventRepo.append({
        id: uuidv4(),
        type: 'RETURNED_TO_NODE',
        treeId: originTreeId,
        sessionId: null,
        nodeId: originNodeId,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
        payload: {
          targetTreeId: originTreeId,
          targetNodeId: originNodeId
        }
      });

      this.eventRepo.append({
        id: uuidv4(),
        type: 'TREE_CONTINUATION_STARTED',
        treeId: newTreeId,
        sessionId: newSessionId,
        nodeId: newNodeId,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
        payload: {
          originTreeId,
          originNodeId,
          originSessionId: currentActiveSession ? currentActiveSession.id : null,
          rootTitle: title,
          relationshipType: 'CONTINUATION'
        }
      });

      return { tree: newTree, session: newSession, node: rootNode };
    });

    return runTx();
  }

  completePath(nodeId: string, note?: string): void {
    const node = this.nodeRepo.getById(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    const now = new Date().toISOString();
    const runTx = this.db.transaction(() => {
      node.status = 'COMPLETED';
      node.completedAt = now;
      node.updatedAt = now;
      this.nodeRepo.save(node);

      const activeSession = this.sessionRepo.getActive();
      if (activeSession && activeSession.focusNodeId === nodeId) {
        activeSession.status = 'COMPLETED';
        activeSession.endedAt = now;
        activeSession.updatedAt = now;
        this.sessionRepo.save(activeSession);

        const tree = this.treeRepo.getById(node.treeId);
        if (tree && tree.rootNodeId === nodeId) {
          tree.status = 'COMPLETED';
          tree.endedAt = now;
          tree.updatedAt = now;
          this.treeRepo.save(tree);
        }
      }

      this.eventRepo.append({
        id: uuidv4(),
        type: 'PATH_COMPLETED',
        treeId: node.treeId,
        sessionId: activeSession ? activeSession.id : null,
        nodeId,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
        payload: { nodeId, note }
      });
    });

    runTx();
  }

  abandonPath(nodeId: string, reason?: string): void {
    const node = this.nodeRepo.getById(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    const now = new Date().toISOString();
    const runTx = this.db.transaction(() => {
      node.status = 'ABANDONED';
      node.abandonedAt = now;
      node.updatedAt = now;
      this.nodeRepo.save(node);

      const activeSession = this.sessionRepo.getActive();
      if (activeSession && activeSession.focusNodeId === nodeId) {
        activeSession.status = 'ABANDONED';
        activeSession.endedAt = now;
        activeSession.updatedAt = now;
        this.sessionRepo.save(activeSession);

        const tree = this.treeRepo.getById(node.treeId);
        if (tree && tree.rootNodeId === nodeId) {
          tree.status = 'ABANDONED';
          tree.endedAt = now;
          tree.updatedAt = now;
          this.treeRepo.save(tree);
        }
      }

      this.eventRepo.append({
        id: uuidv4(),
        type: 'PATH_ABANDONED',
        treeId: node.treeId,
        sessionId: activeSession ? activeSession.id : null,
        nodeId,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
        payload: { nodeId, reason }
      });
    });

    runTx();
  }

  abandonAllOpenBranches(): { count: number } {
    const activeTree = this.treeRepo.getActive();
    if (!activeTree) return { count: 0 };
    const allNodes = this.nodeRepo.listByTree(activeTree.id);
    const now = new Date().toISOString();

    const runTx = this.db.transaction(() => {
      let count = 0;
      for (const node of allNodes) {
        if (node.id !== activeTree.rootNodeId && node.status === 'ONGOING') {
          node.status = 'ABANDONED';
          node.abandonedAt = now;
          node.updatedAt = now;
          this.nodeRepo.save(node);

          this.eventRepo.append({
            id: uuidv4(),
            type: 'PATH_ABANDONED',
            treeId: activeTree.id,
            sessionId: null,
            nodeId: node.id,
            occurredAt: now,
            createdAt: now,
            schemaVersion: 1,
            payload: { nodeId: node.id, reason: 'Dropped all uncompleted branches' }
          });
          count++;
        }
      }

      const activeSession = this.sessionRepo.getActive();
      if (activeSession && activeSession.focusNodeId !== activeTree.rootNodeId) {
        const focusNode = this.nodeRepo.getById(activeSession.focusNodeId);
        if (focusNode && focusNode.status === 'ABANDONED') {
          activeSession.focusNodeId = activeTree.rootNodeId;
          activeSession.updatedAt = now;
          this.sessionRepo.save(activeSession);
        }
      }

      return { count };
    });

    return runTx();
  }

  renameNode(nodeId: string, newTitle: string): void {
    const trimmed = newTitle.trim();
    if (!trimmed) throw new Error('New title cannot be empty');
    const node = this.nodeRepo.getById(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    const now = new Date().toISOString();
    const oldTitle = node.title;

    const runTx = this.db.transaction(() => {
      node.title = trimmed;
      node.updatedAt = now;
      this.nodeRepo.save(node);

      this.eventRepo.append({
        id: uuidv4(),
        type: 'NODE_RENAMED',
        treeId: node.treeId,
        sessionId: null,
        nodeId,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
        payload: { oldTitle, newTitle: trimmed }
      });
    });

    runTx();
  }

  softDeleteNode(nodeId: string): void {
    const node = this.nodeRepo.getById(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    const now = new Date().toISOString();
    const runTx = this.db.transaction(() => {
      // Find all descendants of nodeId
      const allNodes = this.nodeRepo.listByTree(node.treeId);
      const toDelete = new Set<string>([nodeId]);

      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const n of allNodes) {
          if (n.parentNodeId && toDelete.has(n.parentNodeId) && !toDelete.has(n.id)) {
            toDelete.add(n.id);
            expanded = true;
          }
        }
      }

      for (const id of toDelete) {
        const n = this.nodeRepo.getById(id);
        if (n) {
          n.deletedAt = now;
          n.updatedAt = now;
          this.nodeRepo.save(n);
        }
      }

      // If the node being deleted is root, delete the tree too
      const tree = this.treeRepo.getById(node.treeId);
      if (tree && tree.rootNodeId === nodeId) {
        tree.deletedAt = now;
        tree.updatedAt = now;
        this.treeRepo.save(tree);
      }

      const activeSession = this.sessionRepo.getActive();
      if (activeSession && toDelete.has(activeSession.focusNodeId)) {
        // Redirect focus to parent node or root node
        const fallbackNodeId = (node.parentNodeId && !toDelete.has(node.parentNodeId))
          ? node.parentNodeId
          : (tree && !toDelete.has(tree.rootNodeId) ? tree.rootNodeId : null);

        if (fallbackNodeId) {
          activeSession.focusNodeId = fallbackNodeId;
          activeSession.updatedAt = now;
          this.sessionRepo.save(activeSession);
        } else {
          activeSession.status = 'PAUSED';
          activeSession.endedAt = now;
          activeSession.updatedAt = now;
          this.sessionRepo.save(activeSession);
        }
      }

      this.eventRepo.append({
        id: uuidv4(),
        type: 'NODE_DELETED',
        treeId: node.treeId,
        sessionId: activeSession ? activeSession.id : null,
        nodeId,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
        payload: { deletedCount: toDelete.size }
      });
    });

    runTx();
  }

  softDeleteTree(treeId: string): void {
    const tree = this.treeRepo.getById(treeId);
    if (!tree) throw new Error(`Tree ${treeId} not found`);

    const now = new Date().toISOString();
    const runTx = this.db.transaction(() => {
      tree.deletedAt = now;
      tree.updatedAt = now;
      this.treeRepo.save(tree);

      const activeSession = this.sessionRepo.getActive();
      if (activeSession && activeSession.treeId === treeId) {
        activeSession.status = 'PAUSED';
        activeSession.endedAt = now;
        activeSession.updatedAt = now;
        this.sessionRepo.save(activeSession);
      }

      this.eventRepo.append({
        id: uuidv4(),
        type: 'TREE_DELETED',
        treeId,
        sessionId: null,
        nodeId: null,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
        payload: {}
      });
    });

    runTx();
  }

  getActiveContext() {
    let currentTree = this.treeRepo.getActive();
    if (!currentTree) {
      const allTrees = this.treeRepo.listAll().filter((t) => !t.deletedAt);
      if (allTrees.length > 0) {
        allTrees.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        currentTree = allTrees[0];
        currentTree.status = 'ACTIVE';
        currentTree.updatedAt = new Date().toISOString();
        this.treeRepo.save(currentTree);
      }
    }

    let activeSession = this.sessionRepo.getActive();
    if (!activeSession && currentTree) {
      // Restore where the user focused at last in this tree
      let lastFocusNodeId = currentTree.rootNodeId;
      const treeSessions = this.sessionRepo.listByTree(currentTree.id);
      if (treeSessions.length > 0) {
        treeSessions.sort((a: Session, b: Session) => new Date(b.updatedAt || b.startedAt).getTime() - new Date(a.updatedAt || a.startedAt).getTime());
        for (const s of treeSessions) {
          if (s.focusNodeId) {
            const node = this.nodeRepo.getById(s.focusNodeId);
            if (node && !node.deletedAt) {
              lastFocusNodeId = s.focusNodeId;
              break;
            }
          }
        }
      }

      const now = new Date().toISOString();
      const newSessionId = uuidv4();
      activeSession = {
        id: newSessionId,
        treeId: currentTree.id,
        focusNodeId: lastFocusNodeId,
        previousSessionId: null,
        status: 'ACTIVE',
        startedAt: now,
        endedAt: null,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1
      };
      this.sessionRepo.save(activeSession);
    }

    const activeNode = activeSession ? this.nodeRepo.getById(activeSession.focusNodeId) : null;
    const treeId = currentTree ? currentTree.id : null;

    const nodes = treeId ? this.nodeRepo.listByTree(treeId) : [];
    const sessions = treeId ? this.sessionRepo.listByTree(treeId) : [];
    const events = treeId ? this.eventRepo.listByTree(treeId) : [];

    return {
      activeTree: currentTree,
      activeSession,
      activeNode,
      nodes,
      sessions,
      events
    };
  }

  getTree(treeId: string) {
    const tree = this.treeRepo.getById(treeId);
    if (!tree) return null;
    const nodes = this.nodeRepo.listByTree(treeId);
    const sessions = this.sessionRepo.listByTree(treeId);
    const events = this.eventRepo.listByTree(treeId);

    // If continuation, get origin info
    let originNode: Node | null = null;
    let originTree: Tree | null = null;
    if (tree.originTreeId) {
      originTree = this.treeRepo.getById(tree.originTreeId);
    }
    if (tree.originNodeId) {
      originNode = this.nodeRepo.getById(tree.originNodeId);
    }

    return {
      tree,
      nodes,
      sessions,
      events,
      originTree,
      originNode
    };
  }

  listHistory() {
    const trees = this.treeRepo.listAll();
    const allNodes = this.nodeRepo.listAll();
    const allSessions = this.sessionRepo.listAll();

    const nodesByTree = new Map<string, Node[]>();
    for (const node of allNodes) {
      const list = nodesByTree.get(node.treeId) || [];
      list.push(node);
      nodesByTree.set(node.treeId, list);
    }

    const sessionsByTree = new Map<string, Session[]>();
    for (const session of allSessions) {
      const list = sessionsByTree.get(session.treeId) || [];
      list.push(session);
      sessionsByTree.set(session.treeId, list);
    }

    return trees.map((tree) => {
      const treeNodes = nodesByTree.get(tree.id) || [];
      const treeSessions = sessionsByTree.get(tree.id) || [];
      const rootNode = treeNodes.find((n) => n.id === tree.rootNodeId) || null;

      // Calculate total duration in seconds from sessions
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

  exportData() {
    const trees = this.treeRepo.listAll();
    const nodes = this.nodeRepo.listAll();
    const sessions = this.sessionRepo.listAll();
    const events = this.eventRepo.listAll();
    const settings = this.settingsRepo.getSettings();

    return {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      trees,
      nodes,
      sessions,
      events,
      settings
    };
  }

  importData(data: any): { importedTrees: number; importedNodes: number; importedEvents: number } {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid export data payload');
    }
    const { trees = [], nodes = [], sessions = [], events = [], settings } = data;

    const runTx = this.db.transaction(() => {
      for (const t of trees) {
        this.treeRepo.save(t);
      }
      for (const n of nodes) {
        this.nodeRepo.save(n);
      }
      for (const s of sessions) {
        this.sessionRepo.save(s);
      }
      for (const e of events) {
        this.eventRepo.append(e);
      }
      if (settings) {
        this.settingsRepo.saveSettings(settings);
      }
    });

    runTx();
    return {
      importedTrees: trees.length,
      importedNodes: nodes.length,
      importedEvents: events.length
    };
  }

  deleteAllData(): void {
    const runTx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM events').run();
      this.db.prepare('DELETE FROM sessions').run();
      this.db.prepare('DELETE FROM nodes').run();
      this.db.prepare('DELETE FROM trees').run();
    });
    runTx();
  }
}
