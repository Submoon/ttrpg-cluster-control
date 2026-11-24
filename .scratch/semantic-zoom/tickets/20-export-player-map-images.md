---
title: "Export all three player map image scopes"
status: closed
assignee: Codex
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 20 — Export all three player map image scopes

## What to build

Offer the same three PNG and SVG scopes in player preview and reader using only the detached published document and the current public view where applicable.

## Blocked by

- [Inspect shared Jump Routes in the player views](17-inspect-shared-player-routes.md)
- [Export all three Warden map image scopes](19-export-warden-map-images.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 41–47, 53–56.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [x] Entire Cluster frames the published overview and permitted anonymous destinations. Selected system frames its complete public detail and dashed public route segments. Current viewport preserves public framing, detail and filters.
- [x] Images contain only permitted marks and published path geometry. Public bounds and image content do not change when private source extents change without changing the document. Disclosure for attached Jump Points and anonymous ends matches the view.
- [x] Older shares export using the cleaned public document, with no same-system loops and no inferred Jump Point associations.
- [x] PNG and SVG obey the same scope behavior used by the Warden image workflow. Verify the public serializer against paired disclosure fixtures and one representative download from the shared player experience.

## Resolution

## Resolution

- Added scoped PNG and SVG controls to the shared Reader and Player Preview, keeping the Warden quick Player actions and file/link behavior compatible.
- Entire Cluster frames the authorized overview and anonymous ends. Selected system includes all its authorized detail and bounded dashed incoming and outgoing route stubs. Current viewport uses the actual drawable rectangle, camera, owner-qualified filters, logical detail, and route-label context. Both formats serialize the same detached public scene, with no Warden draft or private data.
- Fixed an admitted anonymous destination coincident with a system anchor. Its neutral marker and caption keep the authorized coordinates above the anchor in the live player views and in Entire Cluster and Current viewport. The route stroke remains below the system, and pointer selection focuses the single existing keyboard target. Warden inline markers and selected-system stubs retain their existing paths.
- Independent privacy and behavior reviews found the overlap issue and rechecked the corrected candidate. Paired tests prove independent private extent changes leave all three public images equal. Additional tests cover exact v1 and v2 disclosure, repeated local IDs, generic and empty systems, bounded stubs, and stale image dispatch.
- Exact source `d923d4ada99363bf982ec83bc5b4a2e357430157` passed generated Vue types and representative Chrome reader coverage. The maintained browser case opened a legacy share, exported Current viewport SVG and checked drawable crop and dimming, excluded the legacy loop and Search locator, and activated the coincident anonymous destination. A supplementary Chrome run downloaded all six Reader scope/format combinations plus a Selected system PNG in Player Preview. It verified actual PNG signatures and dimensions, and checked public SVG content. Local evidence is `20-public-image-downloads.json`.
