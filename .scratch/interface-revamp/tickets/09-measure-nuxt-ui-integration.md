---
title: Measure Nuxt UI integration, offline resources, and comparative performance
status: closed
assignee: SOL6.1High
label: wayfinder:task
type: task
mode: AFK
parent: ../map.md
---

## Parent map

[Revamp the interface: make the map central on desktop and mobile](../map.md)

## Question

What representative runtime integration and cost evidence can the accepted B direction supply before the human decides final Nuxt UI adoption, and which required behaviors remain unsupported by this disposable trial?

## Context and scope

Created on 2026-10-14 because the direction choice is settled while the measurements required by [Decide Nuxt UI adoption and scope](07-nuxt-ui-adoption.md) remain absent. This task produces evidence, not product implementation or a library verdict. Baseline: `629d2a98715c3a16b954e0f77c639b1f0c31212c`, confirmed by the root's fresh fetch on 2026-10-14 with `main == origin/main`, zero ahead/behind. Refresh the baseline and [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3) when claiming; name any intentionally different measurement base.

Use the accepted B capture linked in [Interface prototype evidence and comparison plan](../prototype-evidence.md), preserving the original A/B/C and hybrid captures. Existing typecheck/build success and absence of captured hydration warnings are limited evidence. Theme is session-only, saving is simulated, and viewport is not shared across variant remounts. No measurements below have passed merely because the trial compiles.

## Required evidence and artifact

Write `../research/nuxt-ui-integration-evidence.md`, with reproducible methods, exact source commits, package/browser versions, data/scenes, device or CPU/network settings, executed results, failures, and unmeasured limitations. Link request traces, build output, and timings as appropriate.

- Exercise the retained SSR shell and `ClientOnly` maps: first render/hydration, provider/Tailwind/CSS coordination, form/focus styling and nested overlays in both themes. Record the distinction between SSR HTML, hydrated controls, and map mount.
- Check the first OS-derived theme, explicit remembered choice on reload/browser session, and stable drafts/context on theme change. If the disposable session-only theme cannot establish these results, identify the missing integration and the exact future acceptance scenario; do not claim durable theme support or expand this task into a production rewrite.
- Capture actual offline icon/font/resource requests, including selected/dynamic icons and freshly opened dialogs/catalogue. Describe whether cold and warm offline runs succeed and which unavailable resources prevent meaningful local use.
- Compare equivalent baseline and accepted-B **production** builds with the same populated scenes/browser/scenarios. Record transferred initial/deferred JavaScript, CSS and other resources, startup/map mount, overlay interaction, and map pan/zoom. Include representative desktop and modest-mobile measurement conditions; distinguish physical-device evidence from throttled emulation. Publish values and limits without inventing a universal budget.
- Inventory targeted bespoke envelopes/components: surface, adaptation attempted or rationale for application-owned composition, retained Nuxt UI controls, and demonstrated behavior. Application-owned D3/SVG, domain commands/validation, draft/persistence, and interchange boundaries remain intact.

## Resolution criteria

The artifact makes observed integration, resources and costs reviewable and reproducible, with unsupported gates explicitly carried to the adoption decision. Closing an evidence task means its investigation is complete; it does not mean every observed gate passed. Essential unknowns that prevent a defensible adoption decision require a precise follow-up dependency rather than a fabricated pass. No human UI preference round is needed: B and its mobile amendment are already accepted.

## Blocked by

- [Choose a map-first UI direction through desktop and mobile prototypes](04-map-first-ui-direction.md) — **closed**, final capture and resolution supply the accepted direction and its source.

## Notes

Apply `wayfinder` and appropriate measurement/research tools. Claimed by SOL6.1High for the explicitly authorized investigation on 2026-10-14; probe implementation delegated to Luna XHIGH. Preserve local work and keep documentation English. No GitHub writes or production implementation.

## Resolution

2026-10-14 — Investigation completed in [Nuxt UI integration, offline resources, and comparative performance](../research/nuxt-ui-integration-evidence.md), with raw traces, source/fixture hashes, production build logs, a comparison figure and reproducible methods. Parent baseline was refreshed again and remains `629d2a98715c3a16b954e0f77c639b1f0c31212c`; accepted B is `7ea41e0a9b0e585e23812eb9165e95420d72dc89`. Performance compares isolated baseline against B with exactly three invalid demo Orbit orders normalized, explicitly distinguished from the unchanged B output used for offline resource probes and the preserved live prototype.

The SSR shell and client-mounted maps function in the executed production cases. Completed desktop comparisons (n=5 each) show 424,152 versus 830,902 CDP received JavaScript bytes and 62,957 versus 284,514 CSS bytes; no later JS/CSS download occurred. Warm common-scene transitions, native Fields opening and successful B SVG-transform gestures are quantified. Native startup contexts differ and are reported separately. Baseline's chosen gesture point is occluded (n=0 valid comparison); mobile supplies four partial fresh-context observations per arm, with later paths blocked by actual hit-testing/out-of-viewport targets. Neither unsupported events nor emulation are presented as phone success.

Executed cold Internet-loss probes reveal missing real USelect check/chevron glyphs and a server-side Iconify dependency; same-server warm use succeeds for those names. OS-derived application defaults, remembered preference and coherent light portal palettes are unsupported. USelect, UModal and the native Fields dialogue show focus inside and real Escape return to their invoking controls in the targeted four OS/application theme cases; complete accessibility and nested guards remain unmeasured. Theme toggle preserves the tested draft/context/transform, but does not prove full serialized or durable data preservation.

These established failures become explicit product-acceptance scenarios in the artifact. Remaining unobstructed baseline gesture comparison, reachable common mobile interaction path, physical-device/accessibility and full preservation evidence belong to [Validate the selected B direction on representative devices and preservation flows](10-validate-b-device-preservation.md), using the recorded failure checkpoints and its named artifact. That task remains open and unclaimed. [Confirm Nuxt UI adoption from prototype evidence](08-confirm-nuxt-ui-adoption.md) stays blocked on it and the later human adoption decision. Closing this investigation does not approve the library, waive a contract, implement the revamp or close the source GitHub issue.
