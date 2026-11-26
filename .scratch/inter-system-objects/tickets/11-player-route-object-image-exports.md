---
title: Export player images from permitted route object scenes
status: in-progress
assignee: Codex
type: implementation
specification: ../spec.md
baseline: c649b576f1636c8ffec57da6b6112b6316bee882
triage_labels:
  - enhancement
  - ready-for-agent
---

# 11: Export player images from permitted route object scenes

## Specification

[Zones and catalogue objects on routes](../spec.md), user stories 59-64, 69-72. The [approved implementation plan](../ticket-plan.md) defines the graph. Source intake: [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60).

## What to build

Download public Cluster, viewport and eligible Zone images that match the permitted route object scene in preview and reader.

## Blocked by

- [Publish and read route objects without private-route leaks](09-publish-and-read-route-objects.md)

## Baseline and boundaries

Use origin/main at c649b576f1636c8ffec57da6b6112b6316bee882, verified on 2026-11-26, as the original comparison baseline. Integrate completed prerequisite tickets before claiming this slice. Record the actual candidate revision and any deliberately different base when implementation begins; preserve existing local work.

Use the accepted specification's whole-Cluster key policy and explicit legacy exceptions. Route objects include stationary obstacles, anomalies, derelicts and ships; position is manual. Keep one guarded mutation/writer/history path and exclude unapplied previews from saved or public data.

Implementation started from integration candidate `14e13d7bee9f0b3704066e90bb568f32bc48fd29`, which contains the completed player publication prerequisite. The original comparison baseline remains `origin/main` at `c649b576f1636c8ffec57da6b6112b6316bee882`. Intermediate consumers must preserve admitted data or explicitly reject an unsupported operation, never silently drop records.

## Acceptance criteria

- [x] Build source-free images from the allowed public document, including permitted route object roots and branch detail at the chosen scope.
- [x] Private route metadata, hidden branches, GM notes, source identifiers and private extents are absent from SVG content, PNG bounds, titles and filenames.
- [x] Support route object-only public scenes without requiring a published Zone marker; retain selected-Zone eligibility and refuse a wholly empty public artifact.
- [x] Honor immutable snapshot, preflight, context cancellation and bounded rasterization rules. Export neither ghosts nor unpublished placement drafts.
- [x] Use the same allowed geometry and disclosure in preview, detached reader and exported scene.

## Verification

Use public image/codec privacy and operation-controller checks with independent bounds/content assertions. Reuse the maintained player-reader/download journey for actual artifact wiring.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.


## Implementation evidence

The checked source candidate `432e359419692fac5c744c636507163063cc8d61` includes integration through `14e13d7bee9f0b3704066e90bb568f32bc48fd29`. Cluster images show public roots even in a branch-only document. Viewport images follow the public curves and retain branch-local selection and dimming at the captured camera. Selected-Zone images use their local geometry and incident stubs. Both SVG and PNG use the same permitted scene.

- `node ../../../node_modules/@playwright/test/cli.js test tests/player-file-actions.spec.ts tests/player-image-geometry.spec.ts tests/continuous-player-image-export.spec.ts tests/player-codec.spec.ts tests/player-projection.spec.ts --project=pure --workers=1` passed all 39 cases. The ticket worktree retained the result at `test-results/playwright-1795691911245-42252-5f8002fb/artifacts/.last-run.json`. Initial failing cases for the image refusal, missing viewport detail and blocked file dispatch retained traces in that worktree’s `test-results/`.
- ESLint passed with zero warnings for all changed TypeScript and Vue files. Nuxt generated its types and the corrected source passed `node ../../../node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.json`.
- The maintained player-reader journey now downloads an object-only SVG and checks its permitted content and Selected Zone eligibility. Run this journey against the frozen integrated candidate.
