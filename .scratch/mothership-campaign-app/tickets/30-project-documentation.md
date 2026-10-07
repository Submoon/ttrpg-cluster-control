---
title: 30. Documenting the project and codebase
label: wayfinder:implement
type: implement
status: open
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 30. Documenting the project and codebase

## What to build

As a campaign Warden and project maintainer, I can understand what the application does, how to run it, and where its main responsibilities live without reverse-engineering the code.

## Acceptance criteria

- The French README clearly describes the application's purpose, implemented capabilities, local-first data storage and backup behavior, key technical choices, setup, and current development commands.
- The README distinguishes existing functionality from deferred or out-of-scope work and reflects the post-refactor project structure.
- Components and modules have concise comments describing their responsibility and important boundaries.
- Non-obvious functions, complex algorithms, invariants, and surprising decisions have useful comments that explain their intent; obvious line-by-line narration is avoided.
- Documentation matches the current implementation and does not promise unimplemented behavior.

## Blocked by

- [27. Scoping custom fields to categories and subtypes](27-custom-field-applicability.md) — document the completed custom-field applicability behavior.
- [28. Showing the dragged map object in the drag preview](28-map-object-drag-preview.md) — document the final drag-and-drop behavior.
- [29. Reviewing and modularizing the frontend architecture](29-frontend-architecture.md) — document and comment the final structure after the refactor.

## Source specs

- [Mothership Campaign App - V1 Specification](../map.md)
- [29. Reviewing and modularizing the frontend architecture](29-frontend-architecture.md)
- [Project README](../../../README.md)
