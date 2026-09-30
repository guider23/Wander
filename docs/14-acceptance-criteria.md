# 14 — Acceptance Criteria

## Core capture
- User can start work in one short input.
- User can capture a thought without changing focus.
- User can add a sequential step to the current path.
- User can branch from a node.
- User can switch into a branch.

## Multi-tree behavior
- User can maintain many separate main works over time.
- Starting a new main work creates a new root session/tree.
- Previous tree is preserved with its last status.
- Resuming an old tree/node creates a new session connected to the original node.
- The old session's timestamps and history remain intact.

## Status
- Active is visibly distinct.
- Ongoing is distinguishable from completed and abandoned.
- Paused is distinguishable from abandoned.
- Completed paths have a resolved visual endpoint.
- Abandoned paths are visually inactive/faded/broken.

## Graph behavior
- Main work reads as a dominant vertical trunk.
- Curiosity creates a branch from the point where it occurred.
- Sequential work such as Meta review → registration → bank account remains on one continuous branch.
- Graph remains readable with at least 20 nodes on common Windows desktop sizes.
- Long titles do not break layout.

## History
- User can browse previous sessions.
- User can inspect a full tree.
- User can see a timeline of transitions.
- User can resume from a specific node.

## Persistence
- Data survives app restart.
- Core capture works offline on Windows.
- No duplicate events on normal restart/retry.

## Accessibility
- All controls are labeled.
- Graph content has a non-visual accessible representation.
- Status is not communicated only through color.
- Reduced motion is respected.

## Performance
- Capture interaction responds immediately after local command dispatch.
- Graph interaction remains usable on a typical supported Windows desktop/laptop for normal V1 data sizes.

## Data safety
- User can export their history.
- User can delete history.
- No hidden collection of external app/browser activity occurs.
