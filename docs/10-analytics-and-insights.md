# 10 — Analytics & Insights

## 1. Principle
Analytics should describe behavior, not judge it.

Do not create a productivity score in V1.

## 2. Derived metrics
Possible local metrics:
- number of sessions/day
- number of thoughts/day
- number of actual focus switches/day
- number of returns/day
- active duration by session
- time from root start to first branch
- branch depth
- number of abandoned paths
- number of completed paths
- number of paused paths
- number of resumed-from-node events

## 3. Useful visualizations
### Session replay
Animate or step through the tree by timestamp.

### Attention timeline
```text
10:00 ─ Instagram
10:14 ─ Product
10:22 ─ Meta
10:34 ─ Bank
10:48 ─ Instagram
```

### Branch depth
Show how far a curiosity chain went without ranking the user.

### Return map
Show which old nodes tend to get resumed.

## 4. Future AI layer
AI may summarize patterns from user-owned event history:
- recurring branch themes,
- common trigger contexts,
- repeated unfinished projects,
- recurring return patterns.

AI output must be descriptive and transparent about uncertainty.

Do not present AI as a clinician, diagnose ADHD, or infer health conditions.

## 5. Privacy-first analytics
V1 should compute metrics locally from local data.
If telemetry is ever added, it must be opt-in, documented, and minimal.
