# 01 — Product Specification (Windows)

## 1. Product thesis
People often do not lose a work session because they planned poorly. Their attention moves through a chain of plausible, interesting ideas. Normal task managers preserve the list of tasks but lose the **causal path of attention**.

This Windows desktop product captures that path with minimal interaction and renders it visually as connected trees.

## 2. Primary user problem
"I start one work, notice another possibility, follow it, discover another dependency, follow that, and forget to return to my original work. Later I cannot explain where the session went."

## 3. User promise
After using the app, a person can look back and understand:
- their intended work,
- the ideas that appeared,
- the paths they actually followed,
- where a path paused/completed/was abandoned,
- and how they returned or switched.

## 4. Product principles
### Fast capture
The app should require less effort than opening the distracting app/site.

### Observational
The system records behavior without moral language or productivity scores.

### Temporal truth
History is not overwritten when the user returns to old work.

### Visual-first
The graph is not decoration; it is the primary way the user understands the session.

### Local-first
Basic use must work with no network connection.

## 5. V1 scope
### Must have
- Start a new work session/tree from the Windows desktop app.
- Show current attention path as a vertical trunk with branches.
- Capture a thought without switching focus.
- Switch focus to an existing branch.
- Create a new branch/path.
- Pause current work.
- Complete current path.
- Abandon a path.
- Return to a prior work node.
- Create a new continuation Tree when resuming a prior node from History.
- Link resumed sessions to their source node/session.
- Browse history by day/session.
- Persist all history locally.
- Restore state after app restart.
- Work offline.
- Edit node title after capture.
- Delete a user-created node/session with an explicit destructive confirmation.

### Should have after core works
- Search history.
- Session duration display.
- Basic derived metrics.
- Export JSON/CSV/Markdown.
- Settings for time format, reduced motion, accessibility, and data export.

### Explicitly out of V1
- AI coaching.
- Automatic device surveillance.
- Website/app blocking.
- Calendar integration.
- Team/workspace features.
- Social/sharing feed.
- Gamification/streaks.
- Cloud account requirement.
- Complex project management features.

## 6. Key product distinction
A **thought** is not automatically a **focus switch**. A focus switch normally creates a new Session inside the same Tree.

Example:
- User thinks "I should try DaVinci" → capture Thought.
- User opens DaVinci and begins exploring → Focus Switch / new session.

## 7. Success signals for prototype validation
These are product validation questions, not goals to optimize immediately:
- Can the user record a new thought in under about 5 seconds?
- Can the user tell the difference between thought, active branch, paused, completed, and abandoned?
- Can the user return to a previous node without losing history?
- Does the graph remain understandable after many branches?
- Does the app itself feel less distracting than the behavior it is trying to observe?

## 8. UX language
Use neutral wording:
- "Switch"
- "Pause"
- "Complete"
- "Abandon"
- "Resume"
- "New thought"

Avoid:
- "You wasted time"
- "Bad distraction"
- "Failure"
- "Unproductive"
- "You should have..."

## 9. Core scenario
```text
10:00  Start: Instagram DM
10:14  Thought: Product idea
10:16  Switch to Product idea
10:21  Meta review
10:28  Business registration
10:35  Bank account
10:48  Pause Product
10:49  Return to Instagram DM
11:04  Complete Instagram DM
```

The app must retain every transition and reconstruct the visual path.
