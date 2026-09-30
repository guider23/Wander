# 12 — Security & Privacy

## 1. Data sensitivity
Even though the app is not a medical app, attention history can reveal personal routines, interests, projects, and habits. Treat it as private user data.

## 2. V1 policy
- Local-first.
- No account required.
- No server required for core functionality.
- No ad SDK.
- No background screen monitoring.
- No reading of browser history.
- No reading of other apps.
- No microphone recording unless the user explicitly enables a separately scoped future feature.
- No screenshots unless the user explicitly chooses an export/share action.

## 3. Data minimization
Store only what the user explicitly enters plus required timestamps/state.

## 4. Export
Give the user control over exporting their data.
Clearly state what is exported.

## 5. Delete
Provide:
- delete individual session/path,
- delete all local data.

Use explicit confirmation for destructive actions.

## 6. Future cloud sync
If cloud sync is introduced:
- explain what leaves the device,
- allow opt-in,
- encrypt in transit,
- implement authenticated access,
- offer account/data deletion,
- use row-level authorization,
- never make cloud sync mandatory for local usage.

## 7. No health inference
Do not diagnose or label attention disorders from app data. Any future AI analysis must remain descriptive and user-controlled.
