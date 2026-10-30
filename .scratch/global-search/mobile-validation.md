---
title: "Global search: actual mobile input validation"
status: open
---

## Evidence boundary

Ticket 03 requires an actual phone's software keyboard. Desktop Chromium viewport/touch emulation supplements this check but does not satisfy it. No real-device run has been collected. The candidate revision and reachable test URL must be recorded before this protocol is executed; do not test an older deployed build as evidence for the local candidate.

## Setup

Use an isolated local test workspace. Create a workspace, then import [the campaign fixture](../../tests/fixtures/workspace-data-campaign-baseline.json) through Map files and confirm the import. Return to the Jump Cluster. The imported systems include Harrow and its object Harrow Arrival (Location key JP-01).

## Phone journey

1. Record the phone model, OS, browser/version, orientation, candidate revision and URL. Open Search using its visible button.
2. Tap the input and type `Harrow Arrival` with the phone's actual software keyboard. Confirm the result shows Harrow and JP-01 and that no navigation occurs during typing.
3. Tap the result while the software keyboard is present. Confirm Search and the keyboard dismiss, the Harrow map appears, Harrow Arrival is selected, Inspect does not cover the map, and the target's mark/label remain visible after the viewport settles. Pan manually afterward and confirm the camera does not snap back.
4. Reopen Search and confirm the query survived. Replace it with a broad matching query, scroll the result list using touch, then activate a later result. Confirm its context and map agree.
5. Open an object draft, modify a value without applying it, then open Search and rotate the phone. Confirm the query and draft survive. Activate a different target, choose Stay in the existing guard, and confirm the starting map and query remain available. Reopen Inspect and verify the unapplied value remains.
6. In short landscape orientation, search for `Iria` in Vesper Prime (PL-01). Confirm the result remains tappable above the keyboard; after activation and keyboard dismissal, Iria, its hosted Orbit and the child Nix (MO-01) are fully inside the visible map and clear of the controls.

Attach a short recording or screenshots showing actual keyboard entry, result activation and the settled map. Record any failure with its step and browser. This protocol does not certify screen-reader output or an external physical keyboard.

## Result

Pending actual-device access and execution. Do not close the mobile acceptance criterion from this protocol's existence.
