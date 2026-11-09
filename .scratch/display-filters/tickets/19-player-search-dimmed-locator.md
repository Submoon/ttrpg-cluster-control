---
title: Locate dimmed results in player consultation
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 19 — Locate dimmed results in player consultation

## Parent

[Display filters for the Warden and player consultation](../spec.md)

## What to build

A player or preview user can find a published dimmed object through the current text Search and identify it when the selected destination map becomes visible.

## Blocked by

- [Filter player maps by published type](17-player-published-type-filters.md)

## Acceptance criteria

- [ ] Keep the existing public text results and ranking with map filters active. Selecting an object result opens its published system if needed and follows the ordinary Inspect selection flow.
- [ ] Reveal the selected anchor at the destination's current zoom by panning as needed. The complete-map **Fit** command remains available independently.
- [ ] After a successful Search reveal, show a locator on a dimmed target only. When a compact panel covers the map, defer reveal and the locator until the map is visible.
- [ ] Keep the target's dimming, current criteria and public Inspect content. Clear the locator on the first deliberate map interaction. Changing the public document, system or selection invalidates deferred work and any locator belonging to the old target.
- [ ] Both standalone reader and Warden preview use the same public reveal and locator behavior.

## Verification

Extend the public-view workflow coverage for a cross-system result, document replacement and an obsolete selection during deferred reveal. Use an existing compact player browser journey to verify the target becomes visible after Inspect closes and the locator clears on map interaction.
