---
title: Validate the mobile Fields flow in the B prototype
status: closed
assignee: codex-prototype-mobile-fields
label: wayfinder:prototype
type: prototype
mode: HITL
parent: ../map.md
---

## Parent map

[Revamp the interface: make the map central on desktop and mobile](../map.md)

## Question

Does the human-confirmed mobile list/detail Fields flow make definition consultation, editing and review reachable without losing drafts, including long catalogues and keyboard-open portrait/short-landscape layouts?

## Authoritative input

Use the complete [mobile Fields flow Resolution](13-decide-mobile-fields-flow.md#resolution), the [source analysis and scenarios](../research/mobile-fields-flow-2026-10-15.md), and existing field, draft and destructive-review contracts. The human confirmed the complete path; do not reopen list/detail, session resumption or consultation-before-Edit as alternatives.

## Prototype scope and evidence

- Adapt the disposable B preview only when this ticket is actually claimed. Retain desktop list/detail and the application-owned domain/data boundary. No saved workspace, storage format or persisted data may be used to manufacture prototype parity.
- Show list → detail → Edit, shared Fields/Manage session resumption, retained definition and creation drafts, internal Back/list scroll/focus restoration, actual-opener focus return, guarded target changes and invalid Apply. Fix incidental dialog behaviors only as required to honor the accepted flow; do not preserve discard-only prompts that contradict its contract.
- Exercise all supported custom creation types: successful creation opens its read-only detail; explicit creation Cancel returns to the list without mutation. Confirmed custom-definition deletion returns to a valid list/focus target; canceled impact review preserves work.
- Keep native/custom options, applicability and assignment visibility. Exercise used-option removal, canceled/confirmed destructive review, stored values outside applicability and renewed review after resolving a conflicting object draft.
- Use a long catalogue, long names and many assignments, alongside the small seed. Compare command placement only where concrete visual evidence is needed; all candidates must keep navigation, main actions, errors and review controls reachable. Exact CSS/header/footer design is not preselected by creating this ticket.
- Record source/runtime identity, actual input, screenshots and scoped results for desktop, mobile portrait and short landscape. Agent testing uses local `npm run dev`; Vercel supplies the human's phone preview. Physical keyboard/safe-area observations on the human's phone remain distinct from viewport emulation.
- Obtain the human's reaction to the actual artifact. Preserve the chosen B/Dock and the separately recorded Add-status/context-banner conclusion; this Fields iteration does not implement that unrelated refinement or decide Inspector-form density.

## Blocked by

- [Decide the mobile Fields list-to-editor flow](13-decide-mobile-fields-flow.md) — **closed**; supplies the complete confirmed flow.

The separate Inspector-form decision and controls-presentation validation do not block this independent Fields prototype. Coordinate shared component/runtime ownership if those efforts run concurrently.

## Notes

Claimed on the human's explicit request to continue with the prototype. Apply Wayfinder and prototype. Analysis/coordination: SOL 6.1 High; every code change: Luna XHIGH, with the repository's specialist review workflow. It is a prototype decision, not an implementation ticket for the final product. Keep the device/preservation investigation and final Nuxt UI adoption separate.

## Resolution

2026-10-16 — The human explicitly accepts the published artifact: “OK pour ce prototype.” Close this prototype decision with Bottom commands, mobile list → consultation detail → Edit, resumable session drafts, Nuxt UI modal centering and one guarded creation entry per screen. The accepted application snapshot is `9c83edb1915114768cc447890db79b6e0d28e142`, published in draft PR 28 with a successful Vercel deployment.

The [Fields report](../research/fields-prototype-2026-10-15.md) and [production placement follow-up](../research/fields-modal-position-2026-10-16.md) retain their actual source identities and bounded evidence. Human acceptance settles the prototype question; it does not manufacture additional keyboard, browser, OS or physical-device measurements. Carry the remaining representative-device and preservation checks in [Validate the selected B direction on representative devices and preservation flows](10-validate-b-device-preservation.md). Inspector-form refinement and final Nuxt UI adoption remain separate decisions.

Fresh fetch confirms this intentional feature baseline is 0 main-only / 15 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Source issue 3 was refreshed and remains open, with unchanged requirements and no comments. No product completion, merge, source-issue closure or final library adoption follows from this Resolution.

## Comments

> *This was generated by AI during triage.*

2026-10-16 — The bounded placement correction is ready to publish: Nuxt UI owns desktop centering; Bottom commands are the default; one guarded creation command remains per list/detail context. Independent SOL review finds no blocker. Local production build and typecheck pass; the focused browser probe passes 4/4 cases with zero page errors (reported desktop size, portrait/landscape fullscreen, default/footer and creation-draft resumption). The coordinator verifies the frozen source/runtime hashes and captures. [Follow-up evidence](../research/fields-modal-position-2026-10-16.md). The human's placement choice is settled; keep this ticket in progress for remaining device/keyboard feedback. No source-issue closure or final library adoption is inferred.

> *This was generated by AI during triage.*

2026-10-16 — Human feedback on published commit `9d7de58e347169fa9744dfefe502d77d83769935`: after testing on a phone, choose **Bottom commands** for consistency with the other screens. Remove the duplicate custom-field creation entry, keeping one reachable command. A production screenshot at 1137×1244 also shows Fields clipped at the top-left instead of centered. Correct and reproduce that geometry in a local production build before republishing; the earlier development-server matrix did not establish production modal placement. Fresh origin fetch: intentional feature baseline `9d7de58e`, 0 main-only / 14 feature-only versus `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Route this bounded UI defect as Standard: Luna XHIGH implements; an independent SOL 6.1 High reviewer examines the frozen correction. Draft/data contracts remain unchanged. Keep this ticket in progress until the positioning defect and remaining human checks are resolved.

> *This was generated by AI during triage.*

2026-10-16 — Runnable B Fields prototype completed for human comparison: Header/Bottom commands, Nuxt UI bounded/fullscreen modal, retained list/detail/creation work and reviewed domain-command seams. Typecheck and independent source reviews pass; the final local browser matrix passes 26/26 with zero uncaught page errors. A narrow three-ordinal seed repair restores existing per-host Orbit validity without changing geometry or stored data; the actual import guard is exercised. [Final results and limitations](../research/fields-prototype-2026-10-15.md#final-result-and-handoff) and [raw reproduction evidence](../device-preservation-lab/artifacts/fields-flow-2026-10-16/final-fixture/README.md) distinguish earlier attempts. Publish through the existing draft preview PR under the retained authorization. Keep `in-progress`: the human still needs to compare placements and exercise a real phone keyboard. No Resolution or source-issue closure is inferred.

> *This was generated by AI during triage.*

2026-10-16 — Resumed at the human's request. Fresh origin fetch confirms the same `c9ba3f3f41eb54c63ba2645e1c06b569ab485157` feature baseline, 0 main-only / 13 branch-only versus `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Both independent source reviews passed after the bounded state corrections. Complete the interrupted local browser matrix, correct the confirmed B-only light-theme value contrast, then publish the prototype for the human's command-placement/device feedback. Keep this ticket in progress; no human verdict or physical-keyboard acceptance is inferred from agent checks.

> *This was generated by AI during triage.*

2026-10-15 — Claimed as `codex-prototype-mobile-fields` after the human explicitly requests the Fields prototype. Fresh origin fetch confirms `HEAD = origin/codex/interface-revamp = c9ba3f3f41eb54c63ba2645e1c06b569ab485157`, intentionally 0 main-only / 13 branch-only versus `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Source issue 3 was refreshed: open, unchanged requirements/labels, no comments. Existing local environment files, diagnostics and servers are preserved. Route as sensitive because shared Fields components touch existing draft/destructive-review contracts: SOL architecture first, Luna XHIGH implementation, independent technical and domain/preservation reviews on a frozen candidate. Keep the accepted B and confirmed list/detail flow; use focused command-placement variants only where useful, not another whole-application redesign. Agent iteration uses local `npm run dev`; Vercel is the human mobile preview. The coordinator owns shared planning/Git/publication and obtains actual feedback before any Resolution.

> *This was generated by AI during triage.*

2026-10-15 — Created after the human's final confirmation of the Fields flow. Baseline: intentionally different `codex/interface-revamp` at `d756cf8b3e44a6015e304a44c7db62884ea5d662`, matching its remote, 0 main-only / 12 branch-only versus `origin/main` at `629d2a98715c3a16b954e0f77c639b1f0c31212c`. The source GitHub issue remains open and unchanged. Claim before any prototype preparation; creation of this follow-up does not start code work or resolve it.
