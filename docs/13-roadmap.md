# 13 — Roadmap

## Phase 0 — Concept validation
Goal: prove the interaction model.

Build:
- paper/prototype version of trunk + branch
- 3–7 day personal usage test
- notes on friction and confusion

Exit condition:
User can explain the difference between thought, switch, pause, complete, abandon, and resume.

## Phase 1 — V0 Windows desktop prototype
Build only:
- Start Work
- current graph
- New Thought
- Add Step
- Switch
- Pause
- Complete
- Abandon
- History
- Resume from old node
- SQLite persistence

No cloud. No surveillance. Package as a Windows desktop build before treating the phase as complete.

## Phase 2 — V1 usable Windows product
Add:
- graph density handling
- session detail/timeline
- rename
- delete/soft delete
- settings
- data export/import
- accessibility polish
- error recovery

## Phase 3 — Insight layer
Add local analytics:
- session durations
- branch depth
- switching frequency
- returns
- completion/abandon counts
- replay

Do not add scores.

## Phase 4 — Cloud optional
Potential:
- account
- backup
- sync across devices

Keep domain and repository layers compatible with both local and remote storage.

## Phase 5 — AI optional
Potential:
- natural-language summaries
- pattern discovery
- search across attention history
- conversational exploration of history

AI remains optional and descriptive.

## Scope guard
Any proposed feature should answer:
> Does this make it easier to capture, understand, or revisit the path of attention?

If not, put it in a future ideas document rather than V1.
