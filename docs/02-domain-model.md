# 02 — Domain Model

## 1. Core model
The product must support **many main works** over a day or across history.

The central distinction is:
- **Tree = one intentional main work context and its attention history.**
- **Session = one continuous period of focus inside that tree.**
- **Node = a point/work item in the tree.**

This means switching from `Instagram DM` to a `Product idea` branch does **not** create another tree. It creates another focus session inside the same tree.

Starting an unrelated main work creates a new tree. Returning to an older tree later creates a **new continuation tree connected to a node in the old tree**, because the user explicitly wants the resumed history represented as a new visual tree while preserving the old one.

## 2. Tree
A Tree is the first-class visual/history unit for one main-work context.

Examples:
```text
Tree A — Instagram DM
│
├── Product idea
│    └── Meta review
│         └── Business registration
│              └── Bank account
│
├── YouTube
│    └── FL Studio
│         └── Keyboard
│              └── Cable
│
└── Color grading
     └── DaVinci
```

Suggested fields:
- `id`
- `rootNodeId`
- `status`: `ACTIVE | PAUSED | COMPLETED | ABANDONED | INTERRUPTED`
- `originTreeId` nullable
- `originNodeId` nullable
- `originSessionId` nullable
- `createdAt`
- `updatedAt`
- `endedAt` nullable
- `relationshipType`: `NEW_WORK | CONTINUATION`

V1 should use a real `trees` table. It is central to the product behavior and history.

## 3. Session
A Session is a continuous focus period inside one tree.

Fields:
- `id`
- `treeId`
- `focusNodeId`
- `startedAt`
- `endedAt` nullable
- `status`: `ACTIVE | PAUSED | COMPLETED | ABANDONED | INTERRUPTED`
- `previousSessionId` nullable
- `createdAt`
- `updatedAt`

A tree can contain many sessions because attention can move from one node to another within the same main work.

Example:
```text
Tree A
  Session S1 — Instagram DM
  Session S2 — Product idea
  Session S3 — Meta review
  Session S4 — Business registration
  Session S5 — Bank account
  Session S6 — Return to Instagram DM
```

The sessions create the temporal history; the node relationships create the structural tree.

## 4. Node
A Node is the smallest meaningful item displayed in a tree.

Suggested fields:
- `id`
- `treeId`
- `parentNodeId` nullable
- `title`
- `kind`
- `status`: `ONGOING | PAUSED | COMPLETED | ABANDONED`
- `createdAt`
- `updatedAt`
- `completedAt` nullable
- `abandonedAt` nullable
- `deletedAt` nullable
- `metadataJson` nullable

### Node kinds
- `ROOT_WORK`
- `THOUGHT`
- `WORK_STEP`
- `DEPENDENCY`
- `RETURN_ANCHOR`

Do not make every kind visually different. Kind primarily informs semantics and accessibility.

## 5. Branch
A Branch is a conceptual path represented by parent/child node relationships. It does not need its own table in V1.

Important rule:
**A branch can contain a long sequence of work.**

This is one branch/path:
```text
Product idea
    │
    └── Meta review
          │
          └── Business registration
                │
                └── Bank account
```

It is NOT four sibling branches.

## 6. Thought
A Thought is a captured idea that does not automatically change focus.

Example:
```text
Current session: Instagram DM
Thought: "Could this become a product?"
```

If the user follows it, the app starts a new session focused on that thought node **inside the same tree**.

## 7. Focus
At most one Session is active locally at a time.

The active focus is resolved through:
```text
activeTreeId
activeSessionId
activeNodeId
```

Never infer focus simply from the newest node.

## 8. Starting a new main work
When the user intentionally starts an unrelated main task:
```text
Old Tree A → remains preserved
New Tree B → new root work + new active session
```

The old tree becomes paused/interrupted according to the explicit user/app lifecycle state. It is not deleted.

## 9. Resuming an old tree
When the user chooses `Resume here` from an old tree/node:
```text
Old Tree A
    │
    └── node N
          │
          │ origin / resumed from
          ▼
New Tree B — continuation
    │
    └── new active session
```

Old Tree A is unchanged. New Tree B stores `originTreeId`, `originNodeId`, and optional `originSessionId`.

This is a deliberate product behavior, not merely a database implementation detail.

## 10. Status semantics
### ACTIVE
Currently focused session/tree.

### ONGOING
A node/path remains unfinished but may not be the current focus.

### PAUSED
Stopped intentionally and resumable.

### COMPLETED
User explicitly finished the work/path.

### ABANDONED
User explicitly stopped pursuing it.

### INTERRUPTED
The application/process ended unexpectedly before a normal lifecycle action. Used primarily for desktop recovery.

## 11. Historical invariant
Historical sessions and trees are never rewritten merely to represent a later return. Later returns create new sessions/trees and explicit connections.

## 12. Example with several main works
```text
Tree A — Instagram DM
  └── Product idea
        └── Meta review
              └── Business registration
                    └── Bank account

Tree B — FL Studio
  └── Keyboard
        └── Cable

Tree C — DaVinci
  └── Color grading

Tree D — Continue Product
  originTreeId = Tree A
  originNodeId = Bank account
```
