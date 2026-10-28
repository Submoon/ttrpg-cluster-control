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

Both confirmed findings are assigned to the ticket 03 owner for targeted RED/GREEN corrections before the full suite. Ticket 05 and shared source remain frozen. Reviewer closure and final integrated verification are pending.

Initial totals: Standards 0 blockers; Spec 2 P2; complementary review 1 shared P2. Two unique acceptance defects remain to resolve.
