# First-frontier implementation review

## Candidate and scope

Fixed baseline: `9edfa66c4f505d56f106fc4af8245f200abfba78`.
Initial integrated candidate: `7d7cbf0751effaeb24a066d817fe354168ecc113`.
Comparison: `git diff 9edfa66c4f505d56f106fc4af8245f200abfba78...HEAD`.

The review covers authorized tickets 01, 02, 04 and 06. Distant-scene recovery/raster bounds (03) and occupant-angle replacement (05) remain separate work. Reviewers inspected source without modifying files or using the coordinator's runtime. Their findings below are static findings; browser verification is recorded separately.

## Standards

The independent Standards reviewer found one P2 interaction regression: free-object movement errors had no visible outlet. The remaining field error belonged to the Orbit-angle branch, while the general alert required candidates. Refusing Move on map could therefore close the controls without explaining the relationship-draft guard. Related-state recovery guidance in `docs/agents/ui.md` requires a visible, reachable result.

No additional consequential standards violations or maintenance smells were identified. Repository rules took precedence over the review's heuristic smell baseline; tooling-enforced checks were handled separately.

## Spec

The independent Spec reviewer found two P2 defects:

- The free-position exemption admitted movement of captured proposed Orbit hosts and their ancestors during explicit host/order drafts. This bypassed the specification's retained relationship guards and the relevant ticket criteria, and could clear an attachment preview.
- Free-placement refusal lacked the visible feedback described in the Standards finding.

No unrequested product scope was identified. The reviewer explicitly excluded pending tickets 03 and 05 from missing-implementation findings.

## Complementary persistence and domain review

The deep reviewer confirmed the relationship-guard defect, with an additional failure sequence: cache proposed free host A, switch the draft to an occupant B descended from A, then move A. Positional rebasing updated B's ancestry but left its cached scene position stale, preventing later Preview/Apply. Restoring the intentional relationship guard eliminates this sequence; this is supporting evidence for the same defect, not a third unique finding.

No additional blocking findings were identified in optional-layout restoration, validation, import remapping, route resolution/deletion, standalone export scope, applied geometry export, ordered persistence/Retry, gesture cancellation or positional rebasing for geometry-only drafts.

## Correction and closure

Pending completion of the frozen integrated suite, targeted corrections, affected checks and reviewer closure. No ticket is marked complete based on the initial review.

Initial totals: Standards 1 P2; Spec 2 P2; complementary review 1 shared P2. There are two unique product defects to resolve.
