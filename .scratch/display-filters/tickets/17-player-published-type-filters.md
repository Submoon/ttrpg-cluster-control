---
title: Filter player maps by published type
status: closed
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 17 — Filter player maps by published type

## Parent

[Display filters for the Warden and player consultation](../spec.md)

## What to build

The player can filter published system maps by type in the reader, and the Warden can do the same independently in preview. Dimmed objects remain navigable within the complete public scene.

## Blocked by

None.

## Acceptance criteria

- [x] Offer an accessible Type filter in the shared player consultation on published star-system maps. The standalone reader and the Warden preview each own a separate active set, independent of the Warden's map filters.
- [x] Each consultation starts unfiltered and retains its criteria when navigating within the same document. Reload, preview reopening and document replacement start fresh. Published JSON and links open a fresh consultation.
- [x] Derive type options and match feedback from the current public document. Use published family and subtype for Known type and Revealed objects. When Unknown presences exist, offer **Type not revealed**, which also matches neutral placeholders for required Orbit hosts.
- [x] Accept alternatives within Type with OR. Empty Type leaves the full public view at normal opacity. Provide a way to see and clear the active filter.
- [x] Dim nonmatching marks and their selection treatment. Keep the complete public Hierarchy with accessible dimming cues, Inspect details, and object and Orbit selection by pointer, touch and keyboard. Retain published host and occupant relationships and normal Orbit-ring opacity.
- [x] Public text Search keeps its existing results under active map filters. **Fit** uses the full published scene. Existing SVG and PNG exports render the complete active public map at normal opacity from the public document.
- [x] Type options, accessible labels, counts and exported public content stay within the existing publication boundary. A private type behind an Unknown marker contributes only the public Unknown category.

## Verification

Use a public fixture with Known type, Revealed and neutral Unknown markers to verify options and scope. Extend the shared player browser path for filter and clear, retained navigation and independent consultations. Check complete public image output with an active type criterion.

## Resolution

The reader and preview offer independent session filters based on the public document, including Type not revealed. Dimming preserves map interaction, Hierarchy, Inspect, public Search and complete map framing. The player image exporter uses the complete public scene.

The public fixture covers Known type, Revealed and Unknown markers. Chromium journeys cover compact reader navigation and clearing, a complete SVG with an active criterion, and a fresh preview after reopening.
