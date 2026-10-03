import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getCandidateBackupDirs, findLatestJsonBackup } from '../db/connection';
import { EventRepository } from '../db/repositories/event-repository';
import { TreeRepository } from '../db/repositories/tree-repository';
import { SessionRepository } from '../db/repositories/session-repository';
import { NodeRepository } from '../db/repositories/node-repository';
import { SettingsRepository } from '../db/repositories/settings-repository';
import { GoogleDriveService } from '../services/google-drive';
import { Tree, Session, Node } from '../../src/domain/entities/types';
import { DomainEvent } from '../../src/domain/events/types';

export class ApplicationService {
  public eventRepo: EventRepository;
  public treeRepo: TreeRepository;
  public sessionRepo: SessionRepository;
  public nodeRepo: NodeRepository;
  public settingsRepo: SettingsRepository;
  public googleDrive: GoogleDriveService;
  private backupTimer: NodeJS.Timeout | null = null;

  constructor(private db: Database.Database, public userDataPath?: string) {
    this.eventRepo = new EventRepository(db);
    this.eventRepo.onEventAppended = () => {
      this.scheduleAutoBackup();
    };
    this.treeRepo = new TreeRepository(db);
    this.sessionRepo = new SessionRepository(db);
    this.nodeRepo = new NodeRepository(db);
    this.settingsRepo = new SettingsRepository(db);
    this.googleDrive = new GoogleDriveService(db);
  }

  public scheduleAutoBackup(): void {
    if (this.backupTimer) clearTimeout(this.backupTimer);
    this.backupTimer = setTimeout(() => {
      try {
        this.createBackupSnapshot('auto');
      } catch (err) {
        console.error('Failed to create auto backup:', err);
      }
    }, 1500);
  }

