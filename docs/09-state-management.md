# 09 — State Management & State Machines

## 1. Separate persistent truth from UI state
### Persistent/domain state
- trees
- sessions
- nodes
- events
- statuses
- timestamps

### UI state
- selected tree/node
- open dialog/menu
- graph viewport
- current navigation section
- temporary input text
- toast/error visibility

Zustand may store UI state and a small cached projection of current active state. It must not be the historical source of truth.

## 2. Tree lifecycle
```text
NEW → ACTIVE → PAUSED
          │       │
          │       └── resume within same tree → NEW SESSION
          │
          ├── COMPLETED
          └── ABANDONED

Unexpected shutdown may produce:
ACTIVE → INTERRUPTED
```

A continuation tree is a separate lifecycle object linked to the historical source tree/node.

## 3. Session lifecycle
```text
STARTED → ACTIVE → PAUSED → ended
             │       │
             ├───────┘ new session when resumed
             │
             ├── COMPLETED
             └── ABANDONED
```

A session is one focus period. It should never be stretched across unrelated focus periods.

## 4. Focus switching within one tree
Given:
```text
Tree A
  Session S1 focused on Instagram
  Product node exists as a child branch
```

When user switches to Product:
```text
1. pause/end S1 according to lifecycle rules
2. create S2 in Tree A with focusNodeId=Product
3. record FOCUS_SWITCHED
4. make S2 active
```

Do NOT create Tree B for an ordinary branch switch. The whole attention exploration remains visually part of Tree A.

## 5. Starting an unrelated main work
When the user deliberately starts another main work:
```text
Tree A remains historical
Tree B is created as a new root work
Tree B gets a new active session
```

The UI should make this intentional action clearly different from simply creating a branch.

## 6. Resuming an old tree from history
When user selects a node in an old tree and chooses `Resume here`:
```text
1. keep old Tree A untouched
2. create Tree B with relationship CONTINUATION
3. record originTreeId/originNodeId/originSessionId
4. create active session in Tree B
5. connect Tree B visually to the source node
```

## 7. Current focus invariant
There is at most one active session locally in V1.

On startup, if multiple active sessions are found due to a crash/bug:
- choose the latest by persisted sequence as the recovery candidate,
- mark the others interrupted through explicit recovery logic,
- never silently discard their history.

## 8. Thought behavior
Capturing a thought does not change focus.

## 9. Branch behavior
Creating a branch does not change focus. Following the branch does.

## 10. Completion/abandonment
Completing or abandoning a node/path ends its active focus session where applicable. Historical data stays visible.

Completed/abandoned sessions cannot be directly reactivated. A new session/tree must be created when the user later resumes.
