---
title: Confirm Nuxt UI adoption from prototype evidence
status: blocked
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../map.md
---

## Parent map

[Revamp the interface: make the map central on desktop and mobile](../map.md)

## Question

Do the desktop/mobile prototype and representative integration measurements justify broad Nuxt UI adoption for the final revamp, and which targeted exceptions or scope revisions should be retained?

## Context and scope

[Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3), refreshed on 2026-10-13, requires evaluating Nuxt UI, responsive touch usability, map priority, preserved features, and coherent remembered light/dark themes. [Decide Nuxt UI adoption and scope](07-nuxt-ui-adoption.md) resolved the prototype direction: broad library use for interface controls/forms/panel envelopes, final commitment conditional on results, adaptation first with documented targeted exceptions. Its Resolution is authoritative; this ticket does not repeat that initial choice.

The [research](../research/nuxt-ui-fit.md) establishes documentary generation compatibility, not successful application integration or accessibility conformance. The completed [runtime integration/resource/cost evidence](../research/nuxt-ui-integration-evidence.md) now supplies executed desktop comparisons and targeted theme/portal/offline observations, with known failures and partial mobile results. The baseline refreshed on 2026-10-14 remains `main == origin/main == 629d2a98715c3a16b954e0f77c639b1f0c31212c`; refresh it and the source issue when resuming.

## Evidence to review

- Linked runnable/disposable prototype artifacts and actual human reactions, covering both map levels, real/dense content, desktop and modest mobile, short/landscape/virtual-keyboard views, and light/dark modes. Record tested devices/browsers, versions, scenarios, limitations, and failures.
- SSR/first-render/hydration and theme-reload results; offline icon/font/resource behavior; equivalent baseline/prototype production-build and interaction comparisons, including initial/deferred JavaScript, CSS/resources, startup/mount, overlays, and map pan/zoom. Missing measurements must stay explicit; package dependency lists or static screenshots cannot substitute for them.
- Preservation evidence for independently navigable desktop map-edit panels and the accepted full-height mobile presentation, focus/scroll, mounted/hidden/reflowed drafts, selection/view/context/tool, conflict guards, validated application versus durable saving, error/Retry/current JSON export, and clean SVG/PNG/print palette without live state changes. Mobile Inspect covers the map while visible; Hide/reopen retains its draft and map state. Use the mandatory contracts and explicit mobile amendment in the direction resolution.
- Actual value/cost rationale and a narrow exception inventory: surface, why library adaptation was insufficient/less suitable, retained library controls, and demonstrated behavior. Exact visual preference is informed by the prototype, not a fabricated performance budget.

## Resolution criteria

- A live human decision to confirm broad adoption, revise its scope, or reject it, with reasons tied to the evidence and explicit unresolved technical risks. Do not infer acceptance from prototype completion.
- A reviewable responsibility boundary and accepted exceptions, preserving application-owned D3/SVG, domain commands/validation, session state, persistence, and interchange. All closed navigation/interaction/preservation/theme contracts remain binding; they cannot be waived to accommodate a library.
- Missing essential evidence leads to a precise investigation/question and expected artifact, rather than an unsupported final adoption claim. Keep prototype availability independent of this later confirmation; there is no dependency back from the prototype to this ticket.
- Record the authoritative English Resolution and linked map gist only after actual human answers. This decision does not implement the product or close GitHub's source request.

## Blocked by

- [Choose a map-first UI direction through desktop and mobile prototypes](04-map-first-ui-direction.md) — **closed**, supplies the accepted B presentation, actual final human reaction and captured disposable artifacts. The human's direction acceptance is already recorded; it is not final library adoption.
- [Measure Nuxt UI integration, offline resources, and comparative performance](09-measure-nuxt-ui-integration.md) — **closed**, supplies executed technical evidence, known integration failures and explicit limits in its [artifact](../research/nuxt-ui-integration-evidence.md). Closure is investigation completion, not acceptance of every gate.
- [Validate the selected B direction on representative devices and preservation flows](10-validate-b-device-preservation.md) — **open**, collect physical-device/accessibility/preservation evidence and distinguish remaining production-acceptance requirements from prototype simulations.

## Current decision boundary

2026-10-14 — The human accepted a B-style UI direction and specified the mobile/presentation adjustments. This settles the visual HITL question, with no redundant visual-approval round after routine authorized changes. The integration investigation is now complete; its failures and measured costs remain part of this review. Final Nuxt UI adoption stays blocked on the open, unclaimed device/preservation task, including the precise incomplete baseline/mobile gesture and overlay paths referenced by the integration artifact, and requires the later live library decision originally agreed in [Decide Nuxt UI adoption and scope](07-nuxt-ui-adoption.md). Technical evidence-task closure does not pass its unsupported gates or authorize starting the next task automatically.

## Notes

Apply `wayfinder`, `grilling`, and `domain-modeling`; human conversation is French, repository artifacts are English. Analysis uses SOL 6.1 High; eventual implementation uses Luna XHIGH subagents. Claim before work. This is a later HITL session, not a second decision to resolve while closing the adoption-direction ticket.
