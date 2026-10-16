---
title: Validate the responsive inspector form in the B prototype
status: closed
assignee: codex-inspector-prototype
label: wayfinder:prototype
type: prototype
mode: HITL
parent: ../map.md
---

## Parent map

[Revamp the interface: make the map central on desktop and mobile](../map.md)

## Question

Does the human-confirmed inspector layout keep long and varied forms readable, their actions and errors reachable, and drafts preserved on desktop, mobile portrait and short landscape, including a keyboard-reduced viewport?

## Authoritative input

Read the complete [inspector-form Resolution](14-decide-inspector-form-refinements.md#resolution), [source audit and confirmed rounds](../research/inspector-form-refinements-2026-10-16.md), and existing draft/save/impact contracts. Retain B/Dock, fullscreen exclusive mobile Inspect/Hierarchy and the accepted Fields prototype. Do not reopen visible sections, bottom ordinary actions, Description or separated Delete as new alternatives.

## Prototype scope and evidence

- Adapt only the disposable B preview after this ticket is claimed. Use a single form with visible selection-appropriate sections; full-width names/descriptions; one column on phones and optional paired short controls on desktop. Reuse Nuxt UI controls and their layout behavior without compensating manual modal centering.
- Keep top Hide reachable and Apply / Discard changes in a persistent bottom bar. The form scrolls independently in the remaining space. Compact status and error access must not consume the entire available height in short landscape or keyboard-reduced layouts. Preserve durable-save error, Retry and export access according to the existing contract; clearly identify simulated persistence.
- Use Description only for an object's actual description, native/custom distinction and readable existing catalogue labels. Preserve custom definition names and Other subtype text. Do not invent system/cluster descriptions or change identifiers, schema or interchange.
- Exercise long names, multiline description and custom text, many applicable native/custom values and error messages, alongside ordinary seed data. Custom text must not be reduced to an unrepresentative one-line control when the baseline supports multiline entry.
- Account explicitly for the baseline controls identified in the audit: object type label, Location key, Placement, coordinates and physical Jump Station association; Orbit radii, unoccupied center, ordering and Detach; route endpoints/destination kind; actual system/cluster naming. A representative prototype may retain documented gaps, but cannot turn them into feature removals or expose an unsupported edit that reports successful Apply. Keep functional versus presentation-only coverage explicit.
- Verify Hide/reopen, resize and theme changes preserve modified drafts; Discard explicitly abandons; refused Apply preserves work; conflicting context/target changes follow Apply / Discard / Stay. Keep targeted exclusion, review-before-mutation and in-memory application versus durable saving unchanged.
- Keep Delete outside ordinary actions, with its existing consequence preview and confirmation. Verify canceled review preserves data/drafts and short layouts keep review actions reachable.
- Record source/runtime identity, real UI inputs, screenshots and scoped results for desktop, portrait and short landscape. Agent iteration uses local development; include local compiled-production layout checks to catch CSS-generation differences. Vercel provides the human phone preview. Physical keyboard/touch/safe-area observations stay distinct from viewport emulation.
- Obtain the human's reaction before resolving this prototype decision. Do not infer complete product parity, physical-device acceptance or final Nuxt UI adoption from bounded automated checks.

## Blocked by

- [Decide inspector form density and domain-facing display labels](14-decide-inspector-form-refinements.md) — closed; supplies the complete human-confirmed layout and label decisions.

## Notes

Claimed on the human's explicit continuation request. Apply the prototype skill and the repository development workflow. Analysis/review: SOL 6.1 High; all prototype code/QA changes: Luna XHIGH subagents. The coordinator owns planning, shared Git operations and publication. Keep Fields, map tools, Add-status refinement and final product implementation outside this iteration unless separately authorized. Keep this prototype ticket in progress until the human reacts to the actual artifact.

## Resolution

2026-10-16 — The human explicitly accepts the delivered inspector prototype. Retain the focused B rendering: visible responsive sections, full-width Name/Description and multiline custom text, distinct catalogue/custom values, persistent bottom ordinary actions and error access, top Hide, and a separate reviewed deletion action. This resolves the prototype question; no further visual approval round is required for this artifact.

Accepted artifact: [dense B inspector preview](https://ttrpg-cluster-control-git-codex-interface-revamp-submoon.vercel.app/?variant=B&controls=dock&inspectorSample=dense), published at `be8bef3e9efaea76b986480a40de6bd260e59d18` through [the preview PR](https://github.com/Submoon/ttrpg-cluster-control/pull/28), with Vercel SUCCESS on that exact head. The [execution report](../research/inspector-prototype-2026-10-16.md) retains independent reviews, corrected source identities, passing typecheck/build and the final 11/11 production-browser cases.

A fresh origin fetch before recording acceptance confirms the intentionally different preview baseline above, 0 main-only / 18 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. The refreshed source issue remains open and unchanged. The human's general acceptance does not supply new device/OS/browser or scenario-specific keyboard/gesture observations; retain these distinctions in the device/preservation investigation. Missing baseline controls remain product implementation requirements. Final Nuxt UI adoption, product implementation, merge and source-issue closure remain separate.

## Comments

2026-10-16 — B-only inspector refinement is implemented and independently reviewed by SOL technical and domain/data specialists. Local typecheck/build pass; the final compiled-production browser run passes all 11 focused cases, including draft/error behavior, Fields conflict choices, reviewed deletion and ordinary/dense applied JSON decoding. See the [execution report](../research/inspector-prototype-2026-10-16.md) and [QA evidence](../device-preservation-lab/inspector-form-2026-10-16/README.md). The coordinator publishes through the existing preview PR; keep this ticket in progress for the human's artifact verdict and separate physical-keyboard observations.

> *This was generated by AI during triage.*

2026-10-16 — Claimed on the human's explicit request to continue with the prepared inspector prototype. Use the accepted B presentation only, with one focused rendering of the already-confirmed design rather than reopening three whole-page variants. SOL 6.1 High defines the bounded state/command seams first; Luna XHIGH owns implementation and focused QA code; independent SOL reviews examine the frozen candidate. The coordinator owns planning and shared Git/publication. Keep all earlier Fields, unrelated local environments, runtime evidence and browser tabs intact.

The [execution report](../research/inspector-prototype-2026-10-16.md) records actual baseline `8ff3d47a6e6bbfc957c7b3fec19ec856b49225ae`, fresh origin comparison, ownership and evidence as work proceeds. No prototype result or human verdict is implied by claiming the ticket.

> *This was generated by AI during triage.*

2026-10-16 — Created after the human confirms all inspector decision rounds. Source baseline is intentionally `codex/interface-revamp` at `346984f80226f9db2a44ae160d68f492f85e611b`, 0 main-only / 16 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`, freshly fetched; source issue 3 remains open and unchanged. No code or prototype measurement starts from ticket creation.
