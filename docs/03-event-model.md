# 03 — Event Model

## 1. Historical truth
The graph is a projection. **The append-only event stream is the historical truth.**

It must reconstruct:
- every main work/tree,
- every thought and branch,
- every sequential step,
- every focus switch within a tree,
- tree changes,
- pauses/completions/abandons,
- continuation trees created from historical nodes,
- and Windows interruption/recovery.

## 2. Event envelope
Every event contains:
- `id`
- `type`
- `occurredAt`
- `createdAt`
- `treeId` nullable only for truly global events
- `sessionId` nullable only for truly global events
- `nodeId` nullable
- `payload`
- `schemaVersion`
- `sequence`

`sequence` is assigned by the local SQLite transaction and gives deterministic ordering.

## 3. V1 event types
```text
WORK_STARTED
THOUGHT_CAPTURED
BRANCH_CREATED
WORK_STEP_ADDED
FOCUS_SWITCHED
TREE_SWITCHED
SESSION_PAUSED
SESSION_RESUMED
RETURNED_TO_NODE
TREE_CONTINUATION_STARTED
PATH_COMPLETED
PATH_ABANDONED
SESSION_INTERRUPTED
NODE_RENAMED
SESSION_RENAMED
TREE_RENAMED
NODE_DELETED
TREE_DELETED
```

## 4. Event semantics
### WORK_STARTED
Creates a new Tree, root Node, and initial active Session.

### THOUGHT_CAPTURED
Creates a child thought node. Focus does not change.

### BRANCH_CREATED
Creates a new child path from a source node. Focus does not change unless the user explicitly follows it.

### WORK_STEP_ADDED
Adds the next sequential child on the currently followed path. This is the event used for `Meta review → Registration → Bank account`.

### FOCUS_SWITCHED
User intentionally changes focus to another node **within the same tree**. The old session is paused/ended according to the configured session semantics and a new session starts at the target node.

### TREE_SWITCHED
User intentionally leaves the current main-work tree and starts another existing/new tree as the active work context. Historical data is preserved.

### SESSION_PAUSED
Pauses the current focus session.

### SESSION_RESUMED
Resumes a paused context when the product semantics allow a new session within the same tree.

### RETURNED_TO_NODE
Records deliberate return intent to a prior node. If returning to an old tree from history, this is paired with `TREE_CONTINUATION_STARTED`.

### TREE_CONTINUATION_STARTED
Creates a **new tree + root/continuation session** linked to an existing tree/node. The old tree is unchanged.

### PATH_COMPLETED
Marks the current focused path/session or explicitly selected path as completed.

### PATH_ABANDONED
Marks the current path/session as abandoned without deleting historical data.

### SESSION_INTERRUPTED
Records that normal lifecycle handling was interrupted by an unexpected Windows app/process termination.

## 5. Critical example
```text
Tree A / S1 / N1   WORK_STARTED        Instagram DM
Tree A / S1 / N2   THOUGHT_CAPTURED    Product idea
Tree A / S2 / N2   FOCUS_SWITCHED      follow Product
Tree A / S3 / N3   WORK_STEP_ADDED     Meta review
Tree A / S4 / N4   WORK_STEP_ADDED     Business registration
Tree A / S5 / N5   WORK_STEP_ADDED     Bank account
Tree A / S5      SESSION_PAUSED
Tree A / N1      RETURNED_TO_NODE
Tree B / S6      TREE_CONTINUATION_STARTED from Tree A / N1
Tree B / S6      WORK focus continues
```

The Tree IDs make the user-visible distinction explicit: Tree B is a later continuation; Tree A remains an immutable historical tree.

## 6. Idempotency
Every event ID is unique. Re-submitting the same event ID must not create duplicate nodes, sessions, or state transitions.

## 7. Derived data
Derive where practical:
- branch count,
- session duration,
- switch count,
- return count,
- time spent per node/path,
- completed/abandoned counts.

Cache only after profiling shows a need.

## 8. Clock behavior
Store UTC timestamps. Use `sequence` for deterministic ordering when timestamps collide or the Windows clock moves. Never rewrite historical timestamps to repair clock anomalies.
