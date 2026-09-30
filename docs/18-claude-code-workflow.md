# 18 — Claude Code Workflow & Guardrails

## Purpose
This file makes the specification practical for an AI-assisted implementation workflow. Claude Code should use the repository docs as the source of truth rather than inventing product behavior while coding.

## 1. Start every coding task with context
Read:
- `CLAUDE.md`
- the directly related specification files
- relevant acceptance criteria
- current roadmap phase

Do not read the whole repository indiscriminately for every tiny change once the project becomes large.

## 2. Before coding
For each task, write a short plan containing:
- goal,
- files likely to change,
- domain impact,
- persistence impact,
- UI impact,
- tests required,
- acceptance criteria affected.

Do not begin by creating broad scaffolding unless the current phase requires it.

## 3. Implementation order
Prefer:
```text
Domain model
  ↓
Event/state transition
  ↓
Repository/persistence
  ↓
Application command/query
  ↓
IPC contract
  ↓
UI state
  ↓
Visual rendering
```

For purely visual changes, do not modify domain behavior.

## 4. Specification change rule
When an implementation requirement reveals that the existing specification is ambiguous or wrong:
1. stop and identify the conflict,
2. update the relevant `.md` specification,
3. update acceptance criteria if behavior changed,
4. then implement the revised behavior.

Do not silently let code become a second source of truth.

## 5. Don't over-engineer the first version
Avoid introducing:
- Redux if Zustand is sufficient,
- a second database abstraction with no current need,
- a cloud backend,
- authentication,
- analytics SDKs,
- AI services,
- complicated dependency injection frameworks,
- microservices,
- auto-sync.

Build the smallest robust local Windows application.

## 6. Protect the core product idea
Do not turn the UI into:
- Kanban,
- a generic todo list,
- a calendar,
- a project-management dashboard,
- a habit tracker,
- a gamified scorecard.

The graph and attention history remain central.

## 7. Preserve historical truth
Never mutate historical session timing to make the current screen look correct.

Example:
```text
S1: Instagram, 10:00–10:20
S2: Product, 10:20–10:45
S3: Instagram resume, 10:45–11:00
```

Do not rewrite S1 to 10:00–11:00.

## 8. Keep thought and focus switch separate
A thought capture may create a node without changing the active session.

A focus switch changes the active session/context and produces the corresponding session relationship.

A single user interaction may offer a follow-up action such as "Switch to it", but the two semantic events remain distinct in the domain model.

## 9. Use deterministic graph fixtures
Keep canonical fixtures for:
- one main task with no branches,
- Product → Meta → Registration → Bank as one long branch,
- multiple curiosity branches,
- abandoned branch,
- completed branch,
- pause and return,
- multiple unrelated main trees,
- resume from a historical node into a new session.

Use them in unit, renderer, and E2E tests.

## 10. Before declaring a feature done
Run:
```text
npm run typecheck
npm run lint
npm run test
```

Also run the project's renderer/E2E scripts as defined.

For packaging-related changes, build the Windows package and smoke-test the packaged executable.

## 11. Review questions
Before finishing a task, ask:
1. Did this add behavior not specified?
2. Did this mutate historical truth?
3. Does it work after restarting the app?
4. Does it work with no network?
5. Is the action still faster than following the curiosity itself?
6. Is the graph clearer or noisier?
7. Does keyboard navigation still work?
8. Did tests cover the new state transition?

## 12. Commit discipline
Prefer small commits with one conceptual purpose, for example:
```text
feat(domain): add focus switch event
feat(db): persist session relationships
feat(graph): render sequential branch path
feat(ui): add quick thought capture
fix(history): preserve resumed session ancestry
```

Do not combine unrelated refactors with product changes.
