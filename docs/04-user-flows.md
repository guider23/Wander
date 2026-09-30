# 04 — User Flows (Windows Desktop)

## Flow A — Start main work
1. Open the Windows app.
2. Click `Start work`.
3. Enter a short title.
4. App creates a new Tree + root Node + active Session.
5. Main tree opens.

Expected:
```text
Instagram DM  ●
```

## Flow B — Capture a thought without switching
1. User is focused on Instagram DM.
2. Thinks of a product idea.
3. Clicks `New thought`.
4. Types `Product idea`.
5. App creates a child thought node.
6. Current focus remains Instagram DM.

```text
Instagram DM ●
      │
      └── Product idea ○
```

## Flow C — Follow a thought within the same tree
1. Select Product idea.
2. Click `Switch here`.
3. Current session pauses/ends.
4. App creates a new Session in the **same Tree**, focused on Product idea.
5. Product idea becomes visually active.

This is an attention switch, not a new main-work tree.

## Flow D — Add sequential work to a branch
While Product idea is active:
1. Click `Add step`.
2. Enter `Meta review`.
3. Continue.
4. Add `Business registration` under the current step.
5. Add `Bank account` under Business registration.

This must render as one continuous branch/path:
```text
Product idea
    │
    └── Meta review
         │
         └── Business registration
              │
              └── Bank account
```

## Flow E — Start another main work
1. User deliberately decides to stop working on the current main task.
2. Click `New work`.
3. Enter `FL Studio`.
4. App creates a **new Tree** with a new root/session.
5. Previous Tree remains preserved, usually paused unless already terminal.

## Flow F — Abandon a path
1. Select active path/node.
2. Open node menu → `Abandon`.
3. Confirm.
4. Save `PATH_ABANDONED`.
5. Path becomes visually inactive/faded/broken.

No historical deletion occurs.

## Flow G — Complete a path
1. Select the active path/node.
2. Click `Complete`.
3. Save `PATH_COMPLETED`.
4. Render resolved endpoint.

## Flow H — Resume an old tree from a node
1. Open History.
2. Select an older Tree.
3. Select the exact node.
4. Click `Resume here`.
5. App creates a **new continuation Tree + active Session**.
6. Store `originTreeId`, `originNodeId`, and optional `originSessionId`.
7. Old Tree remains unchanged.

## Flow I — Resume a paused root
Same as Flow H, but the source node is the root of the old Tree. The new continuation Tree is still distinct.

## Flow J — Return from history without resuming
Opening an old tree for inspection must not change active focus. Only an explicit `Resume here`/`Start working` action changes focus.

## Flow K — Edit title
1. Right-click/open node menu.
2. Select `Rename`.
3. Edit title.
4. Save `NODE_RENAMED`.

## Flow L — Delete
Deletion is separate from abandonment.
- Normal delete hides the node/tree/session from normal history after confirmation.
- Use soft deletion/tombstones in V1.
- Keep a deletion event for future reconciliation.

## Flow M — Unexpected Windows app close
On restart:
1. Load latest event sequence.
2. Reconstruct active state.
3. Detect active sessions that had no normal ending event.
4. Mark them `INTERRUPTED` through recovery handling.
5. Show a clear option to continue/resume.
6. Do not assume the user stayed focused while the app was closed.

## Flow N — Keyboard-first capture
1. User invokes the in-app capture shortcut/button.
2. Dialog opens with input focused.
3. User types a thought.
4. Presses Enter.
5. Event is persisted locally immediately.
6. Dialog closes and focus returns to the previous UI control.
