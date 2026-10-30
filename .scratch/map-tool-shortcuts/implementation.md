---
title: Implement map tool keyboard shortcuts
status: closed
---

# Implementation record

## Source and authorization

[Issue #29](https://github.com/Submoon/ttrpg-cluster-control/issues/29) and the user-approved [framing](framing.md) define the scope. The user authorized implementation with subagents, a local commit through the invoked implementation workflow, and publication as a PR after verification. Merge and direct source-issue updates remain outside the requested work.

Implementation uses branch `codex/issue-29-map-tool-shortcuts` in the existing isolated checkout. A fresh fetch on 2026-10-30 confirmed HEAD, local main and origin/main at `8d4b66504ca6723db5405ed7cb93d0a666264c9a`, with zero divergence. The source issue was re-read the same day: open, unchanged requirements, no comments. There is no alternate base. Unrelated `.codex/environments/` files are preserved and excluded.

## Delivered behavior

Produced letters N, S and M invoke the existing guarded Navigate, Select and Move commands while the map root or an ordinary cartographic mark owns focus. A opens the existing contextual Add chooser, focuses its first enabled type and creates nothing. Escape first closes a keyboard-opened chooser, preserves the armed Add type and returns usable focus to the originating map; subsequent Escape follows existing cancellation rules.

A page-owned composable rejects modifiers, repeats, composition, handled events, keyboard widgets, overlays and active gestures. Ignored keys are discarded. It owns listener cleanup and temporary input tracking; asynchronous focus restoration checks the current context and focus owner. Existing controllers retain ownership of creation, drafts, operation boundaries and history.

The toolbox displays key badges and shortcut attributes. Persistent descriptions link the map and controls to the focus scope; wrapped local tooltips expose help on keyboard focus and pointer hover. The existing Add button remains the popover trigger. Help occupies no permanent layout space, and the global workspace grid is unchanged.

## Coordination and verification

Two developers owned disjoint source/core-test and guard-test scopes. The coordinator owned Git, runtime, browser validation and documentation. An architect assessed a demonstrated layout regression; an independent reviewer inspected the frozen integrated candidate. Product source and tests remain frozen during integrated checks.

Public UI TDD established failing then passing slices for N, produced-letter dispatch, ordinary mark focus, A opening, Escape and local help. Final runtime candidate: staged product tree `2b6f4ce1fdafc989ccef18ac90154a0d4b48467e`, compared with the baseline above; planning documents are recorded separately.

The complete suite executed 449 tests: 444 passed and five failed. Four failure paths contained obsolete raw-text expectations after visible key badges were added; semantic names, state and active-type absence now replace those expectations while preserving gesture/data assertions. A long in-flow help paragraph also changed Dock geometry. Hiding only that paragraph made the two remaining placement/Move reproducers pass. The final local-tooltip design removes that layout impact and restores the original grid. New 1280, 900 and 800px regressions check zoom reachability and real map placement.

A subsequent 45-scenario run passed 29 cases before a browser process crash; its unexecuted cases are not completion evidence. After resuming, the coordinator restarted the owned server and the same 45-scenario selection, covering all 18 new shortcuts/guards, the five original failures, history keyboard ownership and maintained UI smoke journeys. This run passed 44/45 (6.8 minutes), with a first-workspace startup timeout; that unchanged test passed its exact isolated rerun, 1/1 (21.8 seconds). All five original failures and all 18 new cases pass. No cases were skipped in the completed full run, resumed selection or isolated rerun. Reports: `test-results/map-tool-shortcuts-resumed-final*` and `test-results/map-tool-shortcuts-history-recheck*`.

Final help-focused checks and desktop/390px screenshots were inspected: help wraps completely within the viewport, badges remain visible and Dock bounds do not change on help display. Browser emulation verifies event semantics and responsive behavior, not physical AZERTY/QWERTY keyboards, OS-reserved chords or screen-reader output.

Independent reviewer closure: no findings or blocking defects across all 12 changed files, related commands/renderers, widget ownership and Nuxt/Reka tooltip/popover focus lifecycles. The reviewer also inspected desktop/390px screenshots, checked component cohesion and meaningful legacy test assertions, and made no changes or runtime claims.

Final `npm run lint`, `npm run typecheck` and `npm run build` passed, with delivery logs under `test-results/map-tool-shortcuts-{lint,typecheck,build}-delivery.log`. The production build completed in 3 minutes 9 seconds; bundle-size, plugin-timing and dependency deprecation/annotation warnings remain visible. Successful earlier suite evidence is reused for unchanged behavior under repository verification guidance; a clean first-pass full-suite result is not claimed.

## Resolution

Implementation and local verification completed on 2026-10-30 with no unresolved reviewer findings. The owned development server is stopped. Source, tests and these planning records are ready for the authorized commit and PR; generated test artifacts and unrelated environment files are excluded. GitHub CI results belong to the published PR and are not claimed by this local record.

## CI follow-up

PR [#35](https://github.com/Submoon/ttrpg-cluster-control/pull/35) initially passed static checks and browser shard 2. Shard 1 passed 137/138 scenarios; its sole failure was the existing elliptical Orbit export/import journey, expecting horizontal radius 320 after a native drag but receiving 319. The quality gate failed as a consequence.

A minimized public-UI reproduction confirmed integral CSS-pixel quantization at fractional zoom: scale `0.5754602689861453`, intended client X `792.4208954914542`, rounded client X `792`, resulting world radius 319. The unchanged renderer produced exactly that radius. The corrected probe passed using the captured pre-gesture transform and measured native mouse delivery, with exact radius assertions and start/end errors bounded by `Math.SQRT1_2` CSS pixels. Temporary instrumentation and the probe were removed.

Only `tests/system-orbits.spec.ts` changes in the correction: horizontal-axis expectations now derive from actual delivered input through the existing shared helpers; dependent axis/global-scale assertions reuse that radius. Production behavior and radius tolerances are unchanged. The original journey passed three consecutive runs against the unchanged production build (3/3, one minute). Independent review found no defects or blockers and confirmed downstream angle, persistence, export and import assertions remain meaningful. Follow-up lint/typecheck and the new exact-head CI run are recorded in the PR; this local record does not predict their outcome.

Branch preview: [map tool shortcuts](https://ttrpg-cluster-control-git-codex-issue-29-map-too-1010d8-submoon.vercel.app). This alias follows the branch; CI selects the immutable deployment for each tested head.
