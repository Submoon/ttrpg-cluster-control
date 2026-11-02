---
title: "Global search: actual mobile input validation"
status: closed
---

## Evidence boundary

Ticket 03 requires an actual phone's software keyboard. Desktop Chromium viewport/touch emulation supplements this check but does not satisfy it. The user executed the requested journey on the branch preview after its deployment of candidate `afa33c00` was verified ready; the actual-device result is recorded below.

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

On 2026-10-30 the user reported: **“Nothing Phone 4a pro, firefox, et ça fonctionne”**, answering the explicit request to test software-keyboard entry, tapping an object result in another system, keyboard dismissal followed by visible target/branch framing, and draft preservation after Stay. Record this as a successful user-reported actual-phone journey on **Nothing Phone 4a Pro / Firefox** at the [rolling branch preview](https://ttrpg-cluster-control-git-codex-global-search-submoon.vercel.app), deployed from `afa33c00` when shared.

The OS version, Firefox version and a recording/screenshots were not supplied. No broader physical-keyboard or screen-reader certification is claimed. This result is actual-device user testimony, separate from the coordinator's automated desktop/compact Chromium evidence.

The user subsequently requested native Navbar/Toolbar/CommandPalette and proposed Tree. After Vercel deployment **7443136252** for **dfc5c362bac9be64872f94ce6feb860cb8bdcb99** was confirmed ready, the coordinator requested a focused repeat on the rolling branch preview: software-keyboard entry, tapping an object result in another system, target visibility after keyboard dismissal, and draft preservation plus usable Search after Stay. The user answered **“Tout fonctionne sur le téléphone”** on 2026-10-30. This confirms the updated native Palette journey on the previously identified **Nothing Phone 4a Pro / Firefox**. No additional OS/browser version or media was supplied; the same evidence limits apply.

The later redundant empty-hint removal and desktop keyboard-opening shortcut do not replace the phone input widget or its guarded activation/framing path. See [the native presentation refactor](dashboard-refactor.md) for those follow-up changes and automated evidence.
