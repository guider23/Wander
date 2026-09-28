import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabaseSchema } from '../../electron/db/schema';
import { ApplicationService } from '../../electron/application/service';
import { layoutGraph } from '../../src/graph/layout';

describe('Acceptance Criteria Verification (docs/14-acceptance-criteria.md)', () => {
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

  describe('1. Core Capture', () => {
    it('allows starting work with one short input', () => {
      const { tree, session, node } = service.startWork('Instagram DM');
      expect(tree.id).toBeTruthy();
      expect(session.id).toBeTruthy();
      expect(node.title).toBe('Instagram DM');
      expect(tree.status).toBe('ACTIVE');
    });

    it('captures a thought without changing focus', () => {
      const { node: rootNode, session: initialSession } = service.startWork('Instagram DM');
      const thoughtNode = service.captureThought('Product idea', rootNode.id);

      const ctx = service.getActiveContext();
      expect(ctx.activeSession?.id).toBe(initialSession.id);
      expect(ctx.activeNode?.id).toBe(rootNode.id);
      expect(thoughtNode.parentNodeId).toBe(rootNode.id);
      expect(thoughtNode.kind).toBe('THOUGHT');
    });

    it('adds a sequential step to the current path', () => {
      const { node: rootNode } = service.startWork('Instagram DM');
      const step1 = service.addStep('Reply to customer', rootNode.id);
      const step2 = service.addStep('Send payment link', step1.node.id);

      expect(step1.node.parentNodeId).toBe(rootNode.id);
      expect(step2.node.parentNodeId).toBe(step1.node.id);

      const ctx = service.getActiveContext();
      expect(ctx.activeNode?.id).toBe(step2.node.id);
    });

    it('branches from a node and switches focus into that branch', () => {
      const { node: rootNode, session: s1 } = service.startWork('Instagram DM');
      const branch = service.createBranch('Explore FL Studio', rootNode.id);

      // Focus has not switched yet
      expect(service.getActiveContext().activeNode?.id).toBe(rootNode.id);

      // Explicit switch
      const s2 = service.switchFocus(branch.id);
      expect(s2.id).not.toBe(s1.id);
      expect(s2.focusNodeId).toBe(branch.id);

      const ctx = service.getActiveContext();
      expect(ctx.activeNode?.id).toBe(branch.id);
    });
  });

  describe('2. Multi-tree Behavior', () => {
    it('maintains separate main works over time and preserves previous tree status', () => {
      const tree1 = service.startWork('Instagram DM');
      const tree2 = service.startWork('FL Studio Music');

      expect(tree1.tree.id).not.toBe(tree2.tree.id);

      const historicalTree1 = service.treeRepo.getById(tree1.tree.id);
      expect(historicalTree1?.status).toBe('PAUSED');

      const activeTree = service.treeRepo.getActive();
      expect(activeTree?.id).toBe(tree2.tree.id);
      expect(activeTree?.status).toBe('ACTIVE');
    });

    it('creates a new continuation tree when resuming an old tree node without rewriting history', () => {
      const work1 = service.startWork('Instagram DM');
      const thought = service.captureThought('Product idea', work1.node.id);
      service.pauseActiveSession();

      // Resume continuation from the historical thought node
      const continuation = service.resumeContinuation(work1.tree.id, thought.id, 'Continue Product idea');

      expect(continuation.tree.relationshipType).toBe('CONTINUATION');
      expect(continuation.tree.originTreeId).toBe(work1.tree.id);
      expect(continuation.tree.originNodeId).toBe(thought.id);

      // Verify the old tree remained completely untouched
      const originalTree = service.treeRepo.getById(work1.tree.id);
      expect(originalTree?.status).toBe('PAUSED');
      expect(originalTree?.id).toBe(work1.tree.id);
    });
  });

  describe('3. Status & Graph Continuous Layout', () => {
    it('marks completed and abandoned paths correctly', () => {
      const work = service.startWork('Instagram DM');
      const step1 = service.addStep('Step 1', work.node.id);
      const step2 = service.addStep('Step 2', step1.node.id);

      service.completePath(step1.node.id);
      expect(service.nodeRepo.getById(step1.node.id)?.status).toBe('COMPLETED');

      service.abandonPath(step2.node.id);
      expect(service.nodeRepo.getById(step2.node.id)?.status).toBe('ABANDONED');
    });

    it('renders sequential work Product -> Meta -> Registration -> Bank on ONE continuous branch column', () => {
      const work = service.startWork('Instagram DM');
      const product = service.createBranch('Product idea', work.node.id);
      service.switchFocus(product.id);

      const meta = service.addStep('Meta review', product.id);
      const reg = service.addStep('Business registration', meta.node.id);
      const bank = service.addStep('Bank account', reg.node.id);

      const ctx = service.getActiveContext();
      const layout = layoutGraph(ctx.nodes, bank.node.id);

      const productLayout = layout.nodes.find((n) => n.node.id === product.id)!;
      const metaLayout = layout.nodes.find((n) => n.node.id === meta.node.id)!;
      const regLayout = layout.nodes.find((n) => n.node.id === reg.node.id)!;
      const bankLayout = layout.nodes.find((n) => n.node.id === bank.node.id)!;

      // Meta review -> Business registration -> Bank account must share the exact same X coordinate
      expect(metaLayout.x).toBe(productLayout.x);
      expect(regLayout.x).toBe(productLayout.x);
      expect(bankLayout.x).toBe(productLayout.x);

      // Y positions strictly increase
      expect(productLayout.y).toBeLessThan(metaLayout.y);
      expect(metaLayout.y).toBeLessThan(regLayout.y);
      expect(regLayout.y).toBeLessThan(bankLayout.y);
    });

    it('handles 20+ nodes with long titles without breaking layout', () => {
      const work = service.startWork('A very long title that spans across many characters for testing resilience');
      let currentParentId = work.node.id;

      for (let i = 1; i <= 22; i++) {
        const step = service.addStep(`Long sequential work step title index #${i} detailing deep complex tasks`, currentParentId);
        currentParentId = step.node.id;
      }

      const ctx = service.getActiveContext();
      expect(ctx.nodes).toHaveLength(23);

      const layout = layoutGraph(ctx.nodes, currentParentId);
      expect(layout.nodes).toHaveLength(23);
      expect(layout.height).toBeGreaterThan(1500);
      expect(layout.width).toBeGreaterThanOrEqual(900);
    });
  });

  describe('4. History and Data Safety', () => {
    it('lists history with aggregated summaries', () => {
      service.startWork('Tree 1');
      service.startWork('Tree 2');

      const history = service.listHistory();
      expect(history).toHaveLength(2);
      expect(history[0].tree.id).toBeDefined();
      expect(history[0].rootNode).toBeDefined();
    });

    it('exports data and allows full import round-trip', () => {
      const work = service.startWork('Main Task');
      service.captureThought('Idea 1', work.node.id);

      const exported = service.exportData();
      expect(exported.trees.length).toBe(1);
      expect(exported.nodes.length).toBe(2);

      service.deleteAllData();
      expect(service.treeRepo.listAll()).toHaveLength(0);

      service.importData(exported);
      expect(service.treeRepo.listAll()).toHaveLength(1);
      expect(service.nodeRepo.listAll()).toHaveLength(2);
    });
  });
});
