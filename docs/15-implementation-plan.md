# 15 — Windows Implementation Plan for Claude Code

## Phase 0 — Repository and environment
1. Confirm Windows target and minimum supported Windows version.
2. Create Electron + React + Vite + TypeScript project.
3. Enable strict TypeScript.
4. Configure packaging (electron-builder or Electron Forge; choose one).
5. Add ESLint/Prettier/typecheck scripts.
6. Add Vitest and React Testing Library.
7. Create `electron/main.ts` and `electron/preload.ts`.
8. Establish secure IPC channel conventions.
9. Add base peach/ink design tokens.

Deliverable: a packaged Windows app opens to an empty shell with Now/History/Settings navigation.

## Phase 1 — Domain core before UI complexity
Implement pure TypeScript modules first:
- entities,
- event types,
- event constructors,
- validation,
- invariants,
- state transition functions,
- tree reconstruction,
- session relationship logic.

Write tests before connecting the database.

## Phase 2 — SQLite and migrations
1. Add SQLite driver in Electron main process.
2. Define schema and migration mechanism.
3. Implement event repository.
4. Implement node/session repositories.
5. Implement transactions.
6. Implement read projections.
7. Add database backup/export primitive.
8. Add restart/reconstruction tests.

## Phase 3 — Secure preload API
Expose a narrow API such as:
```text
sessions.start
sessions.pause
sessions.resume
sessions.switchFocus
nodes.captureThought
nodes.addStep
nodes.rename
nodes.complete
nodes.abandon
history.list
history.getTree
history.getTimeline
data.export
data.import
data.deleteAll
```

Each request:
1. validates payload,
2. calls an application command/query,
3. returns serializable DTOs only.

Never expose arbitrary IPC or Node APIs.

## Phase 4 — Application commands
Implement:
```text
startWork
captureThought
addStep
createBranch
switchFocus
pauseSession
resumeFromNode
returnToNode
completePath
abandonPath
renameNode
softDeleteNode
```

Each command:
1. validates input,
2. reads required state,
3. produces domain events,
4. persists atomically,
5. updates/invalidates projections,
6. returns a stable DTO.

## Phase 5 — Current Work window
Build:
- current work title/header,
- vertical attention trunk,
- branch rendering,
- current node emphasis,
- compact action bar,
- New Thought dialog,
- Add Step dialog,
- Branch/Switch interaction,
- Pause.

Use real persistence immediately.

## Phase 6 — Graph engine
Implement layout independently from React:
```text
layoutGraph(graph, viewport) → positions
buildPathGeometry(layout) → SVG paths
buildHitRegions(layout) → interactive regions
```

Rules:
- original main work visually dominates,
- sequential nodes on one path remain one line/branch,
- branches emerge from their actual source node,
- avoid crossing lines when practical,
- long labels do not destabilize the graph.

## Phase 7 — Status and lifecycle
Implement and visually verify:
- active,
- ongoing,
- paused,
- completed,
- abandoned.

Do not allow completed/abandoned sessions to become active by mutation. Resumption creates a new session.

## Phase 8 — Multiple trees and return
Build:
- many main works,
- history by day,
- session detail,
- graph/timeline toggle,
- resume from exact node,
- connected session visualization.

Critical rule:
**Never rewrite the old tree when resuming it.**

## Phase 9 — Desktop ergonomics
Add:
- keyboard navigation,
- Enter/Escape behavior for dialogs,
- sensible shortcuts for common commands,
- window size persistence,
- high-DPI checks,
- resize behavior,
- system clipboard copy where useful.

Global shortcuts and tray capture are later unless prototype testing proves they are necessary.

## Phase 10 — Data management
Add:
- rename,
- soft delete,
- JSON export,
- JSON import with validation,
- optional CSV/Markdown export,
- delete all data,
- database integrity check/recovery helper.

## Phase 11 — Accessibility
Audit:
- keyboard-only navigation,
- visible focus indicators,
- semantic roles/labels,
- graph accessible list representation,
- high contrast behavior,
- reduced motion,
- readable text scaling,
- dialogs that trap/release focus correctly.

## Phase 12 — Windows packaging
Produce:
- development run,
- signed/unsigned test installer as applicable,
- portable build only if useful,
- packaged app smoke test.

Verify data directory, installer upgrade, uninstall behavior, and clean reinstall behavior.

## Phase 13 — Test hardening
Run:
- unit tests,
- integration tests,
- renderer tests,
- E2E flows,
- migration tests,
- packaged Windows smoke test,
- typecheck,
- lint.

Create a manual checklist from `docs/14-acceptance-criteria.md`.

## Phase 14 — Personal dogfooding
Use the app personally for several days. Record:
- captures you forgot to make,
- capture friction,
- confusing statuses,
- difficult graph layouts,
- cases where thought vs switch is unclear,
- cases where resuming felt unnatural.

Revise the product specs before expanding scope.

## Recommended Claude Code execution loop
```text
1. Read CLAUDE.md + affected docs
2. Plan one small implementation slice
3. Implement domain logic first
4. Add tests
5. Implement UI/IPC integration
6. Run typecheck + lint + tests
7. Run packaged Windows smoke test when applicable
8. Review against acceptance criteria
9. Update docs when behavior changes
10. Commit one coherent change
```

Do not implement several roadmap phases in one large uncontrolled change.

## Architectural rule
Do not let the renderer become the source of truth.

Bad:
```text
React state → reconstruct history → persist final graph
```

Good:
```text
User action
  ↓
Renderer command
  ↓
Secure preload IPC
  ↓
Main-process application command
  ↓
Domain event(s)
  ↓
SQLite transaction
  ↓
Query/projection
  ↓
Renderer state
  ↓
Graph rendering
```
