import Database from 'better-sqlite3';
import { Node, NodeKind, NodeStatus } from '../../../src/domain/entities/types';

export class NodeRepository {
  constructor(private db: Database.Database) {}

  save(node: Node): void {
    this.db.prepare(`
      INSERT INTO nodes (
        id, tree_id, parent_node_id, title, kind, status,
        created_at, updated_at, completed_at, abandoned_at, deleted_at, metadata_json, schema_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tree_id = excluded.tree_id,
        parent_node_id = excluded.parent_node_id,
        title = excluded.title,
        kind = excluded.kind,
        status = excluded.status,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at,
        abandoned_at = excluded.abandoned_at,
        deleted_at = excluded.deleted_at,
        metadata_json = excluded.metadata_json
    `).run(
      node.id,
      node.treeId,
      node.parentNodeId,
      node.title,
      node.kind,
      node.status,
      node.createdAt,
      node.updatedAt,
      node.completedAt,
      node.abandonedAt,
      node.deletedAt,
      node.metadataJson,
      node.schemaVersion
    );
  }

  getById(id: string): Node | null {
    const r = this.db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as any;
    if (!r) return null;
    return this.mapRow(r);
  }

  listByTree(treeId: string): Node[] {
    const rows = this.db.prepare('SELECT * FROM nodes WHERE tree_id = ? AND deleted_at IS NULL ORDER BY created_at ASC').all(treeId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  listByTreeIncludingDeleted(treeId: string): Node[] {
    const rows = this.db.prepare('SELECT * FROM nodes WHERE tree_id = ? ORDER BY created_at ASC').all(treeId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  listAll(): Node[] {
    const rows = this.db.prepare('SELECT * FROM nodes WHERE deleted_at IS NULL ORDER BY created_at ASC').all() as any[];
    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(r: any): Node {
    return {
      id: r.id,
      treeId: r.tree_id,
      parentNodeId: r.parent_node_id,
      title: r.title,
      kind: r.kind as NodeKind,
      status: r.status as NodeStatus,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      completedAt: r.completed_at,
      abandonedAt: r.abandoned_at,
      deletedAt: r.deleted_at,
      metadataJson: r.metadata_json,
      schemaVersion: r.schema_version
    };
  }
}
