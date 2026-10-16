---
title: Decide the mobile Fields list-to-editor flow
status: closed
assignee: codex-wayfinder-mobile-fields
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../map.md
---

## Parent map

[Revamp the interface: make the map central on desktop and mobile](../map.md)

## Question

How should a narrow-screen user choose a native/custom field definition and reach its editor without scrolling past the entire definitions list?

## Context and candidates

The [Astra global review](../research/astra-interface-review-2026-10-15.md) observed the problem with only five seeded definitions. The human selected mobile list-to-detail navigation and confirmed the complete flow in the live exchange below. Desktop list/detail usefulness is preserved.

## Resolution

Confirmed through the human's actual Q1–Q3 answers and final Q4 response, **Confirm this flow (recommended)**, on 2026-10-15. This resolves the navigation/presentation contract, not its implementation or device acceptance.

- **Mobile structure:** inside the existing Fields dialog, definitions list → read-only definition detail → explicit Edit. List and detail each use the available dialog area rather than stacking the complete list above the editor. Desktop retains two-column list/detail.
- **Opening and resumption:** Fields and Manage share session-only state. First opening shows the list; reopening restores the last valid list/detail/creation screen, selection and any draft. Manage does not silently invent a field-specific target. No durable draft storage is introduced by this choice.
- **Back and Close:** Back to definitions restores list position, selected-row highlight and focus while hiding the detail without ending its draft. Reopening that same definition resumes its existing edit draft. Close hides Fields and restores focus to the actual opener; the underlying map/inspector context is preserved. Changing definition or starting New with modified work uses the established Apply/Discard/Stay guard; clean edits need no prompt.
- **Creation:** New custom field opens a dedicated editable form in the detail area. A valid applied creation opens the new definition's read-only detail. Explicit Cancel abandons only that creation draft and returns to the list without creating a field. Hiding Fields preserves the creation draft instead of acting as Cancel.
- **Deletion:** retain explicit affected-value review and confirmation for custom-definition deletion. After confirmed, successfully applied deletion of the selected custom definition, return to the list and focus a valid nearby row; use the list heading or New control if no suitable row exists. Do not retain a deleted field ID or implicitly select Atmosphere. Canceling the review does not delete data or discard the current work.
- **Existing contracts:** preserve native/custom types, options, applicability, existing assignments and the distinction between reusable definitions and object values. Applicability retains stored values. Required impacts remain explicitly reviewed and confirmed; resolving a conflicting object draft renews the review when consequences change. Invalid Apply preserves work and context. In-memory application remains distinct from durable saving, and the accepted draft/save contract remains authoritative.
- **Reachability:** navigation, Edit, Apply/Cancel, validation errors, creation and impact/conflict controls must remain reachable with long definitions/assignments, short landscape and the virtual keyboard. Separate primary commands from long scrolling content as needed. Exact header/footer composition, focus/scroll behavior and safe-area/keyboard geometry must be demonstrated by the later prototype rather than asserted by this decision.

The [source analysis](../research/mobile-fields-flow-2026-10-15.md) records static implementation gaps and scenarios; it is not browser evidence or an authorization to repair them in this session. [Validate the mobile Fields flow in the B prototype](16-prototype-mobile-fields-flow.md) carries the concrete follow-up. Inspector-form decisions remain separate. No product/schema/interchange change, new glossary term, final Nuxt UI adoption or GitHub source closure follows from this Resolution.

## Resolution criteria

- Settle mobile definition selection, return/back behavior, selected definition and scroll restoration, and action reachability with the virtual keyboard.
- Preserve native/custom types, options, applicability, existing assignments, affected-value review and renewed destructive review after resolving a conflicting draft. Layout changes do not authorize value loss or simplify the established field contract.
- Keep global Fields and contextual Manage access, with focus return and draft/guard behavior coherent across entry points.
- Identify precise later prototype scenarios and device evidence; distinguish an agent browser check from physical-phone acceptance.

## Blocked by

None. Existing field and draft contracts are resolved; this layout decision can be discussed independently of the tool split.

## Notes

Apply Wayfinder, grilling and domain-modeling. Analysis: SOL 6.1 High; later prototype work: Luna XHIGH subagents. Claim before work. Record each actual human answer and resolve only when the decision frontier is complete; no implementation or automatic acceptance follows from Astra's recommendation.

## Comments

> *This was generated by AI during triage.*

