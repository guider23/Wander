import Database from 'better-sqlite3';
import { Session, SessionStatus } from '../../../src/domain/entities/types';

export class SessionRepository {
  constructor(private db: Database.Database) {}

  save(session: Session): void {
    this.db.prepare(`
      INSERT INTO sessions (
        id, tree_id, focus_node_id, previous_session_id, status,
        started_at, ended_at, created_at, updated_at, schema_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tree_id = excluded.tree_id,
        focus_node_id = excluded.focus_node_id,
        previous_session_id = excluded.previous_session_id,
        status = excluded.status,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        updated_at = excluded.updated_at
    `).run(
      session.id,
      session.treeId,
      session.focusNodeId,
      session.previousSessionId,
      session.status,
      session.startedAt,
      session.endedAt,
      session.createdAt,
      session.updatedAt,
      session.schemaVersion
    );
  }

  getById(id: string): Session | null {
    const r = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
    if (!r) return null;
    return this.mapRow(r);
  }

  getActive(): Session | null {
    const r = this.db.prepare('SELECT * FROM sessions WHERE status = ? ORDER BY updated_at DESC LIMIT 1').get('ACTIVE') as any;
    if (!r) return null;
    return this.mapRow(r);
  }

  listByTree(treeId: string): Session[] {
    const rows = this.db.prepare('SELECT * FROM sessions WHERE tree_id = ? ORDER BY started_at ASC').all(treeId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  listAll(): Session[] {
    const rows = this.db.prepare('SELECT * FROM sessions ORDER BY started_at DESC').all() as any[];
    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(r: any): Session {
    return {
      id: r.id,
      treeId: r.tree_id,
      focusNodeId: r.focus_node_id,
      previousSessionId: r.previous_session_id,
      status: r.status as SessionStatus,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      schemaVersion: r.schema_version
    };
  }
}
