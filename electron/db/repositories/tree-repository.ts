import Database from 'better-sqlite3';
import { Tree, TreeRelationship, TreeStatus } from '../../../src/domain/entities/types';

export class TreeRepository {
  constructor(private db: Database.Database) {}

  save(tree: Tree): void {
    this.db.prepare(`
      INSERT INTO trees (
        id, root_node_id, origin_tree_id, origin_node_id, origin_session_id,
        relationship_type, status, created_at, updated_at, ended_at, deleted_at, schema_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        root_node_id = excluded.root_node_id,
        origin_tree_id = excluded.origin_tree_id,
        origin_node_id = excluded.origin_node_id,
        origin_session_id = excluded.origin_session_id,
        relationship_type = excluded.relationship_type,
        status = excluded.status,
        updated_at = excluded.updated_at,
        ended_at = excluded.ended_at,
        deleted_at = excluded.deleted_at
    `).run(
      tree.id,
      tree.rootNodeId,
      tree.originTreeId,
      tree.originNodeId,
      tree.originSessionId,
      tree.relationshipType,
      tree.status,
      tree.createdAt,
      tree.updatedAt,
      tree.endedAt,
      tree.deletedAt,
      tree.schemaVersion
    );
  }

  getById(id: string): Tree | null {
    const r = this.db.prepare('SELECT * FROM trees WHERE id = ?').get(id) as any;
    if (!r) return null;
    return this.mapRow(r);
  }

  getActive(): Tree | null {
    const r = this.db.prepare('SELECT * FROM trees WHERE status = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1').get('ACTIVE') as any;
    if (!r) return null;
    return this.mapRow(r);
  }

  listAll(): Tree[] {
    const rows = this.db.prepare('SELECT * FROM trees WHERE deleted_at IS NULL ORDER BY created_at DESC').all() as any[];
    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(r: any): Tree {
    return {
      id: r.id,
      rootNodeId: r.root_node_id,
      originTreeId: r.origin_tree_id,
      originNodeId: r.origin_node_id,
      originSessionId: r.origin_session_id,
      relationshipType: r.relationship_type as TreeRelationship,
      status: r.status as TreeStatus,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      endedAt: r.ended_at,
      deletedAt: r.deleted_at,
      schemaVersion: r.schema_version
    };
  }
}