  public createBackupSnapshot(label: string = 'auto'): { sqlitePath?: string; jsonPath: string; filename: string } {
    const backupsDir = path.join(this.userDataPath || path.join(process.cwd(), '.data'), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const baseName = `wander-backup-${label}-${timestamp}`;

    // 1. JSON Snapshot (Human-readable, portable across any system)
    const exportData = this.exportData();
    const jsonPath = path.join(backupsDir, `${baseName}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2), 'utf-8');

    // 2. SQLite Snapshot (Binary database file backup)
    let sqlitePath: string | undefined;
    if (this.db.name && this.db.name !== ':memory:' && fs.existsSync(this.db.name)) {
      try {
        this.db.pragma('wal_checkpoint(PASSIVE)');
        sqlitePath = path.join(backupsDir, `${baseName}.sqlite`);
        fs.copyFileSync(this.db.name, sqlitePath);
      } catch (err) {
        console.warn('SQLite binary backup skipped:', err);
      }
    }

    // 3. Keep latest 25 backup files in backupsDir
    try {
      const files = fs.readdirSync(backupsDir)
        .filter((f) => f.startsWith('wander-backup-'))
        .map((f) => ({ name: f, path: path.join(backupsDir, f), mtime: fs.statSync(path.join(backupsDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > 25) {
        for (const file of files.slice(25)) {
          fs.unlinkSync(file.path);
        }
      }
    } catch (_) {}

    // 4. Cloud Backup: Sync to Google Drive AppData folder if connected
    const uploadTarget = sqlitePath || jsonPath;
    if (this.googleDrive && this.googleDrive.getStatus().isConnected && uploadTarget) {
      this.googleDrive.uploadBackupFile(uploadTarget).catch((err) => {
        console.warn('[Google Drive] Auto-upload to Google Drive skipped:', err);
      });
    }

    return {
      sqlitePath,
      jsonPath,
      filename: sqlitePath ? path.basename(sqlitePath) : `${baseName}.json`
    };
  }

  // Automated backup restoration: reads and restores data if original database was missing/empty
  public restoreFromBackupIfDbMissing(): boolean {
    if (this.db.name === ':memory:') return false;

    try {
      const trees = this.treeRepo.listAll();
      const nodes = this.nodeRepo.listAll();
      if (trees.length > 0 || nodes.length > 0) {
        return false;
      }
    } catch (err) {
      console.warn('[Database Recovery] Error checking database content:', err);
    }

    const candidateDirs = getCandidateBackupDirs(this.userDataPath, this.db.name);
    const latestJsonPath = findLatestJsonBackup(candidateDirs);

    if (latestJsonPath) {
      try {
        const content = fs.readFileSync(latestJsonPath, 'utf-8');
        const parsed = JSON.parse(content);
        const result = this.importData(parsed);
        console.log(
          `[Database Recovery] Original DB was not found. Successfully restored from JSON backup (${path.basename(latestJsonPath)}): ` +
          `${result.importedTrees} trees, ${result.importedNodes} nodes, ${result.importedSessions} sessions`
        );
        return true;
      } catch (err) {
        console.error(`[Database Recovery] Failed to restore from JSON backup (${latestJsonPath}):`, err);
      }
    }

    return false;
  }

  /**
   * Downloads and restores data from the latest (or specified) cloud backup in Google Drive.
   */
  public async restoreFromCloudBackup(fileId?: string): Promise<{
    success: boolean;
    importedTrees: number;
    importedNodes: number;
    filename?: string;
    error?: string;
  }> {
    if (!this.googleDrive || !this.googleDrive.getStatus().isConnected) {
      return { success: false, importedTrees: 0, importedNodes: 0, error: 'Google Drive is not connected' };
    }

    try {
      let targetFileId = fileId;
      let targetFileName = '';
      if (!targetFileId) {
        const latest = await this.googleDrive.getLatestCloudBackup();
        if (!latest) {
          return { success: false, importedTrees: 0, importedNodes: 0, error: 'No cloud backups found in Google Drive' };
        }
        targetFileId = latest.id;
        targetFileName = latest.name;
      }

      const backupsDir = path.join(this.userDataPath || path.join(process.cwd(), '.data'), 'backups');
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const tempLocalPath = path.join(backupsDir, `downloaded-${targetFileName || 'cloud-backup'}`);
      const downloaded = await this.googleDrive.downloadCloudBackup(targetFileId, tempLocalPath);
      if (!downloaded || !fs.existsSync(tempLocalPath)) {
        return { success: false, importedTrees: 0, importedNodes: 0, error: 'Failed to download backup from cloud' };
      }

      let result = { importedTrees: 0, importedNodes: 0, importedSessions: 0, importedEvents: 0, activeTreeId: null as string | null };

      if (tempLocalPath.endsWith('.json')) {
        const content = fs.readFileSync(tempLocalPath, 'utf-8');
        const parsed = JSON.parse(content);
        result = this.importData(parsed);
      } else {
        // SQLite file
        try {
          const sourceDb = new Database(tempLocalPath, { readonly: true });
          const trees = sourceDb.prepare('SELECT * FROM trees').all();
          const nodes = sourceDb.prepare('SELECT * FROM nodes').all();
          const sessions = sourceDb.prepare('SELECT * FROM sessions').all();
          let events: any[] = [];
          try {
            events = sourceDb.prepare('SELECT * FROM domain_events').all();
          } catch (_) {}
          let settings: any = null;
          try {
            const settingsRow = sourceDb.prepare("SELECT value_json FROM app_settings WHERE key = 'app_settings'").get() as any;
            if (settingsRow) settings = JSON.parse(settingsRow.value_json);
          } catch (_) {}
          sourceDb.close();

          result = this.importData({
            trees,
            nodes,
            sessions,
            events,
            settings
          });
        } catch (sqliteErr: any) {
          console.error('[Google Drive Recovery] SQLite import error:', sqliteErr);
          throw new Error(`Failed to parse cloud SQLite database: ${sqliteErr.message}`);
        }
      }

      try {
        if (fs.existsSync(tempLocalPath)) fs.unlinkSync(tempLocalPath);
      } catch (_) {}

      console.log(`[Google Drive Recovery] Successfully restored from cloud: ${result.importedTrees} trees, ${result.importedNodes} nodes`);
      return {
        success: true,
        importedTrees: result.importedTrees,
        importedNodes: result.importedNodes,
        filename: targetFileName
      };
    } catch (err: any) {
      console.error('[Google Drive Recovery] Cloud restore failed:', err);
      return {
        success: false,
        importedTrees: 0,
        importedNodes: 0,
        error: err.message || 'Cloud restore failed'
      };
    }
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
      }

      const tree = this.treeRepo.getById(node.treeId);
      if (tree && tree.rootNodeId === nodeId) {
        tree.status = 'COMPLETED';
        tree.endedAt = now;
        tree.updatedAt = now;
        this.treeRepo.save(tree);
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
      }

      const tree = this.treeRepo.getById(node.treeId);
      if (tree && tree.rootNodeId === nodeId) {
        tree.status = 'ABANDONED';
        tree.endedAt = now;
        tree.updatedAt = now;
        this.treeRepo.save(tree);
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

  softDeleteNode(nodeId: string, preferredFallbackNodeId?: string): void {
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
        let fallbackNodeId: string | null = null;

        // Check if preferredFallbackNodeId is valid and not being deleted
        if (preferredFallbackNodeId && !toDelete.has(preferredFallbackNodeId)) {
          const pref = this.nodeRepo.getById(preferredFallbackNodeId);
          if (pref && !pref.deletedAt && pref.treeId === node.treeId) {
            fallbackNodeId = preferredFallbackNodeId;
          }
        }

        // If no preferred fallback, search for remaining sibling under the same parent
        if (!fallbackNodeId && node.parentNodeId) {
          const siblings = allNodes.filter(
            (n) => n.parentNodeId === node.parentNodeId && !toDelete.has(n.id) && !n.deletedAt
          );
          if (siblings.length > 0) {
            siblings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            fallbackNodeId = siblings[0].id;
          }
        }

        // If still no sibling, fall back to parent node or root node
        if (!fallbackNodeId) {
          fallbackNodeId = (node.parentNodeId && !toDelete.has(node.parentNodeId))
            ? node.parentNodeId
            : (tree && !toDelete.has(tree.rootNodeId) ? tree.rootNodeId : null);
        }

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

  reactivateNode(nodeId: string): void {
    const node = this.nodeRepo.getById(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    const now = new Date().toISOString();
    const runTx = this.db.transaction(() => {
      node.status = 'ONGOING';
      node.abandonedAt = null;
      node.completedAt = null;
      node.deletedAt = null;
      node.updatedAt = now;
      this.nodeRepo.save(node);

      // Reactivate tree if it was marked abandoned or completed
      const tree = this.treeRepo.getById(node.treeId);
      if (tree && (tree.status === 'ABANDONED' || tree.status === 'COMPLETED')) {
        tree.status = 'ACTIVE';
        tree.endedAt = null;
        tree.updatedAt = now;
        this.treeRepo.save(tree);
      }

      let activeSession = this.sessionRepo.getActive();
      if (!activeSession || activeSession.treeId !== node.treeId) {
        const newSessionId = uuidv4();
        activeSession = {
          id: newSessionId,
          treeId: node.treeId,
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
        activeSession.status = 'ACTIVE';
        activeSession.focusNodeId = nodeId;
        activeSession.endedAt = null;
        activeSession.updatedAt = now;
      }
      this.sessionRepo.save(activeSession);
    });

    runTx();
  }

  restoreNode(nodeId: string): void {
    const node = this.nodeRepo.getById(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    const now = new Date().toISOString();
    const runTx = this.db.transaction(() => {
      const allNodes = this.nodeRepo.listByTreeIncludingDeleted(node.treeId);
      const toRestore = new Set<string>([nodeId]);

      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const n of allNodes) {
          if (n.parentNodeId && toRestore.has(n.parentNodeId) && !toRestore.has(n.id)) {
            toRestore.add(n.id);
            expanded = true;
          }
        }
      }

      for (const id of toRestore) {
        const n = this.nodeRepo.getById(id);
        if (n) {
          n.deletedAt = null;
          n.updatedAt = now;
          this.nodeRepo.save(n);
        }
      }

      const tree = this.treeRepo.getById(node.treeId);
      if (tree && tree.deletedAt) {
        tree.deletedAt = null;
        tree.updatedAt = now;
        this.treeRepo.save(tree);
      }

      const activeSession = this.sessionRepo.getActive();
      if (activeSession && activeSession.treeId === node.treeId) {
        activeSession.focusNodeId = nodeId;
        activeSession.updatedAt = now;
        this.sessionRepo.save(activeSession);
      }
    });

    runTx();
    this.scheduleAutoBackup();
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

  importData(data: any): {
    importedTrees: number;
    importedNodes: number;
    importedSessions: number;
    importedEvents: number;
    activeTreeId: string | null;
  } {
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
        } else if (item.type !== undefined && (item.occurredAt !== undefined || item.occurred_at !== undefined)) {
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

    // Normalize Trees
    const normalizedTrees: Tree[] = rawTrees.map((t) => {
      const id = String(t.id || uuidv4());
      const rootNodeId = String(t.rootNodeId || t.root_node_id || '');
      const originTreeId = t.originTreeId || t.origin_tree_id || null;
      const originNodeId = t.originNodeId || t.origin_node_id || null;
      const originSessionId = t.originSessionId || t.origin_session_id || null;
      const relationshipType = t.relationshipType || t.relationship_type || 'NEW_WORK';
      const status = t.status || 'ACTIVE';
      const createdAt = t.createdAt || t.created_at || now;
      const updatedAt = t.updatedAt || t.updated_at || createdAt;
      const endedAt = t.endedAt || t.ended_at || null;
      const deletedAt = t.deletedAt || t.deleted_at || null;
      const schemaVersion = Number(t.schemaVersion || t.schema_version || 1);

      return {
        id,
        rootNodeId,
        originTreeId,
        originNodeId,
        originSessionId,
        relationshipType,
        status,
        createdAt,
        updatedAt,
        endedAt,
        deletedAt,
        schemaVersion
      };
    });

    // Normalize Nodes
    const normalizedNodes: Node[] = rawNodes.map((n) => {
      const id = String(n.id || uuidv4());
      const treeId = String(n.treeId || n.tree_id || '');
      const parentNodeId = n.parentNodeId || n.parent_node_id || null;
      const title = String(n.title ?? 'Untitled').trim() || 'Untitled';
      const kind = n.kind || (parentNodeId ? 'WORK_STEP' : 'ROOT_WORK');
      const status = n.status || 'ONGOING';
      const createdAt = n.createdAt || n.created_at || now;
      const updatedAt = n.updatedAt || n.updated_at || createdAt;
      const completedAt = n.completedAt || n.completed_at || null;
      const abandonedAt = n.abandonedAt || n.abandoned_at || null;
      const deletedAt = n.deletedAt || n.deleted_at || null;
      let metadataJson: string | null = null;
      if (typeof n.metadataJson === 'string') {
        metadataJson = n.metadataJson;
      } else if (typeof n.metadata_json === 'string') {
        metadataJson = n.metadata_json;
      } else if (n.metadata && typeof n.metadata === 'object') {
        metadataJson = JSON.stringify(n.metadata);
      }
      const schemaVersion = Number(n.schemaVersion || n.schema_version || 1);

      return {
        id,
        treeId,
        parentNodeId,
        title,
        kind,
        status,
        createdAt,
        updatedAt,
        completedAt,
        abandonedAt,
        deletedAt,
        metadataJson,
        schemaVersion
      };
    });

    // If nodes exist but treeId is empty or no trees were provided, synthesize tree(s)
    const treeMap = new Map<string, Tree>();
    for (const t of normalizedTrees) {
      treeMap.set(t.id, t);
    }

    const nodesByTree = new Map<string, Node[]>();
    let fallbackTreeId: string | null = normalizedTrees.length > 0 ? normalizedTrees[0].id : null;

    for (const n of normalizedNodes) {
      if (!n.treeId) {
        if (!fallbackTreeId) {
          fallbackTreeId = uuidv4();
        }
        n.treeId = fallbackTreeId;
      }
      const list = nodesByTree.get(n.treeId) || [];
      list.push(n);
      nodesByTree.set(n.treeId, list);
    }

    for (const [tId, tNodes] of nodesByTree.entries()) {
      if (!treeMap.has(tId)) {
        const existingInDb = this.treeRepo.getById(tId);
        if (!existingInDb) {
          const rootNode = tNodes.find((n) => !n.parentNodeId || n.kind === 'ROOT_WORK') || tNodes[0];
          const newTree: Tree = {
            id: tId,
            rootNodeId: rootNode.id,
            originTreeId: null,
            originNodeId: null,
            originSessionId: null,
            relationshipType: 'NEW_WORK',
            status: 'ACTIVE',
            createdAt: rootNode.createdAt || now,
            updatedAt: now,
            endedAt: null,
            deletedAt: null,
            schemaVersion: 1
          };
          normalizedTrees.push(newTree);
          treeMap.set(tId, newTree);
        }
      }
    }

    for (const t of normalizedTrees) {
      if (!t.rootNodeId) {
        const tNodes = nodesByTree.get(t.id) || [];
        const root = tNodes.find((n) => !n.parentNodeId || n.kind === 'ROOT_WORK') || tNodes[0];
        if (root) {
          t.rootNodeId = root.id;
        }
      }
    }

    // Normalize Sessions
    const normalizedSessions: Session[] = rawSessions.map((s) => {
      const id = String(s.id || uuidv4());
      const treeId = String(s.treeId || s.tree_id || fallbackTreeId || '');
      const focusNodeId = String(s.focusNodeId || s.focus_node_id || '');
      const previousSessionId = s.previousSessionId || s.previous_session_id || null;
      const status = s.status || 'ACTIVE';
      const startedAt = s.startedAt || s.started_at || now;
      const endedAt = s.endedAt || s.ended_at || null;
      const createdAt = s.createdAt || s.created_at || startedAt;
      const updatedAt = s.updatedAt || s.updated_at || now;
      const schemaVersion = Number(s.schemaVersion || s.schema_version || 1);

      return {
        id,
        treeId,
        focusNodeId,
        previousSessionId,
        status,
        startedAt,
        endedAt,
        createdAt,
        updatedAt,
        schemaVersion
      };
    });

    // Normalize Events
    const normalizedEvents: DomainEvent[] = rawEvents.map((e) => {
      const id = String(e.id || uuidv4());
      const type = String(e.type || 'SYSTEM_SNAPSHOT') as any;
      const treeId = e.treeId || e.tree_id || null;
      const sessionId = e.sessionId || e.session_id || null;
      const nodeId = e.nodeId || e.node_id || null;
      const occurredAt = e.occurredAt || e.occurred_at || now;
      const createdAt = e.createdAt || e.created_at || occurredAt;
      const sequence = typeof e.sequence === 'number' ? e.sequence : undefined;
      let payload = e.payload;
      if (payload === undefined && e.payload_json) {
        try {
          payload = JSON.parse(e.payload_json);
        } catch {
          payload = e.payload_json;
        }
      }
      if (payload === undefined) {
        payload = {};
      }
      const schemaVersion = Number(e.schemaVersion || e.schema_version || 1);

      return {
        id,
        type,
        treeId,
        sessionId,
        nodeId,
        occurredAt,
        createdAt,
        sequence,
        payload,
        schemaVersion
      } as DomainEvent;
    });

    // Determine target tree to activate
    let treeToActivate: Tree | null = null;
    const nonDeletedTrees = normalizedTrees.filter((t) => !t.deletedAt);
    if (nonDeletedTrees.length > 0) {
      const activeCandidate = nonDeletedTrees.find((t) => t.status === 'ACTIVE');
      if (activeCandidate) {
        treeToActivate = activeCandidate;
      } else {
        const sorted = [...nonDeletedTrees].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        treeToActivate = sorted[0];
      }
    }

    const runTx = this.db.transaction(() => {
      for (const t of normalizedTrees) {
        this.treeRepo.save(t);
      }
      for (const n of normalizedNodes) {
        this.nodeRepo.save(n);
      }
      for (const s of normalizedSessions) {
        this.sessionRepo.save(s);
      }
      for (const e of normalizedEvents) {
        this.eventRepo.save(e);
      }
      if (rawSettings) {
        this.settingsRepo.saveSettings(rawSettings);
      }

      if (treeToActivate) {
        const previousActiveSession = this.sessionRepo.getActive();

        // Pause all other active trees in DB
        this.db.prepare("UPDATE trees SET status = 'PAUSED', updated_at = ? WHERE status = 'ACTIVE' AND id != ?").run(now, treeToActivate.id);

        // Pause all other active sessions in DB
        this.db.prepare("UPDATE sessions SET status = 'PAUSED', ended_at = ?, updated_at = ? WHERE status = 'ACTIVE' AND tree_id != ?").run(now, now, treeToActivate.id);

        treeToActivate.status = 'ACTIVE';
        treeToActivate.updatedAt = now;
        this.treeRepo.save(treeToActivate);

        let activeSessionForTree = this.sessionRepo.getActive();
        if (!activeSessionForTree || activeSessionForTree.treeId !== treeToActivate.id) {
          let targetFocusNodeId = treeToActivate.rootNodeId;
          const treeSessions = this.sessionRepo.listByTree(treeToActivate.id);
          if (treeSessions.length > 0) {
            treeSessions.sort(
              (a, b) => new Date(b.updatedAt || b.startedAt).getTime() - new Date(a.updatedAt || a.startedAt).getTime()
            );
            for (const s of treeSessions) {
              if (s.focusNodeId) {
                const node = this.nodeRepo.getById(s.focusNodeId);
                if (node && !node.deletedAt) {
                  targetFocusNodeId = s.focusNodeId;
                  break;
                }
              }
            }
          }

          const newSessionId = uuidv4();
          const newSession: Session = {
            id: newSessionId,
            treeId: treeToActivate.id,
            focusNodeId: targetFocusNodeId,
            previousSessionId: previousActiveSession ? previousActiveSession.id : null,
            status: 'ACTIVE',
            startedAt: now,
            endedAt: null,
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1
          };
          this.sessionRepo.save(newSession);
        }
      }
    });

    runTx();

    try {
      this.scheduleAutoBackup();
    } catch (_) {}

    return {
      importedTrees: normalizedTrees.length,
      importedNodes: normalizedNodes.length,
      importedSessions: normalizedSessions.length,
      importedEvents: normalizedEvents.length,
      activeTreeId: treeToActivate ? treeToActivate.id : null
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
