import Database from 'better-sqlite3';
import { DomainEvent } from '../../../src/domain/events/types';

export class EventRepository {
  constructor(private db: Database.Database) {}

  getNextSequence(): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS nextSeq FROM events').get() as { nextSeq: number };
    return row.nextSeq;
  }

  append(event: Omit<DomainEvent, 'sequence'> & { sequence?: number }): DomainEvent {
    const sequence = event.sequence ?? this.getNextSequence();
    const fullEvent: DomainEvent = {
      ...event,
      sequence
    } as DomainEvent;

    this.db.prepare(`
      INSERT INTO events (
        id, type, tree_id, session_id, node_id, occurred_at, created_at, sequence, payload_json, schema_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fullEvent.id,
      fullEvent.type,
      fullEvent.treeId,
      fullEvent.sessionId,
      fullEvent.nodeId,
      fullEvent.occurredAt,
      fullEvent.createdAt,
      fullEvent.sequence,
      JSON.stringify(fullEvent.payload),
      fullEvent.schemaVersion
    );

    return fullEvent;
  }

  listAll(): DomainEvent[] {
    const rows = this.db.prepare('SELECT * FROM events ORDER BY sequence ASC').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      treeId: r.tree_id,
      sessionId: r.session_id,
      nodeId: r.node_id,
      occurredAt: r.occurred_at,
      createdAt: r.created_at,
      sequence: r.sequence,
      payload: JSON.parse(r.payload_json),
      schemaVersion: r.schema_version
    }));
  }

  listByTree(treeId: string): DomainEvent[] {
    const rows = this.db.prepare('SELECT * FROM events WHERE tree_id = ? ORDER BY sequence ASC').all(treeId) as any[];
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      treeId: r.tree_id,
      sessionId: r.session_id,
      nodeId: r.node_id,
      occurredAt: r.occurred_at,
      createdAt: r.created_at,
      sequence: r.sequence,
      payload: JSON.parse(r.payload_json),
      schemaVersion: r.schema_version
    }));
  }
}
