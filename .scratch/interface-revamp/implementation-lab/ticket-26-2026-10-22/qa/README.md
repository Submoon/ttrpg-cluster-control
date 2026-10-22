# Ticket 26 verification

Baseline: `b97f4e07edcd8b5c16bf1649eef0b4bdfafb480f`. The final application remains byte-for-byte identical to the released production build; the later change affects only one native-pointer test oracle. See the source manifests and [execution record](../../../research/implementation-26-2026-10-22.md).

## Completed checks

- Released typecheck and production build pass. Typecheck passes again after the test-only correction.
- Ticket-owned compiled lifecycle/type tests: **10/10**, 27.4 seconds, one worker, zero retries.
- Original long field-configuration journey: passes in **23.3 seconds** on the quiet compiled server, with its original deadline.
- Complete suite: **171/172**, 16.8 minutes, one worker, zero retries/skips/flaky results. The only failed case is the unchanged ideal-angle native-drop oracle discussed below. This is not represented as a fresh 172/172 pass.
- The corrected complete elliptical-Orbit journey passes **1/1**, 24.9 seconds, including all downstream move, image/export and import checks.
- Independent technical and specification/domain reviews have no unresolved source findings; the final geometric oracle receives an additional independent technical review.

## Native-pointer precision

The original oracle expects angle 3.1 before accounting for the native event's integer client coordinates. Passive observation reproduces the same failure and records the actual event, contemporaneous transform, ellipse and rendered point in [orbit-pointer-red.json](orbit-pointer-red.json).

The intended endpoint is (410.07014, 230.40198); the delivered native endpoint is (410, 230). The rendered point lies exactly on the ellipse and is 0.26150 CSS px from the received pointer, closer than the ideal candidate's 0.40805 px. The correction verifies native delivery precision, ellipse membership and this measured distance bound, then adds tight rendered/exported angle and Orbit-identity agreement. It does not increase angular tolerance, replace native input, or change application geometry. These checks establish placement no worse than the intended valid candidate; they do not independently solve global ellipse minimization.

A later complete invocation using two workers is interrupted after unrelated unchanged cases exceed deadlines under parallel load. Its partial [log](full-final.log) is retained. The earlier one-worker complete result and corrected focused result remain distinct. No further broad rerun is performed; no combined/fresh full-pass claim follows.

## Presentation

The coordinator visually inspects the actual compiled captures against the approved Fields prototype:

- [Desktop light, 1440×960](fields-1440x960-light.png): bounded centered list/detail columns, unchanged B/Dock shell and bottom actions.
- [Portrait dark, 390×844](fields-390x844-dark.png): fullscreen list screen and bottom command.
- [Landscape dark, 844×390](fields-844x390-dark.png): compact header, useful body area and reachable bottom actions.
- [Reduced-height light, 390×500](fields-390x500-light.png): retained usable scrolling space and bottom command.

Nuxt UI supplies modal, buttons, inputs, selects, checkboxes and alerts. Application composition supplies session state, inner scrolling/flex layout and a compact visual-viewport sizing adapter; desktop centering and modal layers stay library-owned. Ordinary click/focus checks cover the actual Inspector → Fields → shared draft guard chain and renewed review after Inspector Apply.

Observed opaque text/panel colors exceed 4.5:1 in both themes: minimum muted text **5.51:1**. [Scoped contrast data](contrast-text.json) is not a whole-page/control-state audit.

Physical Android Chrome, actual OS keyboard and safe-area checks are **unavailable**, not passed. Emulated viewport/touch evidence does not certify them. No successor implementation, source-issue closure, PR-ready conversion or merge is performed.
