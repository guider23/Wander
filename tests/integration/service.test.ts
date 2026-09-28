import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabaseSchema } from '../../electron/db/schema';
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

    let context = service.getActiveContext();
    expect(context.activeSession).toBeNull();
    expect(context.activeTree?.status).toBe('PAUSED');

    // Resume continuation from historical node
    const continuation = service.resumeContinuation(work.tree.id, work.node.id, 'Continue Instagram DM');
    expect(continuation.tree.relationshipType).toBe('CONTINUATION');
    expect(continuation.tree.originTreeId).toBe(work.tree.id);
    expect(continuation.tree.originNodeId).toBe(work.node.id);

    context = service.getActiveContext();
    expect(context.activeTree?.id).toBe(continuation.tree.id);
    expect(context.activeNode?.id).toBe(continuation.node.id);
  });

  it('recovers interrupted active session on unexpected restart', () => {
    const work = service.startWork('Instagram DM');
    expect(work.session.status).toBe('ACTIVE');

    // Simulate unexpected app restart by invoking recoverInterruptedSessions
    service.recoverInterruptedSessions();

    const historicalTree = service.treeRepo.getById(work.tree.id);
    expect(historicalTree?.status).toBe('INTERRUPTED');

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
});
