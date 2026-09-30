# 06 — Visual System

## 1. Visual identity
The app should feel like a calm scientific sketch of attention rather than a conventional productivity dashboard.

Desired qualities:
- minimal
- warm
- quiet
- precise
- organic
- visual-first

## 2. Background
Use a soft pale peach / warm neutral background.
Suggested token:
`--background: #F7E8DD`

Keep the exact color token configurable so the design can be tuned later.

## 3. Lines
Use near-black thin strokes.
Suggested token:
`--ink: #171717`

Base stroke: ~1.5–2 px at 1x design scale.

## 4. Line semantics
### Active
Solid crisp line. Active endpoint has an open or emphasized circle.

### Ongoing but not active
Solid line with open endpoint.

### Paused
Solid path ending in an open circle, with subtle low-emphasis endpoint treatment.

### Completed
Solid path ending in a small closed dot/circle.

### Abandoned
Broken/dashed or progressively faded path ending without an active marker.

Avoid color-coding status in V1. Use line treatment + endpoint shape + accessible text/list state.

## 5. Main trunk
The primary work path should visually read as a dominant vertical line, preferably near the center of the viewport.

It may gently curve but should remain visually coherent.

## 6. Branches
Branches should leave from a concrete node or point on a path and curve naturally.

Important rule:
**Sequential dependencies on the same work path remain one continuous branch.**

Example:
```text
Product idea
    │
    ├── Meta review
    │      │
    │      └── Registration
    │             │
    │             └── Bank
```

Do not render Product → Meta → Registration → Bank as four independent branches.

## 7. Graph layout algorithm
V1 can use a deterministic tree layout:
- root/trunk centered,
- child branches allocated left/right based on available width,
- vertical spacing driven by node count,
- collapsed subtrees when density becomes excessive,
- scroll vertically.

The engine should separate layout calculation from rendering.

Suggested modules:
- `layoutGraph(nodes, edges, viewport)`
- `buildPathGeometry(layout)`
- `renderNode(node, layout)`

## 8. Graph scaling
For more than ~30–50 visible nodes:
- allow pan/zoom,
- collapse inactive branches,
- maintain selected-node focus,
- show mini-map only when genuinely useful.

Do not introduce zoom in the first prototype unless needed.

## 9. Motion
A newly created branch may animate into place in a subtle 150–250ms stroke/opacity animation.

Reduced motion:
- no path animation,
- immediate state transitions.

## 10. Typography
Use a clean sans-serif system font. Avoid decorative typography.

Hierarchy should be sparse:
- screen title
- current work title
- node labels
- tiny metadata

## 11. Visual anti-patterns
Avoid:
- colorful mind-map bubbles
- giant cards
- kanban boards
- productivity score meters
- excessive gradients
- decorative icons on every node
- gamified streaks
- visual noise
