# 17 — Windows Distribution & Native Desktop Requirements

## 1. Goal
The end product must behave like a normal Windows application, not a website opened in a browser.

Primary deliverable:
- installable Windows `.exe` package.

A portable build may be produced later if useful, but the installer is the main V1 artifact.

## 2. Supported environment
Target Windows 10 and Windows 11 initially.

During project bootstrap, verify the actual minimum Electron-supported Windows versions for the chosen Electron release and pin/document the supported range.

Do not claim support for Windows versions that the selected Electron runtime does not support.

## 3. Packaging
Choose one packaging system and standardize it:
- `electron-builder`, or
- Electron Forge.

The packaging configuration should define:
- application name,
- executable name,
- app icon,
- product/version metadata,
- installer output directory,
- per-user installation behavior where practical.

Do not require administrator privileges for normal app usage.

## 4. Data location
Persist user data under Electron's platform-appropriate user data directory, for example through:
```ts
app.getPath('userData')
```

Never place the mutable SQLite database beside the installed executable.

Recommended structure:
```text
<userData>/
  data/
    attention-path.sqlite
  exports/
  logs/
```

The exact directories can evolve.

## 5. App startup
On startup:
1. determine the user data directory,
2. open/create SQLite database,
3. run pending migrations in a transaction,
4. validate essential schema state,
5. reconstruct the active-session projection,
6. recover from interrupted app shutdown where needed,
7. create the main window.

The startup path must tolerate the user opening the application repeatedly.

## 6. Crash recovery
A crash must not silently convert an active session into completed/abandoned work.

At minimum, store enough durable event information to distinguish:
- active at last persisted event,
- intentionally paused,
- completed,
- abandoned,
- interrupted by app/process shutdown.

If the exact behavior for an interrupted session is changed later, update the event model and acceptance criteria first.

## 7. Updates
V1 may ship without automatic updates.

When auto-update is added later:
- use a trusted update source,
- verify package integrity/signatures as appropriate,
- keep the update process separate from user data migration,
- never delete the user's SQLite database during update.

## 8. Windows input
First-class inputs:
- mouse click,
- wheel/trackpad scroll,
- keyboard typing,
- keyboard navigation,
- Enter/Escape in dialogs,
- standard copy/paste shortcuts.

Useful future desktop affordances:
- global hotkey to capture a thought,
- system tray quick capture,
- compact always-on-top capture window.

These are not required for the core V1 until validated.

## 9. High DPI and resizing
The UI must remain usable on common Windows scaling values such as 100%, 125%, 150%, and 200%.

Test:
- 1366×768,
- 1920×1080,
- 2560×1440,
- a narrow resized window around the minimum size,
- high-DPI scaling.

Graph labels and hit targets must scale without becoming blurry or inaccessible.

## 10. Accessibility
Support:
- keyboard-only operation,
- visible focus state,
- accessible names for controls,
- logical tab order,
- semantic HTML where practical in the renderer,
- an accessible tree/list representation alongside the graphical tree,
- reduced motion.

Do not use color alone for status.

## 11. Privacy posture on Windows
The app must not silently inspect:
- running process names,
- foreground application,
- browser history,
- typed keystrokes outside the app,
- clipboard contents without user action,
- screenshots,
- microphone input.

Any future system-level integration must be explicitly user-triggered, documented, and separately approved in the product scope.

## 12. Release checklist
Before calling a Windows release done:
- packaged app starts on a clean Windows machine/VM,
- database is created in the correct user-data location,
- app can create and retrieve a session offline,
- restart preserves history,
- uninstall does not unexpectedly destroy user data without clear behavior/documentation,
- upgrade preserves existing data,
- keyboard navigation works,
- graph renders at common DPI settings,
- destructive actions require confirmation,
- export/import round trip succeeds.
