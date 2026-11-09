---
title: Locate dimmed Warden Search results
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 15 — Locate dimmed Warden Search results

## Parent

[Display filters for the Warden and player consultation](../spec.md)

## What to build

A Warden can activate a text result that is dimmed by the map criteria and locate the exact target without changing filters or losing the context of its complete hosted branch.

## Blocked by

- [Filter Warden system maps by type](13-warden-type-filters.md)

## Acceptance criteria

- [ ] Map filters leave text Search membership, ranking and result rows intact. An object result can be selected from another star system regardless of its dimming.
- [ ] Use the existing Apply, Discard and Stay navigation guards. Successful activation frames the target and its recursively hosted Orbits and occupants. Include dimmed object bounds even when the target is normal and only a descendant is dimmed.
- [ ] Show a separate locator on the target only when it is dimmed and the framing succeeded for the current destination. In a compact layout wait for the Search and keyboard transition to settle and the map to be visible. Preserve object opacity, selection dimming and the active criteria.
- [ ] Clear the locator on the first deliberate map interaction or when the destination, selection or dimmed target no longer owns it. Activation focus transfer keeps it visible. A repeat activation can frame again and show a fresh locator.
- [ ] A rejected, invalid, stale or superseded activation produces zero new locators. Deferred work stays bound to the accepted target, destination and current map.

## Verification

Extend the guarded Search workflow coverage for rejected and superseded requests, repeated activation and dismissal. Use the maintained compact Search browser journey to observe a dimmed target and branch containment after the map settles.
