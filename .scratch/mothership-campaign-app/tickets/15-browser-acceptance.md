---
title: 15. Verifying the V1 workflow in one browser acceptance test
label: wayfinder:implement
type: implement
status: open
triage_labels:
  - enhancement
  - ready-for-agent
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 15. Verifying the V1 workflow in one browser acceptance test

## What to build

As a Warden, I can rely on one browser-level acceptance path to verify that the complete local campaign workflow works together, from editing and persistence through import and exports.

## Acceptance criteria

- One browser-level acceptance seam exercises creating and editing a Jump Cluster and nested system map, then reloads and verifies the saved state.
- The scenario verifies map navigation and accessible controls, and confirms/cancels a dependent deletion.
- The scenario verifies JSON import preview, cancellation, confirmed copy creation, ID/reference remapping, custom-field definition remapping, and preservation of existing entities.
- The scenario verifies cluster/system JSON exports and complete PNG/SVG exports.
- Assertions target observable behavior and persisted/exported results at the application boundary, not Nuxt, Vue, D3, or IndexedDB internals.

## Blocked by

- [05. Creating and restoring a local campaign workspace](05-local-campaign-workspace.md)
- [06. Building a star-system map with nested Orbits](06-star-system-map.md)
- [07. Adopting Tailwind CSS for the Nuxt interface](07-tailwind-css.md)
- [08. Connecting Jump Points across a Jump Cluster](08-jump-cluster-routes.md)
- [09. Adding native and reusable custom fields](09-object-fields.md)
- [10. Navigating and arranging both map views](10-map-navigation.md)
- [11. Safely deleting dependent map entities](11-safe-dependent-deletion.md)
- [12. Exporting clusters and systems as versioned JSON](12-json-export.md)
- [13. Importing JSON as a safe independent copy](13-json-import.md)
- [14. Exporting complete maps as PNG and SVG](14-image-export.md)

## Source specs

- [Mothership Campaign App - V1 Specification](../spec.md)
- [04. Choosing the V1 application and rendering architecture](04-application-architecture.md)
