# 05 — Windows Desktop UI Specification

## 1. Primary navigation
V1 has three top-level destinations:
- **Now** — current active session/tree
- **History** — previous sessions and connected trees
- **Settings** — behavior, data, accessibility, appearance

Use a restrained left sidebar or top navigation. Prefer whichever gives the graph the most available vertical space at common desktop widths.

Do not add a dashboard full of cards in V1.

## 2. Main application window
Recommended baseline:
- minimum size: about 960×640,
- responsive resizing,
- resizable and maximizable,
- keyboard accessible,
- native window controls retained initially for reliability.

The main content should feel like a canvas, not a web page.

## 3. Now screen
### Layout
```text
┌─────────────────────────────────────────────────────────────┐
│ Attention Path                         12:41        Settings │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  Now         │                  current work                │
│  History     │                      │                       │
│  Settings    │                 branch lines                 │
│              │                      │                       │
│              │                graph / canvas                │
│              │                                              │
├──────────────┴──────────────────────────────────────────────┤
│  + Thought      + Step       Switch       Pause             │
└─────────────────────────────────────────────────────────────┘
```

The exact layout can evolve, but the graph must remain visually dominant.

## 4. Start Work
Title: `What are you working on?`

One text field.

Primary CTA: `Start`
Secondary: `Cancel`

Enter should submit. Escape should cancel.

No required categories, due dates, priorities, tags, or descriptions.

## 5. New Thought
Title: `What's the thought?`

One text field, focused immediately.

Buttons:
- `Capture`
- `Cancel`

After capture, optionally offer:
`Switch to it`

Important: capturing the thought itself must not change focus.

## 6. Add Step
Similar to New Thought but semantically means:
> this is the next work step on the current path.

It should be append-only and should not create a sibling branch when the user means sequential progression.

## 7. Branching model in the UI
When the user is working on a node and thinks of a different direction:
- `New thought` creates a child node from the current node.
- If they select `Switch to it`, the app starts a new focus session connected to that node.

Example:
```text
Instagram DM
     │
     └── Product idea
             │
             ├── Meta review
             │
             └── ...
```

If the user continues with Meta review → Registration → Bank, those are sequential child nodes on the same product path.

## 8. Switch
When a node is selected and is not currently active, show context actions:
- `Switch here`
- `View`
- `Resume here` where appropriate

Do not present multiple ambiguous primary buttons simultaneously. The correct action depends on whether the node belongs to the current active path or is historical.

## 9. Pause
Pause should be immediate.

After pause:
- graph remains visible,
- active indicator disappears,
- current session status becomes `Paused`,
- primary control becomes `Resume`.

The user may open another main work and create a new tree/session.

## 10. New main work
Provide a clear action from Now/History:
`Start new work`

Starting new work creates a new root session/tree. Previous trees remain intact.

Do not silently merge unrelated main works into one trunk.

## 11. Returning to prior work
History should allow the user to select a prior node and choose:
`Resume here`

This does NOT revive the old session. It creates a new session connected to that node.

Show the relationship subtly in the graph/history, for example:
```text
Previous path
     │
     ○
     ╎
     ● New session: Continue work
```

## 12. History screen
Group sessions by day.

Each row is lightweight:
- title,
- approximate duration,
- status,
- small branch preview,
- resume/open action when appropriate.

Allow search later; do not overload V1 history with metrics.

## 13. Session detail
Full-height graph with:
- graph view,
- timeline view,
- node selection.

Timeline example:
```text
10:02  Instagram DM
10:16  Product idea
10:21  Meta review
10:35  Business registration
10:48  Paused
10:49  New Instagram session
```

## 14. Settings
V1:
- 12h/24h time,
- reduced motion,
- high contrast option if needed,
- export data,
- import data,
- delete all data,
- about/version,
- open data folder (optional and clearly explained).

Haptics are not a primary Windows concern and should not be treated as a required V1 setting.

## 15. Context menus
Right-clicking a graph node may offer:
- View details
- Add thought
- Add step
- Switch here
- Resume here
- Rename
- Complete
- Abandon
- Delete

Only show actions valid for the node/session state.

## 16. Keyboard behavior
Minimum expectations:
- Tab navigates actionable controls.
- Enter activates the focused button/action.
- Escape closes dialogs/menus.
- Ctrl/Cmd-equivalent Windows shortcuts should use `Ctrl` where appropriate.
- A future global capture shortcut may be introduced, but it is not required for the first prototype.

## 17. Empty states
Neutral language only:
`No work logged yet.`
`Start something and see where your attention goes.`

## 18. Error handling
Prefer inline/recoverable messages:
- `Couldn't save that. Try again.`
- `This session is no longer active.`
- `That path was deleted.`
- `The imported file could not be read.`

Technical details should go to logs/devtools, not the user-facing message.

## 19. Accessibility
- All controls have accessible names.
- Graph has a parallel text/list representation for non-visual navigation.
- Status is not communicated only by color.
- Reduced motion disables branch-growth animation.
- Focus indicators remain visible.
- Text remains usable at increased Windows display scaling.
- Do not hide essential actions behind hover-only interactions.

## 20. Performance feel
Capture must feel immediate because the user is likely in a distraction moment.

Desired interaction:
```text
Shortcut/button → tiny dialog → type → Enter → saved
```

The UI should not wait for a network request or long animation before confirming capture.
