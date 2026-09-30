# Claude Code Instructions — Attention Path App (Windows)

## Mission
Build a **Windows desktop application** that records the path of a person's attention as a visual branching graph. The app is an **attention journal/debugger**, not a conventional task manager, timer, blocker, or surveillance tool.

The core question is:

> **"What happened to my attention while I was trying to work?"**

## Target platform
V1 is a **Windows 10/11 desktop app**, distributed as an installable Windows application (`.exe` installer and/or portable build). It is not an Android, iOS, or browser-first product.

The UI runs as a desktop window. Mouse, trackpad, keyboard, and Windows accessibility APIs are first-class inputs.

## Non-negotiable product principles
1. **Main work is a trunk.** One intentional work context has one primary visual path.
2. **Curiosity creates branches.** A thought does not automatically mean a focus switch.
3. **A branch can become a continuous work path.** Example: Product idea → Meta review → Business registration → Bank account is ONE continuous branch/path, not four sibling branches.
4. **A focus switch creates a new session.** The new session is connected to the node/context the user switched into.
5. **Returning later never rewrites history.** Resuming previous work creates a new session connected to the original node.
6. **Paused ≠ abandoned.** Paused work can be resumed; abandoned work is explicitly ended.
7. **The app observes; it does not shame.** Never automatically label work as wasteful, bad, lazy, or unproductive.
8. **Capture must be faster than following the distraction.** A normal capture should take roughly 2–5 seconds.
9. **The graph is the product identity.** Visual clarity beats feature density.
10. **Do not silently expand scope.** New ideas go to the backlog until deliberately promoted.
11. **Local-first means no network dependency.** Core functionality must work entirely on the user's Windows machine.
12. **No surveillance.** V1 must not inspect browser history, running applications, keystrokes, screenshots, microphone, or website usage automatically.

## Required reading order before implementation
Read these files before making architecture or UI decisions:
1. `docs/01-product-spec.md`
2. `docs/02-domain-model.md`
3. `docs/03-event-model.md`
4. `docs/04-user-flows.md`
5. `docs/05-ui-spec.md`
6. `docs/06-visual-system.md`
7. `docs/07-architecture.md`
8. `docs/08-data-and-storage.md`
9. `docs/09-state-management.md`
10. `docs/10-analytics-and-insights.md`
11. `docs/11-testing.md`
12. `docs/12-security-privacy.md`
13. `docs/13-roadmap.md`
14. `docs/14-acceptance-criteria.md`
15. `docs/15-implementation-plan.md`
16. `docs/17-windows-distribution.md`
17. `docs/18-claude-code-workflow.md`

## Recommended stack
Use the stack in `docs/07-architecture.md` unless there is a documented reason to deviate:
- Electron + Vite + React + TypeScript
- Strict TypeScript
- Electron main process for privileged operations
- Secure `preload` bridge with `contextIsolation: true` and no direct Node access in the renderer
- SVG-based graph rendered in the React renderer
- Zustand for ephemeral UI state only
- Zod for input/command validation
- SQLite for local-first persistence, accessed from the Electron main process
- `better-sqlite3` or an equally mature synchronous SQLite binding compatible with the selected Electron version
- Vitest for domain/unit tests
- React Testing Library for renderer tests
- Playwright or Spectron-equivalent desktop E2E tooling only after the core app stabilizes; prefer Playwright where the chosen Electron setup supports it
- Electron Forge or electron-builder for Windows packaging; choose one and standardize it

Do not add a backend, login, cloud database, or telemetry service in V1.

## Windows-specific engineering rules
- Support Windows 10/11 for V1; confirm the exact minimum build during bootstrap and document it.
- Store the SQLite database under the per-user application data directory, not beside the executable.
- Never require Administrator privileges for normal use or updates.
- Use Windows-safe file paths through Node/Electron APIs; do not hardcode `C:\Users\...` paths.
- Handle app startup, shutdown, and crash recovery carefully so no active session is silently lost.
- Support normal window resizing and high-DPI scaling.
- Support keyboard navigation and shortcuts where appropriate.
- Do not rely on hover alone to expose actions.
- Use native-looking menus/dialogs only where they improve clarity; the core visual language remains custom and minimal.

## Engineering rules
- TypeScript strict mode.
- Small, composable modules. Domain logic must be testable without React or Electron.
- Keep renderer UI thin; put graph/state/business rules in domain/application modules.
- Never derive historical truth from mutable UI state. Persist immutable events.
- Use stable IDs (UUIDs or equivalent) and ISO timestamps in UTC.
- Record every meaningful state transition as an event.
- Make command handling idempotent where practical.
- Schema migrations must be explicit and tested.
- No renderer-side direct SQLite access.
- Validate all IPC inputs in the main process with Zod or equivalent runtime validation.
- Expose a narrow preload API; do not expose arbitrary `ipcRenderer` or Node filesystem APIs to the renderer.
- Never execute arbitrary shell commands from renderer input.
- Keep secrets out of renderer code and local database rows.
- No network request should be required for core capture.
- Avoid unrelated refactors while implementing a feature.

## Graph semantics
The visualization is a projection of event history, not the source of truth.

A node may represent:
- root work
- thought
- work step
- dependency
- return/resumption anchor

A path/session may be:
- active
- paused
- completed
- abandoned

A focus switch creates a new session attached to a target node. The old session remains historical and is not mutated into the new session.

## How Claude Code should work
Before implementing a feature:
1. Identify which specification files and acceptance criteria it touches.
2. Check whether the feature is in the current roadmap phase.
3. State assumptions when requirements are ambiguous; do not silently invent behavior.
4. Implement the smallest coherent slice.
5. Add/update tests at the domain boundary first.
6. Run typecheck, lint, unit tests, and relevant desktop tests.
7. Check the relevant acceptance criteria.
8. Do not refactor unrelated code.

Before changing architecture:
- explain the tradeoff in a short implementation note,
- update the affected `.md` spec first,
- then implement against the updated source of truth.

## Definition of done
A feature is not done when it merely renders. It is done when:
- behavior is implemented,
- historical events are persisted correctly,
- data survives app restart,
- behavior works offline,
- edge cases are handled,
- tests cover important transitions,
- keyboard/accessibility behavior is acceptable,
- visual states match the visual system,
- the feature works in a packaged Windows build,
- and the relevant acceptance criteria pass.
