---
title: "Show type icons in Search results"
status: in-progress
assignee: followup04_icons
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 04: Show type icons in Search results

## Source and scope

Requested directly by the user on 2026-10-30 as a small follow-up to the completed [Global search with branch-aware map framing](../spec.md). Add a leading type icon to each Search result so entities can be recognized at a glance.

Planning baseline: `8fea36283b9eac0ef1cfa49fd7f8f5f4479e13d5` on `codex/global-search`. Freshly fetched `origin/main` is `d40e5f515baf1afeb0e2135461287b243b2a1f6c` (0 behind / 20 ahead); the feature branch deliberately includes the completed Search implementation.

## Blocked by

None. [Find and reveal objects across every system](03-global-object-reveal.md) is closed.

## Acceptance criteria

- [ ] Each object result displays its existing catalogue glyph for the canonical family/subtype, consistently with Add, Hierarchy and the map. Reuse `objectMark` / the shared catalogue rather than mapping translated/display labels to icons.
- [ ] Jump Cluster and star-system results have distinct, appropriate icons consistent with the existing editor icon vocabulary.
- [ ] Keep the name, textual type, system context, Location key and occurrence number readable. Icons are decorative (`aria-hidden`) and do not duplicate accessible result labels.
- [ ] Leading icons remain aligned with short, wrapped and duplicate-label results on desktop and compact screens, with usable pointer/touch targets and visible keyboard highlighting.
- [ ] Matching, ranking, result identity, complete result reachability, keyboard/touch activation, draft guards and map reveal keep their existing behavior.

## Implementation pointers

Start with [WorkspaceSearch.vue](../../../components/WorkspaceSearch.vue), its current `UCommandPalette` item composition, [search presentation data](../../../utils/workspace-search.ts) and [the shared glyph catalogue](../../../utils/catalogue-marks.ts). Derive any needed presentation metadata from the entity's canonical type; keep it independent of the searchable/display text and persisted workspace data.

## Verification

Use a focused public Search journey covering cluster/system results and representative object types, including `other`, plus compact long-name/disambiguated rows. Confirm the existing shared glyph mapping, accessible labels and deliberate activation. Run applicable lint/typecheck and affected Search/UI checks; reuse unchanged matching/navigation coverage.

This follow-up is separate from the already completed three-slice specification.

## Implementation checkpoint

Implementation authorized on 2026-11-02 on the existing `codex/global-search` branch. Re-fetched `origin`: HEAD remains `8fea36283b9eac0ef1cfa49fd7f8f5f4479e13d5`, and `origin/main` remains `d40e5f515baf1afeb0e2135461287b243b2a1f6c` (0 behind / 20 ahead). The intentionally different feature baseline contains tickets 01–03. Local `main` is checked out in another worktree and is left untouched.

The Search specialist owns `WorkspaceSearch.vue`, Search presentation metadata and focused Search tests. Ticket 05 runs in parallel with disjoint file ownership. The coordinator owns Git, runtime resources, integrated checks and review.
