---
title: Test the resolved tools contract in a focused B prototype iteration
status: closed
assignee: codex-controls-evidence-consolidation
label: wayfinder:prototype
type: prototype
mode: HITL
parent: ../map.md
---

## Parent map

[Revamp the interface: make the map central on desktop and mobile](../map.md)

## Question

Does a focused iteration of the accepted disposable B prototype make the human-resolved tools contract and readable control grouping understandable and usable across map contexts and screen shapes?

## Historical prototype scope

This section preserves the original HITL prototype scope. The consolidated Resolution below now governs its outcome; it does not authorize product implementation. Analysis uses SOL 6.1 High; prototype code/iteration tasks belong to Luna XHIGH subagents.

- Exercise the resolved camera/selection/manipulation intentions over systems, catalogue objects, Orbits and Jump Routes; show the actual active mode and distinct panel states.
- Demonstrate persistent same-type Add after each successful creation, cancelled/refused placement, chooser dismissal versus cancellation, chosen type/target/progress, and the resolved exit behavior without accidental creation or lost drafts. Read the final tools Resolution before implementing the remaining branches.
- Add several systems without leaving the Jump Cluster map. The human has explicitly chosen to remove automatic entry into the newly created system; later Navigate activation remains the context-opening path.
- Continue successful same-type placements without automatically opening Inspect. Exercise explicit inspection on demand and preserve existing editor drafts/guards; creation does not itself force an editor opening.
- Retain two-contact view-only ownership, cancellation of uncommitted geometry before long-press Inspect, one-finger Move, explicit keyboard/single-pointer alternatives and accepted/refused guarded transitions.
- Exercise right-button hold-and-drag view navigation across all modes, including over entities/Orbit handles in Move and targets in Add. Explicitly exclude right-button mutation and placement, preserve the active mode/type, and verify release/cancellation and context-menu suppression for the pan gesture. Read the final tools Resolution for partial-route progress semantics; this gesture is not currently supported merely by D3's defaults.
- Retain mobile full-screen Inspect, exclusive Inspect/Hierarchy, hidden rail/zoom with either panel open, optional hierarchy and visible return between separate maps. Demonstrate mode/selection/draft retention on Hide/reopen.
- Target readable controls and named operations in portrait, short landscape and desktop; record exact build, scene, input method, executed checks and limitations. Obtain human reaction to the focused iteration without reopening the accepted B direction.

Fields and form redesign remain separate decisions. Do not absorb their recommendations into this iteration unless their own human decisions and explicit scope update authorize it. Do not claim physical acceptance, exhaustive exports or production durability from this memory-only prototype.

## Blocked by

- [Finalize the tools contract after the Astra interface review](11-finalize-tools-contract.md) — closed; supplies human-resolved semantics, including persistent Add and route-origin retention while panning.
- [Decide readable control grouping and accessible operation labels within B](12-decide-controls-presentation.md) — now closed through its consolidated Resolution; Dock remains the human-selected presentation.

## Resolution

