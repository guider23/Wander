# 07 — Windows Desktop Architecture

## 1. Platform decision
The product is a **Windows desktop application**.

Recommended implementation:
- Electron
- React
- Vite
- TypeScript strict
- SVG for the graph
- SQLite for local persistence

The renderer is responsible for UI only. The Electron main process owns filesystem/database/native capabilities.

Why Electron for this project:
- Excellent fit for a graph-heavy React interface.
- Claude Code can work primarily in TypeScript rather than splitting the core product between mobile JavaScript and native mobile APIs.
- Straightforward Windows packaging to an installer/`.exe`.
- Mature ecosystem for desktop shortcuts, menus, tray integration, deep links, filesystem access, and updates.

Do not introduce native Windows UI frameworks unless a concrete requirement cannot reasonably be met in Electron.

## 2. Runtime architecture
```text
                    Windows OS
                         │
                Electron Main Process
          ┌──────────────┼────────────────┐
          │              │                │
      SQLite DB      IPC Command      Window lifecycle
          │              │
          ▼              ▼
     Event store     Application API
                         │
                  Secure preload bridge
                         │
                         ▼
                 React Renderer
          ┌──────────────┼────────────────┐
          │              │                │
       Screens       Zustand UI       Graph renderer
                         │
                         ▼
                 Domain/query results
```

## 3. Security boundary
Renderer code must not have direct access to:
- Node `fs`
- Node `child_process`
- raw `ipcRenderer`
- SQLite connection
- arbitrary shell execution

Expose only explicit, typed functions via preload, for example:
```ts
window.attentionApp.sessions.start(...)
window.attentionApp.nodes.captureThought(...)
window.attentionApp.sessions.switchFocus(...)
window.attentionApp.history.getByDay(...)
window.attentionApp.data.export(...)
```

Every IPC request is validated in the main process.

## 4. Layering
```text
React UI / screens
    ↓
Presentation hooks / selectors
    ↓
Renderer API client (typed preload wrapper)
    ↓
IPC handlers in Electron main
    ↓
Application commands / queries
    ↓
Domain model + state transitions
    ↓
Repository interfaces
    ↓
SQLite repositories
    ↓
Local file system
```

Domain/application modules must contain no React or Electron imports.

## 5. Suggested project structure
```text
attention-path/
  electron/
    main.ts
    preload.ts
    ipc/
      handlers/
      channels.ts
    windows/
    menus/
    shortcuts/
    app-lifecycle/
    db/
      connection.ts
      migrations/
      repositories/
    export/
    filesystem/

  src/
    app/
      routes/
      providers/
    components/
      graph/
      controls/
      dialogs/
      history/
      common/
    features/
      current-session/
      history/
      settings/
      capture/
    domain/
      entities/
      events/
      reducers/
      services/
      invariants/
    application/
      commands/
      queries/
      dto/
    state/
      zustand/
    graph/
      layout/
      geometry/
      hit-testing/
    theme/
    utils/
    validation/

  tests/
    unit/
    integration/
    renderer/
    e2e/

  docs/
```

## 6. Command/query separation
Commands mutate history by producing events:
- `startWork`
- `captureThought`
- `addStep`
- `createBranch`
- `switchFocus`
- `pauseSession`
- `resumeFromNode`
- `returnToNode`
- `completePath`
- `abandonPath`
- `renameNode`
- `deleteNode`

Queries read projections:
- `getActiveSession`
- `getCurrentTree`
- `getSessionGraph`
- `getHistoryByDay`
- `getNodeConnections`
- `getTimeline`
- `getDerivedSessionStats`

## 7. Repository interfaces
Keep storage independent of SQLite implementation:
```ts
interface EventRepository {
  append(event: DomainEvent): Promise<void>;
  appendMany(events: DomainEvent[]): Promise<void>;
  listBySession(sessionId: string): Promise<DomainEvent[]>;
}

interface SessionRepository {
  getActive(): Promise<Session | null>;
  getById(id: string): Promise<Session | null>;
  listHistory(range: DateRange): Promise<SessionSummary[]>;
}
```

Exact signatures may evolve.

## 8. SQLite choice
Use a mature SQLite driver supported by the selected Electron version. `better-sqlite3` is the default recommendation because the workload is local, transactional, and relatively small.

Use prepared statements and transactions. Keep database access in the main process.

## 9. Transaction rule
Operations that create multiple records/events must commit atomically.

Example `switchFocus`:
1. Validate current active session.
2. Validate target node.
3. End/pause the current focus period.
4. Create the new session.
5. Append relationship/focus events.
6. Update projections in the same transaction where appropriate.
7. Commit.

No partially switched state should be visible after a crash.

## 10. App lifecycle
Handle:
- first launch
- reopen existing window
- closing window
- app quit
- unexpected renderer crash
- main-process crash/restart
- OS sleep/wake where relevant

Do not assume the renderer's last state is authoritative. Reconstruct the current truth from persisted events/projections on startup.

## 11. Window behavior
V1:
- one main application window,
- minimum sensible size such as 960×640,
- resizable,
- maximizable,
- remembers last safe size/position,
- does not require fullscreen,
- native title bar may be retained initially to reduce complexity.

Optional later:
- compact always-on-top capture window,
- system tray quick capture,
- global shortcut.

## 12. Offline-first
No network connection is needed for:
- start work,
- thought capture,
- branch creation,
- switching,
- pause/resume,
- completion/abandonment,
- history,
- export/import.

## 13. Future cloud boundary
Keep:
```text
LocalRepository ←→ SyncEngine ←→ RemoteRepository
```

Do not implement sync until local semantics and migrations are stable.

## 14. Graph rendering
Use SVG in React for V1.

Graph engine responsibilities:
- convert nodes/events into a normalized graph model,
- calculate deterministic positions,
- generate path geometry,
- provide hit regions for nodes,
- support viewport pan/zoom only when density requires it.

Do not put layout math inside React component render methods.

## 15. Performance target
The normal local dataset should remain responsive at:
- 10,000+ events,
- 2,000+ nodes,
- 500+ sessions.

Use pagination and aggregation for history lists. Render only the visible graph/session where possible.
