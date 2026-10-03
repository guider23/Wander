import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { initDatabaseSchema } from '../../electron/db/schema';
import { createDatabaseConnection } from '../../electron/db/connection';
import { ApplicationService } from '../../electron/application/service';

describe('ApplicationService Integration Tests', () => {
  let db: Database.Database;
  let service: ApplicationService;

  beforeEach(() => {
    db = new Database(':memory:');
    initDatabaseSchema(db);
    service = new ApplicationService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('starts work and creates root node, tree, and active session', () => {
    const result = service.startWork('Instagram DM');
    expect(result.tree.id).toBeDefined();
    expect(result.tree.status).toBe('ACTIVE');
    expect(result.node.title).toBe('Instagram DM');
    expect(result.session.status).toBe('ACTIVE');

    const context = service.getActiveContext();
    expect(context.activeTree?.id).toBe(result.tree.id);
    expect(context.activeNode?.id).toBe(result.node.id);
    expect(context.activeSession?.id).toBe(result.session.id);
    expect(context.nodes).toHaveLength(1);
    expect(context.events).toHaveLength(1);
    expect(context.events[0].type).toBe('WORK_STARTED');
  });

  it('captures a thought without switching active focus', () => {
    const work = service.startWork('Instagram DM');
    const thought = service.captureThought('Product idea', work.node.id);

    expect(thought.id).toBeDefined();
    expect(thought.title).toBe('Product idea');
    expect(thought.parentNodeId).toBe(work.node.id);

    const context = service.getActiveContext();
    expect(context.activeNode?.id).toBe(work.node.id); // Focus remains Instagram DM!
    expect(context.nodes).toHaveLength(2);

    const events = context.events;
    expect(events).toHaveLength(2);
    expect(events[1].type).toBe('THOUGHT_CAPTURED');
  });

  it('switches focus to a branch and adds sequential steps', () => {
    const work = service.startWork('Instagram DM');
    const branch = service.createBranch('Product idea', work.node.id);

    // Switch focus
    const newSession = service.switchFocus(branch.id);
    expect(newSession.focusNodeId).toBe(branch.id);

    let context = service.getActiveContext();
    expect(context.activeNode?.id).toBe(branch.id);

    // Add sequential steps: Meta review -> Business registration -> Bank account
    const step1 = service.addStep('Meta review', branch.id);
    expect(step1.node.parentNodeId).toBe(branch.id);
    expect(step1.session.focusNodeId).toBe(step1.node.id);

    const step2 = service.addStep('Business registration', step1.node.id);
    expect(step2.node.parentNodeId).toBe(step1.node.id);
    expect(step2.session.focusNodeId).toBe(step2.node.id);

    const step3 = service.addStep('Bank account', step2.node.id);
    expect(step3.node.parentNodeId).toBe(step2.node.id);
    expect(step3.session.focusNodeId).toBe(step3.node.id);

    context = service.getActiveContext();
    expect(context.activeNode?.id).toBe(step3.node.id);
    expect(context.nodes).toHaveLength(5);
  });

  it('pauses active session and resumes continuation from history', () => {
    const work = service.startWork('Instagram DM');
    service.pauseActiveSession();

    expect(service.sessionRepo.getById(work.session.id)?.status).toBe('PAUSED');
    expect(service.treeRepo.getById(work.tree.id)?.status).toBe('PAUSED');

    // Resume continuation from historical node
    const continuation = service.resumeContinuation(work.tree.id, work.node.id, 'Continue Instagram DM');
    expect(continuation.tree.relationshipType).toBe('CONTINUATION');
    expect(continuation.tree.originTreeId).toBe(work.tree.id);
    expect(continuation.tree.originNodeId).toBe(work.node.id);

    const context = service.getActiveContext();
    expect(context.activeTree?.id).toBe(continuation.tree.id);
    expect(context.activeNode?.id).toBe(continuation.node.id);
  });

  it('recovers interrupted active session on unexpected restart', () => {
    const work = service.startWork('Instagram DM');
    expect(work.session.status).toBe('ACTIVE');

    // Simulate unexpected app restart by invoking recoverInterruptedSessions
    service.recoverInterruptedSessions();

    const historicalTree = service.treeRepo.getById(work.tree.id);
    expect(historicalTree?.status).toBe('ACTIVE');

    const historicalSession = service.sessionRepo.getById(work.session.id);
    expect(historicalSession?.status).toBe('INTERRUPTED');

    const events = service.eventRepo.listByTree(work.tree.id);
    const interruptedEvent = events.find((e) => e.type === 'SESSION_INTERRUPTED');
    expect(interruptedEvent).toBeDefined();
  });

  it('supports export and import round-trip', () => {
    service.startWork('Instagram DM');
    const exported = service.exportData();

    expect(exported.trees.length).toBe(1);
    expect(exported.nodes.length).toBe(1);
    expect(exported.events.length).toBe(1);

    // Delete all data
    service.deleteAllData();
    expect(service.getActiveContext().nodes).toHaveLength(0);

    // Import back
    const importResult = service.importData(exported);
    expect(importResult.importedTrees).toBe(1);
    expect(importResult.importedNodes).toBe(1);
    expect(service.getActiveContext().nodes).toHaveLength(1);
  });

  it('handles re-importing duplicate events without UNIQUE constraint errors', () => {
    service.startWork('Initial Work');
    const exported = service.exportData();

    // Re-importing into the same DB where events already exist must not throw
    const result = service.importData(exported);
    expect(result.importedEvents).toBeGreaterThanOrEqual(1);
    expect(result.importedTrees).toBe(1);
  });

  it('handles snake_case payload in importData and switches active tree', () => {
    service.startWork('Tree 1');
    const tree1Context = service.getActiveContext();

    const snakePayload = {
      trees: [
        {
          id: 'tree-snake-1',
          root_node_id: 'node-snake-root',
          relationship_type: 'NEW_WORK',
          status: 'ACTIVE',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      nodes: [
        {
          id: 'node-snake-root',
          tree_id: 'tree-snake-1',
          parent_node_id: null,
          title: 'Imported Snake Case Node',
          kind: 'ROOT_WORK',
          status: 'ONGOING',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
    };

    const result = service.importData(snakePayload);
    expect(result.importedTrees).toBe(1);
    expect(result.importedNodes).toBe(1);
    expect(result.activeTreeId).toBe('tree-snake-1');

    const newContext = service.getActiveContext();
    expect(newContext.activeTree?.id).toBe('tree-snake-1');
    expect(newContext.activeNode?.title).toBe('Imported Snake Case Node');
    expect(service.treeRepo.getById(tree1Context.activeTree!.id)?.status).toBe('PAUSED');
  });

  it('handles direct array of nodes and synthesizes tree', () => {
    const rawNodes = [
      {
        id: 'raw-root-1',
        title: 'Synthesized Root',
        kind: 'ROOT_WORK',
        status: 'ONGOING'
      },
      {
        id: 'raw-step-1',
        parentNodeId: 'raw-root-1',
        title: 'Synthesized Step',
        kind: 'WORK_STEP',
        status: 'ONGOING'
      }
    ];

    const result = service.importData(rawNodes);
    expect(result.importedNodes).toBe(2);
    expect(result.importedTrees).toBe(1);

    const context = service.getActiveContext();
    expect(context.activeNode?.title).toBe('Synthesized Root');
    expect(context.nodes).toHaveLength(2);
  });

  it('automatically restores database from SQLite backup if original db file is not found', () => {
    const tmpDir = path.join(os.tmpdir(), `wander-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const dataDir = path.join(tmpDir, 'data');
    const backupsDir = path.join(tmpDir, 'backups');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(backupsDir, { recursive: true });

    const originalDbPath = path.join(dataDir, 'attention-path.sqlite');

    // 1. Create a database, start work, and generate a SQLite backup
    const tempDb = new Database(originalDbPath);
    initDatabaseSchema(tempDb);
    const tempService = new ApplicationService(tempDb, tmpDir);
    tempService.startWork('Important Restored Task');
    tempService.createBackupSnapshot('test');
    tempDb.close();

    // 2. Delete original DB file to simulate missing database
    fs.unlinkSync(originalDbPath);
    expect(fs.existsSync(originalDbPath)).toBe(false);

    // 3. Connect to database - it should detect missing original db and restore from the SQLite backup
    const recoveredDb = createDatabaseConnection(originalDbPath, tmpDir);
    const recoveredService = new ApplicationService(recoveredDb, tmpDir);

    const context = recoveredService.getActiveContext();
    expect(context.activeNode?.title).toBe('Important Restored Task');
    expect(context.nodes).toHaveLength(1);

    recoveredDb.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('automatically restores data from JSON backup if original db is not found and only JSON backup exists', () => {
    const tmpDir = path.join(os.tmpdir(), `wander-test-json-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const dataDir = path.join(tmpDir, 'data');
    const backupsDir = path.join(tmpDir, 'backups');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(backupsDir, { recursive: true });

    const originalDbPath = path.join(dataDir, 'attention-path.sqlite');

    // 1. Write a JSON backup directly to backups directory (no sqlite backup)
    const jsonBackupContent = {
      trees: [
        {
          id: 'tree-recovered-json',
          rootNodeId: 'node-recovered-json',
          relationshipType: 'NEW_WORK',
          status: 'ACTIVE'
        }
      ],
      nodes: [
        {
          id: 'node-recovered-json',
          treeId: 'tree-recovered-json',
          title: 'Restored from JSON Backup',
          kind: 'ROOT_WORK',
          status: 'ONGOING'
        }
      ]
    };
    fs.writeFileSync(path.join(backupsDir, 'wander-backup-auto-2026-10-03.json'), JSON.stringify(jsonBackupContent, null, 2));

    // 2. Original DB does not exist
    expect(fs.existsSync(originalDbPath)).toBe(false);

    // 3. Open connection & initialize application service
    const recoveredDb = createDatabaseConnection(originalDbPath, tmpDir);
    const recoveredService = new ApplicationService(recoveredDb, tmpDir);

    // 4. Run restoreFromBackupIfDbMissing
    const restored = recoveredService.restoreFromBackupIfDbMissing();
    expect(restored).toBe(true);

    const context = recoveredService.getActiveContext();
    expect(context.activeNode?.title).toBe('Restored from JSON Backup');
    expect(context.nodes).toHaveLength(1);

    recoveredDb.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
