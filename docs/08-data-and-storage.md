# 08 — Data & Storage for Windows

## 1. Storage principles
V1 is local-first and SQLite-backed. The database lives in Electron's per-user application data directory, not beside the installed executable.

Use a real `trees` table because the tree is a first-class product object.

Recommended tables:
- `trees`
- `sessions`
- `nodes`
- `events`
- `app_settings`

Soft deletion/tombstone fields are preferred over destructive physical deletion for normal user actions.

## 2. Trees table
Suggested columns:
```text
id TEXT PRIMARY KEY
root_node_id TEXT NOT NULL
origin_tree_id TEXT NULL
origin_node_id TEXT NULL
origin_session_id TEXT NULL
relationship_type TEXT NOT NULL
status TEXT NOT NULL
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
ended_at TEXT NULL
deleted_at TEXT NULL
schema_version INTEGER NOT NULL
```

Relationships:
- `NEW_WORK` for an independent main work.
- `CONTINUATION` when a new tree is explicitly created from a historical node.

## 3. Sessions table
Suggested columns:
```text
id TEXT PRIMARY KEY
tree_id TEXT NOT NULL
focus_node_id TEXT NOT NULL
previous_session_id TEXT NULL
status TEXT NOT NULL
started_at TEXT NOT NULL
ended_at TEXT NULL
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
schema_version INTEGER NOT NULL
```

A tree can contain many sessions as attention moves between nodes.

## 4. Nodes table
```text
id TEXT PRIMARY KEY
tree_id TEXT NOT NULL
parent_node_id TEXT NULL
title TEXT NOT NULL
kind TEXT NOT NULL
status TEXT NOT NULL
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
completed_at TEXT NULL
abandoned_at TEXT NULL
deleted_at TEXT NULL
metadata_json TEXT NULL
schema_version INTEGER NOT NULL
```

A node belongs to exactly one tree. A later continuation tree gets new nodes; its source node remains in the original tree.

## 5. Events table
```text
id TEXT PRIMARY KEY
type TEXT NOT NULL
tree_id TEXT NULL
session_id TEXT NULL
node_id TEXT NULL
occurred_at TEXT NOT NULL
created_at TEXT NOT NULL
sequence INTEGER NOT NULL
payload_json TEXT NOT NULL
schema_version INTEGER NOT NULL
```

Indexes:
- `(tree_id, occurred_at)`
- `(session_id, occurred_at)`
- `(node_id, occurred_at)`
- `(sequence)`
- `(type, occurred_at)`

Add uniqueness constraints for event IDs and, where appropriate, local sequence numbers.

## 6. Event payloads
Keep payloads explicit and versioned. Example:
```json
{
  "sourceTreeId": "...",
  "sourceNodeId": "...",
  "sourceSessionId": "...",
  "targetTreeId": "...",
  "reason": "resume"
}
```

Never place arbitrary UI state in event payloads.

## 7. Read projections
Use lightweight projections for fast UI reads:
- active tree/session pointer,
- tree summary,
- node display state,
- daily history summary.

The event stream remains authoritative.

## 8. Database location
Resolve the location through Electron, for example:
```ts
app.getPath('userData')
```

Do not hardcode Windows usernames or paths.

## 9. Transactions
Commands that modify multiple tables must use a single SQLite transaction.

Example: start a continuation tree:
```text
validate source node
→ allocate tree ID
→ create tree
→ create root/continuation node
→ create session
→ append continuation event
→ commit
```

A crash must not leave half-created continuation state.

## 10. Export
V1 JSON export should contain:
- schema/version metadata,
- trees,
- sessions,
- nodes,
- events,
- non-secret app settings.

The export must be sufficient to reconstruct the history.

Optional later formats:
- CSV summary,
- Markdown human-readable report.

## 11. Import
Validate schema version and all IDs/relationships before modifying the current database.

Recommended behavior:
1. parse into an isolated in-memory structure,
2. validate graph and event invariants,
3. show a summary,
4. require user confirmation,
5. transactionally import or merge according to an explicit mode.

Never partially import malformed data.

## 12. Time
Persist UTC timestamps. Render in Windows local time. Group history by the user's local date.

## 13. IDs
Use UUIDs or another collision-resistant stable identifier. Never use array positions as identity.
