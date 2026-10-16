---
title: Confirm Nuxt UI adoption from prototype evidence
status: closed
assignee: codex-wayfinder-nuxt-ui-adoption
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
- [Validate the selected B direction on representative devices and preservation flows](10-validate-b-device-preservation.md) — **closed**, supplies the [consolidated dossier](../research/b-consolidated-validation-2026-10-16.md), actual Android/Firefox limitations, bounded reachability proof, known failures and explicit later-product acceptance. Investigation closure does not mean every gate passes.

## Current decision boundary

### Current readiness after the accepted artifacts

**Resolved, 2026-10-16.** The human confirms using Nuxt UI and its components to the greatest practical extent, limiting other interface implementations to exceptions. The [Resolution](#resolution) is authoritative. The dossier and historical gate boundary below retain the evidence and limitations on which the decision was made; this is library adoption, not passage of all product acceptance gates.

2026-10-16 — The [consolidated validation dossier](../research/b-consolidated-validation-2026-10-16.md) joins the human-selected Dock, accepted Fields and inspector, source-specific runtime checks, historical cost/resource/theme measurements, and a current responsibility/exception inventory. It records actual Android/Firefox feedback: editing actions are hidden with the keyboard open, and Fields has an oversized header in landscape. Closing the keyboard is a reported workaround, not a measured keyboard pass or an automatic change to the existing contract. The separate second-contact physical check is unanswered.

The adoption conversation carries compact-header/keyboard reachability, local icon packaging, coherent portal themes and durable preference, layering, complete baseline controls, durable saving and representative performance/accessibility into integration obligations. Historical native Fields measurements do not describe B's later Nuxt UI modal. The evidence task is complete and its bounded retained-baseline pan/zoom probe passes with the source/measurement limits recorded in the dossier. No new full-layout prototype or broad research campaign is implied by the known implementation gaps. The linked Resolution records the subsequent final scope answer; these measurements retain their limits.

### Historical gate boundary

2026-10-14, claim status refreshed 2026-10-15 — The human accepted a B-style UI direction and specified the mobile/presentation adjustments. This settles the visual HITL question, with no redundant visual-approval round after routine authorized changes. The integration investigation is now complete; its failures and measured costs remain part of this review. Final Nuxt UI adoption stays blocked on the claimed, in-progress device/preservation task, including the precise incomplete baseline/mobile gesture and overlay paths referenced by the integration artifact, and requires the later live library decision originally agreed in [Decide Nuxt UI adoption and scope](07-nuxt-ui-adoption.md). Technical evidence-task closure does not pass its unsupported gates or authorize starting the next task automatically.

## Notes

Apply `wayfinder`, `grilling`, and `domain-modeling`; human conversation is French, repository artifacts are English. Analysis uses SOL 6.1 High; eventual implementation uses Luna XHIGH subagents. Claim before work. This is a later HITL session, not a second decision to resolve while closing the adoption-direction ticket.

## Resolution

2026-10-16 — The human's live answer is to use Nuxt UI and its components as much as possible, limiting the rest to exceptions. This confirms Nuxt UI as the primary interface library for the production revamp and strengthens the earlier broad-prototype direction into a **Nuxt UI by default** implementation policy. The scope decision is complete; the prototype is not treated as the finished production implementation.

### Default and exception policy

- Use suitable Nuxt UI components throughout controls, buttons, fields, forms, menus, popovers, dialogs, navigation and panel composition. Evaluate their configuration, slots and application adapters before building an equivalent bespoke interface.
- Retain the human-selected B/Dock presentation and all closed interaction/preservation contracts. Existing custom dock, hierarchy, catalogue and editor-envelope code in the disposable prototype is an inventory to reassess, not a blanket exception already approved for production.
- Limit any necessary bespoke implementation to the smallest surface that cannot suitably preserve the required behavior through Nuxt UI adaptation. Document the requirement, why the library adaptation is insufficient or less suitable, the retained Nuxt UI controls, and validation evidence. Keep that rationale reviewable with the implementation; no new per-component human approval workflow is introduced.
- In particular, desktop editing must retain independent map navigation and compact editing must retain its confirmed fullscreen/exclusive behavior and resumable drafts. Explore appropriate Nuxt UI composition before treating a custom persistent envelope as necessary. Library defaults cannot replace these guarantees.
- D3/SVG rendering and geometry, authoritative domain commands/validation, draft ownership, persistence and JSON/image interchange remain application responsibilities. Their continued ownership is not a justification to reimplement ordinary interface controls.

### Evidence, costs and integration obligations

The human decides after reviewing the [consolidated validation dossier](../research/b-consolidated-validation-2026-10-16.md): accepted Dock/Fields/Inspector artifacts, source-specific checks, the retained-baseline reachability proof, historical resource/theme evidence and actual Android/Firefox limitations. The question explicitly disclosed the early full prototype's additional 628,307 received JS/CSS bytes, including comparison variants and other differences. This is neither isolated library cost nor a final performance budget; measure the integrated interface without disposable comparison scaffolding.

All existing functional, navigation, gesture, draft/save, theme, accessibility and export requirements remain binding. In particular, carry compact Fields headers and real-keyboard action access on Android/Firefox, packaged local icons, coherent portal palettes and durable theme preference, menu/panel layering, complete baseline controls, real persistence/recovery and representative performance/accessibility into the specification and implementation acceptance criteria. The keyboard-close workaround does not silently waive the established action-access contract.

Adoption does not relabel the prototype's known failures or missing physical/production checks as passed. Adapt and verify the integration against those criteria, preserving the application-owned state/data boundaries. Related features remain coordinated separately. No application code, further layout vote, product merge or source-issue closure follows from this decision.

### Provenance

Fresh origin fetch establishes resumption baseline `6871c46a8aa1365238bd092e919ba88828b9b2ab`, intentionally 0 main-only / 20 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. The source request is refreshed, open and unchanged, with no comments. The live scope question, explicit human answer and completed prior evidence settle this decision without inventing an extra library comparison or another confirmation round. No domain term or relationship changes; keep this implementation policy in planning/specification rather than the domain glossary.

## Comments

> *This was generated by AI during triage.*

2026-10-16 — Claimed on the human's explicit request to continue with the next decision. Fresh origin fetch confirms intentionally different preview/planning baseline `6871c46a8aa1365238bd092e919ba88828b9b2ab`, 0 main-only / 20 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Source issue 3 is refreshed, open and unchanged, with no comments. The consolidated dossier supplies facts; this session requests the human's final scope decision. The first frontier is broad adoption versus targeted use versus retaining bespoke controls, with explicit current exceptions and mandatory integration corrections. No new measurements, application changes or library decision are inferred from the claim.

> *This was generated by AI during triage.*

2026-10-16 — The complete first-round proposal offers broad Nuxt UI use with adaptation-first exceptions, unchanged application-owned maps/data/drafts/save/export, mandatory integration corrections and disclosed historical resource cost. The human answers that Nuxt UI and its components should be used to the maximum, with other implementations limited to exceptions. Record this as the final scope confirmation, including its stronger default-library policy. No remaining adoption branch requires another question; do not grandfather the prototype's bespoke UI surfaces as automatically approved exceptions.