2026-10-16 — The human explicitly requests updating the remaining records and coordinating to-spec. Resolve this prototype question by reusing the existing selected-Dock artifact and checks, rather than creating another broad prototype. Fresh baseline and source refresh are recorded in the [presentation Resolution](12-decide-controls-presentation.md#resolution). This is a bounded design conclusion with required implementation gates, not an all-tests or physical-device pass.

The focused [nine-case controls exercise](../research/b-controls-prototype-2026-10-15.md#executed-validation) covers repeated same-type creation without automatic Inspect or context entry, Select versus Navigate, right-button and synthetic two-contact view navigation retaining route origin, layered Escape, and compact exclusive panels. The [Dock correction](../research/dock-feedback-2026-10-15.md) separately verifies click-targeted Orbit placement, anchored chooser and dismissal/layering. Human Dock preference and phone follow-up establish the presentation choice. The [new global Astra review](../research/astra-current-interface-review-2026-10-16.md#tools-sub-verdict) independently finds the current Tools model coherent and ready to specify; it samples current Select/Inspect, chooser Escape/Quit, named Move controls, both-map navigation and Fit, without rerunning placement repetition or physical gestures.

**Conclusion:** the resolved Navigate / Select / Move and persistent same-type Add contract is sufficiently demonstrated to specify. Carry that contract, the chosen Dock and all preservation guarantees into the product specification. Do not revive one-shot Add or automatic inspection/system entry. Prototype source remains disposable and must not become the saved-workspace product by promotion.

**Outstanding acceptance:** physical second-contact retest is unanswered. Earlier Android/Firefox feedback identifies keyboard-action and landscape failures, but the human subsequently limits Android support to Chrome during to-spec. Retain keyboard/landscape/gesture usability criteria for Chrome; the old observations neither require Firefox acceptance nor certify Chrome. Full keyboard/screen-reader behavior, usable map space, theme/icon completeness, full baseline control parity, actual persistence/recovery and complete image exports remain obligations. Context-banner Add compaction remains to implement. Evidence comes from distinct source snapshots and must not be summed into a current-version score. These requirements move forward explicitly; no product readiness, merge or source-issue closure follows from this decision closure.

## Historical evidence and handoff notes

Link the captured artifact and bounded checks here when actually produced. Preserve the original Astra review on `4d90f97`, the two-centre fixture correction on `3111a19`, and the parent-attributed Vela/Kestrel Fit check as distinct historical evidence. No new artifact, test or validation is claimed by this ticket.

The later explicitly authorized presentation exploration is tracked in the [focused B control-presentation report](../research/b-controls-prototype-2026-10-15.md). Its preparation and bounded checks support the presentation ticket; they do not resolve this ticket's human-choice dependency or establish final validation.

The [device/preservation investigation](10-validate-b-device-preservation.md#resolution) is now closed as a completed evidence task; its [dossier](../research/b-consolidated-validation-2026-10-16.md) retains actual Android/Firefox limitations and the independent scope of this tools validation. [Final Nuxt UI adoption](08-confirm-nuxt-ui-adoption.md#resolution) is subsequently human-confirmed: maximize library components and limit other interface implementations to justified exceptions, with all acceptance obligations retained. Reuse the existing selected-Dock artifact and scoped checks when this ticket becomes available; a new broad prototype is not automatic. When all relevant decisions make the route clear, a later session may use to-spec, then to-tickets. This dependency update resolves neither this ticket nor the map.

## Comments

> *This was generated by AI during triage.*

2026-10-16 — [Astra's current global review](../research/astra-current-interface-review-2026-10-16.md) finds the resolved Tools and selected Dock coherent enough to specify. Its live chooser Escape/Quit and Select/Inspect checks supplement rather than replace the earlier controls evidence; placement repetition and physical second-contact behavior were not re-executed. Reuse the existing artifact and reconcile the presentation blocker first. Another broad prototype comparison is unnecessary; a narrow delta is warranted only if an outstanding criterion requires it. This review does not change this ticket's blocked state, resolve its dependency or establish final physical acceptance.

> *This was generated by AI during triage.*

2026-10-15 — Prepared as a dependency-gated later prototype session. Source/baseline provenance: [Finalize the tools contract after the Astra interface review](11-finalize-tools-contract.md). No code, merge, publication or GitHub comment is requested in the present tools decision session.

2026-10-15 — The human subsequently explicitly requested continuation through a targeted prototype iteration and instructed the parent to launch a subagent. Luna XHIGH is now preparing the memory-only artifact; SOL owns presentation analysis. This authorizes **exploratory preparation for the in-progress presentation decision**, using the closed tools Resolution and two focused B alternatives. It does not silently resolve that decision or bypass this ticket's final-validation dependency. The same asset can support the presentation choice and later be validated against the chosen presentation here; there is no dependency from the presentation ticket back to this ticket. Keep `status: blocked`, record actual evidence only after execution, and obtain human reaction before any Resolution. No additional authorization is needed for the already-requested prototype work. Fields/form redesign, physical acceptance, final adoption and product implementation remain outside this exploratory authorization.
