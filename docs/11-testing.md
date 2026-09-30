# 11 — Testing Strategy for Windows Desktop

## 1. Testing pyramid
### Domain/unit — highest priority
Pure tests for:
- event creation,
- state transitions,
- invariants,
- tree reconstruction,
- session linking,
- time calculations,
- import/export validation.

These tests must not require Electron.

### Repository/integration
- migration correctness,
- transaction atomicity,
- event persistence,
- restart reconstruction,
- corrupted/invalid import handling,
- concurrent command protection where applicable.

### Renderer/UI
- capture flows,
- branch creation,
- switch/resume flows,
- status rendering,
- dialogs,
- keyboard navigation,
- accessible labels,
- graph interaction.

### Desktop E2E
Add after core behavior stabilizes. Exercise the actual packaged app where practical.

## 2. Critical scenarios
### Scenario 1 — Thought does not switch focus
Given Instagram is active
When user captures Product idea
Then Instagram remains active.

### Scenario 2 — Sequential branch
Product → Meta → Registration → Bank
Then graph contains one continuous child path.

### Scenario 3 — Switching
Given A active and B exists
When user switches to B
Then A is no longer active and a new session B becomes active.

### Scenario 4 — Resume
Given old node N belongs to session S1
When user selects Resume here
Then a new session S2 exists with `originNodeId=N` and S1 remains unchanged.

### Scenario 5 — Multiple main works
Given session/tree A exists
When user starts an unrelated main work B
Then B has a new root and A remains preserved in history.

### Scenario 6 — Restart
Given active state is persisted
When the Windows app closes/reopens
Then the user can safely continue and no duplicate events are created by normal restart.

### Scenario 7 — Abandon
Abandon does not delete historical data and does not permit silent reactivation.

### Scenario 8 — Complete
Complete creates a terminal state and resolved endpoint visualization.

## 3. Invariant/property tests
Assert:
- no duplicate event IDs,
- no node with itself as parent,
- no cycles in the node-parent tree,
- at most one active focus session at a time unless the domain explicitly changes this rule,
- terminal sessions cannot silently become active,
- every resumed session references a valid source node when applicable,
- sequential nodes maintain correct parentage,
- importing invalid data cannot corrupt existing data.

## 4. Graph fixtures
Required fixtures:
1. single root,
2. one curiosity branch,
3. long sequential branch: Product → Meta → Registration → Bank,
4. multiple sibling branches,
5. abandoned branch,
6. completed branch,
7. paused/resumed chain,
8. many independent main trees,
9. long labels,
10. 50+ visible nodes,
11. mixed status tree,
12. deep nested branch.

## 5. Windows-specific test matrix
Test the packaged app on:
- Windows 10 supported configuration,
- Windows 11 supported configuration,
- 100% display scaling,
- 125% scaling,
- 150% scaling,
- 200% scaling,
- 1366×768,
- 1920×1080,
- 2560×1440,
- narrow resized window near minimum dimensions.

## 6. Keyboard tests
Verify:
- Tab order is logical,
- Enter submits dialogs,
- Escape closes dialogs,
- no essential action requires mouse-only interaction,
- focus returns to a sensible control after modal close.

## 7. Accessibility tests
- accessible names for controls,
- graph accessible list/text alternative,
- visible focus indicator,
- reduced motion,
- non-color status distinction,
- Windows display scaling.

## 8. Data/restart tests
Verify:
- data survives app restart,
- data survives OS restart,
- migration from previous schema works,
- interrupted active sessions recover according to documented policy,
- export/import round trip preserves event history.

## 9. Packaging tests
After packaging:
- install to a clean Windows environment,
- launch from Start Menu/desktop shortcut where provided,
- create and complete sample work,
- close and relaunch,
- verify SQLite data location,
- export data,
- uninstall/reinstall and verify documented data behavior.

## 10. Security tests
Verify renderer cannot access:
- Node filesystem directly,
- child process APIs,
- arbitrary IPC channels,
- SQLite connection,
- arbitrary shell commands.

Verify IPC rejects invalid payloads.
