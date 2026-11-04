---
title: Align player maps with the Warden map interface
status: in-progress
assignee: coordinator
label: wayfinder:implementation
type: implementation
parent: ../spec.md
---

# Align player maps with the Warden map interface

## Source issue

[Align player maps with the Warden map interface — GitHub #40](https://github.com/Submoon/ttrpg-cluster-control/issues/40), created and fetched on 2026-11-04. This local ticket records the requested follow-up scope; GitHub remains authoritative for global completion.

## Request

The user requested this correction on 2026-11-04 after testing PR #39. The standalone player map fills the viewport, but its rendering, navigation and consultation still differ enough from the Warden map to impair usability. The user clarified that this is an implementation ticket in the current player-view effort and must be resolved within PR #39 before merge. It is not deferred follow-up work. Finish qualification of the approved quick-publication controls, then integrate this correction on the same branch.

## Merge gate

PR [#39](https://github.com/Submoon/ttrpg-cluster-control/pull/39) must not be merged until this ticket's acceptance criteria and relevant checks are satisfied. The existing source/player disclosure contracts remain unchanged. GitHub #40 is a reference to the initial request; this local ticket records the clarified current-effort implementation plan.

## Scope

- Use the same recognizable object-type icons as the Warden map wherever the type is published. Keep Unknown presence neutral and do not disclose a hidden type.
- Render player Orbits with the Warden map's dashed treatment rather than solid lines, preserving public geometry.
- Make Inspect useful: show the permitted object identity/type, player text, published Field values and relevant public relationships. Respect Unknown presence and Known type limits and provide clear empty states when no further details are shared.
- Render a genuine nested Hierarchy from the public Orbit/host relationships, with expand/collapse, selection and map navigation. The current flat list of objects is insufficient. Do not infer or reveal omitted branches, names or source counts.
- Place Back to Jump Cluster in the same navigation area as the Warden map's Back action, with consistent desktop and compact behavior.
- Review the complete player consultation flow for consistent labels, interaction, panel layout and navigation. Retain the revelation colors: the user explicitly accepts them.

## Constraints

Player consultation remains read-only and consumes only the sanitized player document. Reuse safe presentation components, icon and styling definitions where appropriate; do not mount Warden commands, private state or persistence. Keep the Revealed-system-only opening rule, immutable snapshot semantics, per-tab isolation and private-data exclusions. Administrative Warden visibility badges are not part of this ticket's player rendering.

## Acceptance criteria

1. A shared fixture with published stars, planets, installations and nested Orbits displays matching type icons, dashed Orbits and the same published geometry in Warden and player maps. Unknown types remain generic.
2. Player Hierarchy represents nested public relationships, supports expansion, and keeps selection/map inspection synchronized at desktop and compact widths, including deep nesting.
3. Inspect displays all and only the permitted details, with useful empty states for partially published objects. No GM notes, Location keys, private Field definitions/options or omitted branches appear in DOM, accessibility text or files.
4. Back to Jump Cluster occupies the equivalent map-navigation position and restores usable cluster navigation/focus on both layouts.
5. Public previews and standalone JSON/link readers use the same corrected presentation. Existing player exports retain their disclosure and geometry guarantees; rendering conventions are checked for consistency where applicable.
6. A focused desktop/compact journey demonstrates open system, expand nested Hierarchy, inspect an object, pan/zoom and return to the cluster. Compare screenshots with the Warden surface, retain existing privacy/read-only tests, and reuse the maintained deep-Hierarchy width checks where applicable.

## Blocked by

The underlying player-view implementation is already available on `codex/player-view-ticket-01`. Its current quick-publication controls are being qualified before overlapping presentation changes begin. No dependency on a future multiple-selection tool is introduced.
