import Database from 'better-sqlite3';

export const SCHEMA_VERSION = 1;

export function initDatabaseSchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trees (
      id TEXT PRIMARY KEY,
      root_node_id TEXT NOT NULL,
      origin_tree_id TEXT NULL,
      origin_node_id TEXT NULL,
      origin_session_id TEXT NULL,
      relationship_type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      ended_at TEXT NULL,
      deleted_at TEXT NULL,
      schema_version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      tree_id TEXT NOT NULL,
      focus_node_id TEXT NOT NULL,
      previous_session_id TEXT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      schema_version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      tree_id TEXT NOT NULL,
      parent_node_id TEXT NULL,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT NULL,
      abandoned_at TEXT NULL,
      deleted_at TEXT NULL,
      metadata_json TEXT NULL,
      schema_version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      tree_id TEXT NULL,
      session_id TEXT NULL,
      node_id TEXT NULL,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      schema_version INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_tree ON events(tree_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_events_node ON events(node_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_events_sequence ON events(sequence);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type, occurred_at);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `);

  const hasMigration = db
    .prepare('SELECT version FROM schema_migrations WHERE version = ?')
    .get(SCHEMA_VERSION);

  if (!hasMigration) {
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
      .run(SCHEMA_VERSION, new Date().toISOString());
  }
}