2026-10-15 — Actual final Q4 answer: **Confirm this flow (recommended)**. The human confirms the complete recap, including successful creation to read-only detail and confirmed successful deletion to the list. The decision frontier is complete; close this ticket and index its Resolution. SOL 6.1 High owns analysis, with future prototype code delegated to Luna XHIGH. Fresh origin fetch confirms unchanged `HEAD = origin/codex/interface-revamp = d756cf8b3e44a6015e304a44c7db62884ea5d662`, versus `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c` (0 main-only / 12 branch-only). Source issue 3 was refreshed before closure: open, unchanged requirements/labels, no comments. Create the explicit prototype follow-up without starting implementation; device/preservation and final-adoption tasks retain their separate status.

> *This was generated by AI during triage.*

2026-10-15 — Q4 presents the complete end-to-end recap, including the proposed creation/deletion destinations, for actual shared-understanding confirmation. It restates accepted list/detail, session resumption, consultation before Edit, internal Back/draft preservation, and mandatory guards/reachability. The human may confirm or correct the proposed destinations. No answer, final Resolution, closure or implementation is inferred while Q4 is pending.

> *This was generated by AI during triage.*

2026-10-15 — Actual human replies: Q2 **Resume the last screen (recommended)**; Q3 **A — Detail then Edit (recommended)**. SOL 6.1 High confirms no additional essential structural question blocks a concise final recap. The recap proposes a dedicated creation form, successful creation to the new read-only detail, explicit creation Cancel to the list without mutation, and successful confirmed custom-definition deletion to the list with valid nearby focus. These presentation destinations require the human's final answer and are not inferred from Q2/Q3. Exact action placement and keyboard/safe-area behavior remain later prototype checks under mandatory reachability and preservation criteria. The fresh origin baseline remains unchanged from the previous round.

> *This was generated by AI during triage.*

2026-10-15 — Q1 unlocks the next human frontier. Q2 asks whether Fields/Manage reopen the last valid in-dialog screen or always return to the list, preserving drafts in either case. The bundled navigation recommendation retains the list position/highlight on internal Back and resumes the same definition; changing target or starting creation follows the existing modified-draft guard. Q3 asks whether definition selection shows detail with an explicit Edit action (recommended) or enters editing directly. Both questions are pending; recommendations are not answers. Reachable navigation/actions with the virtual keyboard and long assignment content are already required, not a fresh accessibility vote. A separate command area is a proposal to verify in the later prototype, not an accepted exact placement or implementation mechanism.

> *This was generated by AI during triage.*

2026-10-15 — Human Q1 response: **A — List then detail (recommended)**. Record the accepted mobile list/detail structure above and recompute the dependent frontier. SOL 6.1 High continues the same claimed analysis. A fresh origin fetch before this round confirms unchanged `HEAD = origin/codex/interface-revamp = d756cf8b3e44a6015e304a44c7db62884ea5d662`, `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`, 0 main-only / 12 branch-only. No new code, browser/device evidence or ticket closure is claimed.

> *This was generated by AI during triage.*

2026-10-15 — First frontier question presented to the human: mobile list-to-detail navigation within Fields, with Back to the list, versus a compact field selector above the editor. The recommendation is list-to-detail; it is not accepted by being recommended. Desktop retains list/detail side by side. Entry-point, return, keyboard and draft details are reserved for the next round once this prerequisite is answered. Source facts, candidates and later checks are in [Mobile Fields flow: source analysis and first decision frontier](../research/mobile-fields-flow-2026-10-15.md). No Resolution or ticket closure is recorded while the answer is pending.

> *This was generated by AI during triage.*

2026-10-15 — Claimed as `codex-wayfinder-mobile-fields` following the human's explicit request to coordinate the next Wayfinder ticket. SOL 6.1 High owns delegated analysis of the existing Fields list/editor and the Astra findings; the coordinator owns this ticket and the shared map. Apply grilling and domain-modeling, preserving existing field identity, assignment, destructive-review and draft contracts. No prototype or product implementation is authorized by claiming this decision. Future code belongs to Luna XHIGH.

Fresh origin fetch: intentionally different preview/planning branch `codex/interface-revamp` at `d756cf8b3e44a6015e304a44c7db62884ea5d662`, matching its remote, with 0 main-only / 12 branch-only versus `origin/main` at `629d2a98715c3a16b954e0f77c639b1f0c31212c`. Source issue 3 was refreshed: open, requirements and labels unchanged, no comments. Existing local environment files and diagnostic artifacts are preserved. The human separately reports trying Dock on their phone and delegates choosing how to reuse existing mobile chrome for Add status; record that feedback in its own presentation/device artifacts without expanding this Fields decision.

> *This was generated by AI during triage.*

2026-10-15 — Separate follow-up to the completed Astra review. Source/baseline provenance: [Finalize the tools contract after the Astra interface review](11-finalize-tools-contract.md). Existing physical-device and preservation investigation remains in progress.
