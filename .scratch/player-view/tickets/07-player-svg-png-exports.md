---
title: 'Export player-safe SVG and PNG maps'
status: closed
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 07: Export player-safe SVG and PNG maps

**Parent:** [Player view and secret-free sharing](../spec.md).

**Source:** [Player view and secret-free export — GitHub #9](https://github.com/Submoon/ttrpg-cluster-control/issues/9). Approved breakdown: 2026-10-29. Planning baseline: `8d4b66504ca6723db5405ed7cb93d0a666264c9a`, equal to fetched origin/main. Refresh source/baseline before implementation.

**What to build:** the Warden exports the current map as a player SVG or PNG representing the same permitted scene as the preview, with the existing palette/print choices and applied geometry, while complete GM image exports remain available.

**Status:** closed. Implemented with ticket 05 under the user's simultaneous `implement` authorization on 2026-11-02. Ticket 06 remains open and unclaimed.

## Blocked by

- [04: Publish Jump Routes and safe physical Station associations](04-shared-routes-and-stations.md).

## Acceptance criteria

- [x] Clearly distinct player SVG/PNG actions export the current cluster map or an eligible Revealed system map from the common projected scene. A Hidden/partial current system is not eligible for an internal player image; a map with no permitted features is refused rather than exported from the source scene.
- [x] Images faithfully show the agreed disclosure modes, recursive anonymous host chain and required Orbits, exact-position unresolved route destinations and published Jump levels. No unrelated hidden systems/objects/satellites, empty Orbits or private route labels are introduced.
- [x] Source subtype halos/glyphs, Location keys, names and GM-only metadata are absent where the mode withholds them. Recompute player counts/bounds and use only player-permitted names/title for accessibility, title bands and filenames.
- [x] SVG serialization consumes a player scene, not a full GM DOM clone with hidden classes. All remaining attributes, IDs, labels, definitions, metadata and any embedded data obey the player allowlist. Do not serialize the source workspace or Field/option inventories as image metadata.
- [x] PNG rasterizes the same sanitized scene. Validate both visible output and its intermediate SVG; no source data is attached as an ancillary application payload. Existing raster edge/pixel limits and finite scene bounds remain effective.
- [x] Active palette and light-print output remain readable. Full-scene bounds, labels/title placement and required geometry are correct at supported desktop/compact states. Image generation does not alter the live GM map, current palette, source data, history or selection.
- [x] Export follows existing guarded preflight, uses authoritative applied geometry and rechecks context/renderer ownership after asynchronous work. Held gestures, modified drafts, previews, save errors and stale map changes do not produce source leaks or a wrong-map export.
- [x] Existing complete GM SVG/PNG and JSON backup behavior remains intact. Generated artifacts agree with the player preview; once the JSON/URL slices are present, integrated acceptance confirms all outputs use the same allowed information.

## Verification and completion

Capture actual SVG/PNG downloads, inspect the entire serialized SVG including accessibility attributes and IDs, and check the intermediate SVG plus PNG pixels/geometry. Include private marker fixtures, partial systems, nested unknown centers, both route orientations, exact unknown destinations, empty/ineligible maps, palette variants, held previews/gestures, failed saves and stale preflight. Run focused existing image/preflight and new player-export browser scenarios, lint and typecheck. Review readable screenshots for affected desktop/compact rendering.

## Scope boundaries

This ticket depends on the object/relationship scene, not JSON or URL transport. Public prose/Fields are not drawn as map imagery, so ticket 03 is not an artificial prerequisite; the image serializer must never fall back to full source data while that parallel slice is absent. Coordinate overlapping shared-renderer edits rather than changing the approved dependency graph. No image-based backup, cloud service or extra annotation/empty-Orbit feature is added. Sensitive privacy review applies.


## Resolution

Implemented all eight criteria. Distinct player SVG/PNG actions render only the current detached public Cluster or eligible Revealed-system scene. Shared geometry preserves exact unknown destinations, required anonymous host chains and Orbits. Images use public titles and filenames, explicit active/light-print paint and the existing bounded native PNG rasterizer. Featureless and ineligible scenes are refused. Context/revision/renderer ownership is rechecked after asynchronous work; full GM images and JSON remain complete and separate.

Real Cluster/system artifacts, whole SVG and PNG intermediate privacy checks, DTO-to-image geometry, palette contrast, nonblank visual inspection and exact source/editor-state preservation passed. Native PNG callback races, held gestures, drafts and actual failed saves passed. The single full suite produced 541 passes/two failures; the unchanged touch replay passed, and the landscape file-menu regression was corrected without weakening focus/viewport assertions. Six affected development and eight final compiled journeys passed; strict types/lint, final production build and all independent reviews are closed. See the [combined implementation and verification record](../tickets-05-07-implementation.md).

Work remains local to `codex/player-view-ticket-01`; ticket 06 was not started and no remote write or feature merge into main occurred.

## Comments

> *This was generated by AI during triage.*

Implementation started on 2026-11-02. GitHub #9 was reread and remains open and unchanged. Starting HEAD is `abcf6625863c74785fb72a5e802dffc82af7a26e`; origin/main is `d40e5f515baf1afeb0e2135461287b243b2a1f6c`. Main was safely fast-forwarded; the coordinator is integrating it into `codex/player-view-ticket-01` before pinning the feature implementation base. See the [combined implementation record](../tickets-05-07-implementation.md).

Post-merge implementation/review base: `b42d39a4cd81b83594695aa22a84be9455cf23b6`. Baseline typecheck, lint corrections, 29 focused pure tests and five browser merge regressions passed; the branch is nine ahead/zero behind origin/main. No complete-suite run yet for this delivery.
