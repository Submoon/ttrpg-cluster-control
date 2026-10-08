---
title: 30. Documenting the project and codebase
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 30. Documenting the project and codebase

## What to build

As a campaign Warden and project maintainer, I can understand what the application does, how to run it, and where its main responsibilities live without reverse-engineering the code.

## Acceptance criteria

- Project documentation and source comments are written in English.
- The English README clearly describes the application's purpose, implemented capabilities, local-first data storage and backup behavior, key technical choices, setup, and current development commands.
- The README states "Designed for use with Mothership®" as compatibility wording rather than presenting the app as a Mothership product, describes practical capabilities in enough detail, and keeps storage and backup guidance brief.
- The README includes the notice: "Mothership® is a trademark of Tuesday Knight Games. This project is an unofficial fan-made tool and is not affiliated with or endorsed by Tuesday Knight Games."
- The README states the MIT license and reflects the post-refactor project structure, without a "Not Included" section.
- Components and modules have concise comments describing their responsibility and important boundaries.
- Important functions and algorithms in Vue and TypeScript modules have English JSDoc explaining their intent, boundaries, invariants, and non-obvious inputs, outputs, or errors; obvious line-by-line narration is avoided.
- Documentation matches the current implementation and does not promise unimplemented behavior.

## Blocked by

- [27. Scoping custom fields to categories and subtypes](27-custom-field-applicability.md) — document the completed custom-field applicability behavior.
- [28. Showing the dragged map object in the drag preview](28-map-object-drag-preview.md) — document the final drag-and-drop behavior.
- [29. Reviewing and modularizing the frontend architecture](29-frontend-architecture.md) — document and comment the final structure after the refactor.

## Source specs

- [Mothership Campaign App - V1 Specification](../map.md)
- [29. Reviewing and modularizing the frontend architecture](29-frontend-architecture.md)
- [Project README](../../../README.md)

## First-pass resolution

- Per the user's updated requirement, project documentation is in English. The README covers implemented capabilities, IndexedDB storage and save errors, JSON backups and independent-copy imports, image exports, technical choices, setup commands, the post-refactor module layout, and out-of-scope work.
- Concise English comments across 46 source modules document responsibilities and non-obvious persistence, draft acknowledgement, field applicability, legacy compatibility, deletion, Orbit geometry, and Vue/D3 boundaries. No executable code was changed.
- Validation passed: `npm run typecheck`, `npm run build`, `npm test` (35 passed), and `git diff --check`. Source comparison confirms comment-only changes; local documentation links resolve.
- No commit or push had been made at that stage.

### Standards review

Reviewed the uncommitted changes against `HEAD`. No remaining documented-standard violations or new code smells.

### Spec review

All acceptance criteria are covered, including the user's English-only override. Review corrected the distinction between SSR hosting and remote campaign storage, and clarified placement and layout-pruning comments. No remaining findings.

## Resolution

- Revised the English README to expand practical mapping capabilities, reduce local storage and backup guidance to one actionable paragraph, and remove "Not Included". Its generic title is "Campaign Cartography", followed by the exact compatibility wording and trademark/unofficial-project notice requested above.
- Added the complete root [MIT License](../../../LICENSE), with the user-approved `Copyright (c) 2026 Submoon`, and linked it from the README.
- Added attached English JSDoc to 224 of 246 named functions across Vue and TypeScript. Important persistence, import, field-scope, deletion, geometry, rendering, export, and draft-acknowledgement contracts are documented; trivial helpers remain concise. An explicit check covered 44 critical functions.
- The README recommends Node 24 LTS, `24.15.0` or newer within 24.x. That range was checked against the official manifests for Nuxt 3.21.11 and Nuxt 4.6.0 while the migration was planned ([Nuxt 3](https://registry.npmjs.org/nuxt/3.21.11), [Nuxt 4](https://registry.npmjs.org/nuxt/4.6.0)); the app has since been upgraded to Nuxt 4.6.0.
- Validation passed: `npm run typecheck`, `npm run build`, the final unchanged-default-worker `npm test` run (35 passed), `git diff --check`, README/license checks, and local Markdown links. Source comparison confirmed that all 46 modified Vue/TypeScript files differ from `HEAD` only in documentation/comments.
- An earlier revised-suite run passed 33 tests and stalled during initial workspace hydration in two scenarios. Both passed a focused rerun, and the subsequent complete suite passed all 35. The intermittent cause was not established; no runtime, test, timeout, assertion, retry, or skip changes were made.
- This ticket's changes were documentation-only; the later Nuxt 4 migration and dependency updates are separate implementation changes.

### Standards review

No remaining documented-standard violations or new code smells. Review verified documentation-only source changes and clarified legacy workspace restoration and deletion effects.

### Spec review

All revised acceptance criteria and user-directed README, English-language, licensing, JSDoc, Node-version, and trademark requirements are covered. No remaining findings.
