---
title: 29. Reviewing and modularizing the frontend architecture
label: wayfinder:implement
type: implement
status: open
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 29. Reviewing and modularizing the frontend architecture

## What to build

As a maintainer, I can navigate the application UI and browser tests by cohesive responsibility, rather than having unrelated features concentrated in a few large files.

## Required sequence

1. Before changing code, review the frontend architecture with GPT-6.1 Sol at XHigh reasoning. Trace the Nuxt page, Vue components, domain and utility modules, styles, and Playwright tests; identify cohesive boundaries, dependencies, migration order, and regression risks. Record a concise review and refactoring plan in this ticket.
2. Implement the approved refactor with GPT-6 Luna at Max reasoning, following the review.

## Acceptance criteria

- The main page and map components delegate cohesive UI responsibilities to focused Vue components and modules; the refactor avoids both giant catch-all files and trivial one-purpose wrappers.
- The Playwright coverage is split into focused spec files by behavior or user workflow, while `npm test` continues to run the complete suite.
- Existing map behavior, accessibility, persistence, import/export, and responsive layouts remain unchanged.
- Shared test helpers are extracted only where multiple specs need them; no dependency is added solely for the refactor.
- Typecheck, the complete test suite, and production build pass after the refactor.
- The ticket resolution records the resulting file/component and test boundaries, plus any material trade-offs.

## Blocked by

- [27. Scoping custom fields to categories and subtypes](27-custom-field-applicability.md) — refactor after the custom-field applicability model and UI are in place.
- [28. Showing the dragged map object in the drag preview](28-map-object-drag-preview.md) — complete the Add Object drag interaction before reorganizing its UI.

## Source specs

- [Mothership Campaign App - V1 Specification](../map.md)
- [04. Choosing the V1 application and rendering architecture](04-application-architecture.md)
- [06. Building a star-system map with nested Orbits](06-star-system-map.md)
- [16. Making the workspace darker and more map-first](16-map-first-visual-refresh.md)
