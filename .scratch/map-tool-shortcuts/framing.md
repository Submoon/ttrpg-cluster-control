---
title: Frame map tool keyboard shortcuts
status: closed
---

# Map tool keyboard shortcuts

## Source issue

- [Add keyboard shortcuts for map tools and show them in the toolbox (#29)](https://github.com/Submoon/ttrpg-cluster-control/issues/29), read through `gh issue view` on 2026-10-29, including body, comments, labels and state.
- Source state: OPEN; label: `enhancement`; no comments. No remote changes are authorized.
- Existing requirements: consistent shortcuts for Navigate, Select, Move and Add; visible hints beside each tool with accessible help; no activation during text entry or keyboard-owned dialogs/widgets; preserve Escape and browser/map interactions.
- The issue explicitly defers this work beyond the interface revamp and Fields prototype. Its declared blocker [interface revamp #3](https://github.com/Submoon/ttrpg-cluster-control/issues/3) is CLOSED (2026-10-27). [Undo/redo #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5) is CLOSED (2026-10-29). Their implementation is present in this baseline.

## Framing-phase baseline and authorization

- Isolated task checkout, initially at detached HEAD.
- Successful `git -c core.fsmonitor=false fetch origin` on 2026-10-29.
- HEAD = local main = origin/main = `8d4b66504ca6723db5405ed7cb93d0a666264c9a`; `HEAD...origin/main` divergence: 0 / 0. This matches the parent chat's last known main. No intentional alternate base and no fast-forward needed.
- Existing untracked `.codex/environments/` is unrelated and preserved. Git metadata is in the primary checkout; fetch needed sandbox escalation. Disable fsmonitor for inspection because its IPC endpoint fails in the sandbox.
- Authorized work: analysis, user clarification and local planning only. No product implementation, issue updates, commits, push, PR or merge.

## Recommended route

Use `ask-matt` routing to a bounded `triage` with a `grilling` clarification round and `domain-modeling` vocabulary discipline. The named skills were read before application, including `grill-with-docs`, the documented repo interview wrapper. Respect this repository's overrides: GitHub is the request authority, this local effort records its framing, and `CONTEXT.md` is the existing domain context. No duplicate glossary, tracker setup or new domain term is needed.

This is a small improvement to existing tools, suited to one focused behavior change. The implementation route would be Standard under project-development: developer, then independent reviewer, preserving existing guarded commands and persistence behavior. This document records the user-approved framing and acceptance criteria, not an instruction to begin implementation.

Recommended category: enhancement (already assigned). Recommended readiness: ready-for-agent now that the user has confirmed all four product decisions. These are recommendations, not applied labels; implementation still needs a separate user instruction.

## Verified repository facts

| Concern | Evidence and implication |
| --- | --- |
| Existing toolbox | `components/WorkspaceDock.vue` exposes Select, Navigate, Move through `commands.map.changeMode`; a separate Add popover uses parent-owned `creationChooserOpen`. No tool-letter shortcut or shortcut hint was found in Dock, page, map or shortcut handlers. |
| Modes | `stores/editor-ui.ts` owns transient mode state. The resolved tools contract in `.scratch/interface-revamp/tickets/11-finalize-tools-contract.md` makes Select default/leftmost, Navigate exploratory, Move geometric, and Add persistent and type-specific. Do not change ordering or intent. |
| Guarded mode entry | `components/BaselinePage.vue`'s `changeMapMode` calls `beforeWorkspaceOperation`, exits Add when active, then calls navigation's `setMapMode`. That operation boundary can complete a pending continuous Orbit adjustment or reject a busy operation. Reuse it rather than writing store state from the listener. |
| Draft ownership | `setMapMode` itself is not a general Apply/Discard dialog: it delegates to the operation boundary and sets the mode. Preserve existing chart, Inspector and route drafts rather than inventing a new global draft gate. Choosing/placing an Add type continues through its specialized existing controller. |
| Add entry | The popover offers System / Jump Route on the Jump Cluster map and catalogue objects / Orbit in system view. Opening the popover is different from arming a type and from placing data. Opening Add alone must not become a workspace mutation. |
| Add lifecycle | Type choice, previews and repeated placements remain owned by the existing creation controllers. Switching ordinary mode exits Add; quitting Add returns to Select. Closing its chooser preserves the armed Add type. |
| Existing history bridge | `composables/useWorkspaceHistoryShortcuts.ts` observes bubble-phase window events, rejects repeats/composition/handled events/editable descendants, and checks page overlays plus popup ownership. It uses produced `event.key`, Ctrl/Cmd+Z, Ctrl+Shift+Z, Ctrl+Y, Cmd+Shift+Z. Blocked workspace traversal is discarded immediately. |
| Overlay evidence | `BaselinePage.vue` supplies History, chart names, Fields, Map files, recovery, capacity consent, Add chooser, compact panel, deletion review and import-review state to history keyboard ownership. These form a starting inventory; the new listener must cover keyboard widgets too rather than blindly copy a partial guard. |
| Focus surface | ClusterMap and SystemMap render focusable SVG roots (`tabindex=0`, `role=group`) and expose `focusMap`. Descendants have their own entity and geometry controls. Existing descriptions explain arrows and Enter/Space and must remain available. |
| Escape | The Add popover consumes Escape to close itself. The page then handles targeting/Move previews or exits Add; SystemMap capture-phase handling separately cancels an active renderer edit. Escape is not a new general Select shortcut. |
| Existing Delete | `useClusterWorkflows` registers its own Delete handler with control, save and dialog checks. Its behavior is outside this issue; avoid routing letters through it or broadening its semantics. |
| Existing map keys | `WorkspaceMapCanvas.vue:383` captures arrows for targeted Move (1, Shift+10) or root-map pan (80). Root Enter/Space offers the visible map center for armed Add (`ClusterMap.vue:531`, `maps/system-map-renderer.ts:647`). Entity marks expose Enter/Space; Orbit ring/axis/rotation handles can be sliders with arrows, Home/End and Shift step changes (`maps/system-map-renderer.ts:830`). These keyboard widgets require explicit ownership, not a map-descendant shortcut blanket. |
| Gesture and focus seams | `WorkspaceMapCanvas.vue:740` cancels gestures synchronously on mode change; existing active-edit notifications and `SystemMap.vue:394` Escape rollback are relevant to shortcut admission. Both renderers preserve logical entity/control focus through redraw. Reuse those lifetimes; a pointer ending after a refused shortcut must still finish its original gesture normally. |

Redundancy search covered Dock/page tool entry, map/canvas handlers, editor workflow commands, store mode actions, history shortcut bridge, and keyboard/creation tests. The requested letter shortcuts and hints are absent in inspected paths. No `.out-of-scope/` directory exists, so no prior local rejection was found. Static verification only: no claim of runtime reproduction or product test results.

## Agreed initial scope

1. Four fixed shortcuts, one dispatch per eligible non-repeated keydown: `N` Navigate, `S` Select, `M` Move, `A` open Add chooser. Use the produced letter, not physical key position, on AZERTY and QWERTY. Reject Ctrl, Meta, Alt, AltGraph and Shift; accept Caps Lock. No configurable bindings or additional aliases in this initial scope.
2. Activate only while the current map surface or an ordinary cartographic entity owns focus. Inspector/Hierarchy/Dock controls, form fields, editable ancestors, sliders/comboboxes/listboxes and other keyboard widgets retain their input. Explicit map geometry widgets keep their own keyboard operation. Do not use a blanket `role=button` exclusion: map entities also expose button-like activation.
3. Reject handled events, composition (including legacy composition signals), repeats, an absent workspace, keyboard-owned overlays or an active gesture. Ignore blocked input without queueing it. Keep the page-owned listener lifecycle safe across SSR, mount, responsive reflow and disposal.
4. Dispatch N/S/M through the existing guarded mode command. Retain usable map focus after an accepted change; do not steal focus after a later user navigation or rejected/stale request. Preserve selected data, viewport, existing drafts and operation boundaries as current commands do.
5. A opens the existing chooser and focuses its first enabled choice in the current map context. It neither creates data nor silently rearms the previous type, even when Add is already armed. Repeated A while the chooser owns the keyboard is ignored. Escape closes that chooser and returns focus to the originating map, retaining the previously armed type; later Escape uses the existing cancellation rules. Pointer-opened chooser focus behavior need not be redesigned.
6. Display the assigned key beside each tool in the current toolbox on desktop and compact layouts. Preserve clear control names and pressed/expanded state. Expose `aria-keyshortcuts` with truthful bindings, plus focus/scope help available to keyboard and pointer users, linked to controls and map descriptions. A badge or native `title` alone is insufficient help.
7. Keep history shortcuts, Escape, Delete, arrows, Enter/Space, Orbit manipulation, browser chords, saving and all creation semantics intact. A tool change itself adds no history action; an existing operation boundary may finish a pending adjustment under its existing rules.

The agreed focus-limited scope addresses the active-on-focus option of [WCAG character key shortcuts](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html). A wider editor-global letter scope would require revisiting a way to disable or remap those shortcuts. [KeyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) follows keyboard layout/modifiers, whereas [KeyboardEvent.code](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code) identifies physical positions. These references support the design; they do not establish physical-device testing or implemented accessibility conformance.

## User decisions

All four recommendations were explicitly accepted by the user on 2026-10-29:

- Q1: N/S/M/A follow produced letters on AZERTY and QWERTY. No Ctrl/Cmd/Alt/AltGr/Shift; Caps Lock works; held-key repeats are ignored.
- Q2: Only map background or ordinary cartographic-entity focus admits the shortcuts. Text entry, IME, keyboard widgets, open overlays and active gestures retain ownership. N/S/M preserve usable map focus; ignored input never replays.
- Q3: A opens the existing chooser and focuses its first usable choice even when Add is already armed. It creates nothing and does not automatically resume a type. Escape closes the chooser, restores map focus and preserves the armed type; subsequent Escape follows existing rules.
- Q4: Show hints beside tools, truthful `aria-keyshortcuts` and short local help explaining map-focus scope, available through keyboard focus and hover, on desktop and compact layouts. No dedicated shortcut-help view is requested.

Re-evaluating these answers leaves no unresolved product decision for this bounded scope. Existing tool, draft, placement and history contracts govern the remaining behavior. If implementation exposes a conflict with those contracts, surface that concrete conflict rather than silently changing the scope.

## Acceptance criteria recorded during framing

The unchecked boxes below preserve the original implementation handoff. See the [implementation record](implementation.md) for the subsequent delivery and verification outcome.

- [ ] On both maps, eligible N/S/M activate the corresponding existing mode once and update the toolbox's active state. Pressing the already active mode is stable; existing Add exit semantics still apply.
- [ ] Produced `a` with differing physical `code` values yields the same Add behavior; a physical `KeyA` producing another character does not accidentally activate Add. Cover analogous representative case for M; Caps Lock remains usable and disallowed modifiers/repeats do nothing.
- [ ] A opens the correct contextual chooser, focuses a usable first choice, makes no data/history change, and does not silently replace a pending Add session. Keyboard type selection then uses existing Add behavior.
- [ ] No tool activates from text inputs (including empty ones), textareas, selects, nested contenteditable, IME, widget-owned events, dialogs/popovers or outside the agreed focus scope. Rejected inputs never replay later.
- [ ] Escape closes the chooser first, preserves armed Add and restores usable map focus; later Escape retains existing preview/gesture/Add behavior. Failed commands preserve current focus and state.
- [ ] Pointer gestures, map targeting, arrow-based pan/nudge/Orbit operations, Enter/Space and Delete remain operable. A shortcut during an active gesture cannot publish a stale release or destroy a preview.
- [ ] Ctrl/Cmd history, Ctrl/Cmd browser chords, Alt/AltGr input and native text Undo/Redo keep their current ownership; a tool change creates no new history step. Existing save-error/capacity/adjustment rules are preserved.
- [ ] All four hints are visible in the toolbox, including compact layout; accessible names, shortcut attributes, state and scope/help agree with actual bindings. Help and focus indicators work without hover.
- [ ] Listener cleanup and responsive map remounts do not cause duplicate activation; absent workspace receives no tool shortcut.

## Risks, dependencies and verification

- Main risks: confusing produced letters with physical positions; overbroad capture starving keyboard widgets or assistive input; focus theft on asynchronous commands; competing Escape listeners; Add arming confused with chooser opening; mode changes during active gestures; accidental history publication or duplicate listeners.
- No outstanding implementation dependency on #3 or #5 at the recorded baseline. Recheck current main and source issue before implementation. Other parallel issues are not blockers unless they alter toolbox ownership, map focus, guards or keyboard interactions; no other chat was contacted.
- Keep keyboard policy local to this addition. Reuse small existing ownership predicates if helpful, but do not turn this into a global shortcut registry, history refactor, new persistence/settings subsystem, placement rewrite or UI redesign.
- Likely source seams: page-owned shortcut bridge; guarded editor command surface; Dock hint/help rendering; map descriptions and chooser focus entry/return. Extract shared ownership logic only when needed to avoid inconsistent checks with history.
- Future validation: lint, typecheck, focused shortcut policy/ownership checks and public Playwright journeys for both map contexts, Add/Move and Escape, plus existing `workspace-history-keyboard`, `workspace-add-route-targeting`, `workspace-system-creation` and affected gesture scenarios. Reuse public helpers. Check desktop and compact toolbox layout, help and focus visually. Select the final suite by actual changes; repository delivery guidance requires one complete suite on the integrated implementation candidate.
- Relevant narrower regressions include `workspace-navigation.spec.ts:442` (root versus Orbit arrows), `workspace-object-placement-guards.spec.ts:43` (keyboard Add center), `workspace-system-gesture-arbitration.spec.ts:293` (Escape and late release) and `:454` (keyboard activation of the Select button cancels rotation), `workspace-orbit-adjustment-gestures.spec.ts:36` (held arrows group into one history action), and `workspace-system-creation.spec.ts:215` (Move exits Add even if already the underlying mode). Pointer/button transitions retain their existing behavior even if new letter shortcuts are deliberately ignored during active gestures.
- Browser emulation can verify event semantics and responsive behavior, not physical AZERTY/QWERTY layouts, OS/browser-reserved chords, speech input or screen-reader output. Record focused physical keyboard and assistive-technology checks separately if claimed.
- This framing changes no product source and runs no product tests. Documentation verification is limited to source/reference existence and baseline/issue evidence.

## Resolution

Framing completed on 2026-10-29 after the user's explicit acceptance of Q1–Q4. The local `closed` status refers only to this analysis and clarification effort. Source issue #29 remains open with its existing label; no GitHub write was performed. No product code, tests, commits, push, PR or merge were requested or performed. The next authorized step requires a separate implementation instruction; refresh the source issue and Git baseline before taking it.

The user subsequently authorized implementation with subagents and a PR after successful verification. See the [implementation record](implementation.md) for that separate phase, its baseline and validation evidence.
