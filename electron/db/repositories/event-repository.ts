import Database from 'better-sqlite3';
import { DomainEvent } from '../../../src/domain/events/types';

export class EventRepository {
  constructor(private db: Database.Database) {}

  getNextSequence(): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS nextSeq FROM events').get() as { nextSeq: number };
    return row.nextSeq;
  }

  public onEventAppended?: (event: DomainEvent) => void;

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

    try {
      this.onEventAppended?.(fullEvent);
    } catch (_) {}

    return fullEvent;
  }

  save(event: DomainEvent): void {
    const sequence = event.sequence ?? this.getNextSequence();
    const payloadStr = typeof event.payload === 'string'
      ? event.payload
      : JSON.stringify(event.payload ?? {});

    this.db.prepare(`
      INSERT INTO events (
        id, type, tree_id, session_id, node_id, occurred_at, created_at, sequence, payload_json, schema_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        tree_id = excluded.tree_id,
        session_id = excluded.session_id,
        node_id = excluded.node_id,
        occurred_at = excluded.occurred_at,
        created_at = excluded.created_at,
        sequence = excluded.sequence,
        payload_json = excluded.payload_json,
        schema_version = excluded.schema_version
    `).run(
      event.id,
      event.type,
      event.treeId ?? null,
      event.sessionId ?? null,
      event.nodeId ?? null,
      event.occurredAt,
      event.createdAt,
      sequence,
      payloadStr,
      event.schemaVersion ?? 1
    );
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
