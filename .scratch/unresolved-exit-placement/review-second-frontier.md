# Second-frontier implementation review

## Candidate and scope

Baseline: `c3c4946644463f5d83dde5436b3c99f04bea1fd1`.
Initial candidate: `84195a14c607483127035569e26b1f6ffc2a8ef6`.
Comparison: `git diff c3c4946644463f5d83dde5436b3c99f04bea1fd1...HEAD`.

Three independent read-only reviewers inspected tickets 03 and 05, the approved parent specification, the actual diff, related callers and repository guidance. They did not run shared runtime checks. Focused public/pure tests and final initial-candidate lint/typecheck passed; the existing image-export file passed all ten journeys.

## Standards

No confirmed blocking Standards findings. The reviewer found ownership, browser-resource cleanup, transient previews and the single workspace writer consistent with repository guidance.

A nonblocking duplication suggestion concerns effective-angle calculations in placement and map workflows alongside the domain calculation. No demonstrated correctness failure was associated with it. The numerical label concern below was referred to the other axes for verification rather than counted as a separate Standards breach.

## Spec

Two P2 findings concern ticket 03:

- Prepublication validation reserved only 256 scene units around anchors. A permitted maximum-length unresolved-exit label near the negative aggregate-span boundary can extend beyond that margin. Admission can succeed before the renderer rejects the actual measured scene, violating unsafe-data rejection before publication.
- A valid very tall scene can require a visible scene-space viewport wider than the numerical envelope. Surface refresh returned without updating the background/grid in that case, retaining a narrow old surface after Fit instead of covering the expanded view.

No additional ticket 05 defect or unrequested scope was identified.

## Complementary numerical and persistence review

The deep reviewer independently confirmed the label-admission mismatch. With `L=16773120`, a system at `(480,280)` and a long-label exit at `(-L+1000,280)`, the padded helper span is `L-8`, while rendered text and the system card can produce a span above `L`. This is the same finding, not a third unique defect.

The review also traced schema/legacy admission, route geometry, applied bounds and zoom transport, PNG sizing before decode/allocation, direct/confirmed object moves, trusted draft rebasing, explicit relationship guards and save/Retry ordering. No additional persistence or relationship-invariant defect was confirmed.

## Correction and closure

Correction candidate: `ede5b3b19a1694aa7ba770df687e00e29964cfc4`.

Both defects were reproduced with meaningful failing tests before correction. Shared exit-label geometry now supplies the explicit rendered SVG text length and admission extents, with conservative system-name extents. The boundary tests reject the previously admitted unsafe scene before publication. Targeted pure checks passed 10/10.

The background/grid now belong to viewport space, using the real SVG client viewport rather than a fixed viewBox rectangle. Their pattern follows the scene camera, while export clears that live transform and covers the full applied bounds. Public tests check actual client coverage and safe attributes at 1440×960 and 1920×400, plus exported surfaces. The corrected distant suite passed 3/3.

All three reviewers inspected the correction and closed their blockers without identifying a consequential new issue. A final export-branch type guard explicitly narrows unresolved destinations; it does not change valid geometry behavior. Ticket 05 has no blocking review finding. Full integrated suite and production build remain completion gates.

Initial totals: Standards 0 blockers; Spec 2 P2; complementary review 1 shared P2 (two unique defects). Remaining blocking findings: Standards 0; Spec 0; complementary numerical/persistence 0.

## Integrated-suite follow-up

The subsequent complete suite found one creation regression outside the initial review findings: a map-inferred Orbit was treated as an explicit control preference, preventing the next valid click on a different nested Orbit. The existing rotated/nested creation test failed without relaxing its expectations. The ticket 05 owner is correcting that provenance/lifetime distinction. Focused verification and correction review remain pending; overall acceptance is not yet closed.
