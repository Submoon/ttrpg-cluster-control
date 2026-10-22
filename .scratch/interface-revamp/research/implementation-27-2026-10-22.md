# Ticket 27 implementation — 2026-10-22

Source: [Review destructive changes and exchange independent JSON copies safely](../tickets/27-reviewed-deletion-and-json-interchange.md). Baseline `8379b2901c88ebe3fcd1198ffa8b0175ddecbbe2` equals freshly fetched origin/codex/interface-revamp; main remains `629d2a98715c3a16b954e0f77c639b1f0c31212c` (0 main-only / 52 feature-only). The tracked checkout is clean at intake; unrelated historical untracked artifacts are preserved. Source issue 3 is refreshed: open, unchanged request and no comments.

## Scope and routing

Sensitive route for destructive cascades, import/interchange and draft/persistence ownership. SOL 6.1 High defines the bounded contract and independently reviews technical and domain/data risks. Luna XHIGH implements. Preserve the approved B/Dock composition and use Nuxt UI primitives for the actual persisted application. No new global change engine, merge/migration, schema/marker change, successor implementation or image-export work.

The primary test seam remains the human-approved real application with public controls, native browser input, actual downloads/reload and existing fault interception; narrow existing codec/domain/storage checks remain relevant. Apply implement/TDD vertically, starting with one demonstrated gap. Reuse current tests rather than write a second harness or a bulk speculative suite. Root owns documentation, Git and serialized runtime; initial writers have disjoint ownership.

## Verification budget

Run focused affected files during implementation, regular typecheck, one final build and one complete suite at the end. Use one worker: ticket 26 demonstrated that parallel workers trigger resource-sensitive deadlines on this host. Never overlap cold development compilation with long browser journeys. Reuse the existing ticket 23 QA configuration; no new runner/device matrix. The compiled intake server is verified against the ticket 26 application/entry manifests before reuse for the initial RED.

Record actual failed/interrupted results and source identities. Do not equate a targeted retest with a fresh full-suite pass. Inspect changed compiled UI at representative desktop and compact viewports. Physical Android Chrome keyboard/safe-area checks remain unavailable unless actually performed. Preserve PR 28 as draft and source issue 3 as open; do not start ticket 28 or 29.

## Bounded architecture contract

Reuse the existing deletion planner and JSON-copy importer. Preparation is read-only and appears before any draft-resolution request. Confirmation checks current ownership and reprepares from latest memory; changed semantic consequences require another explicit review. Sign actual affected identities, names and reference/settings changes, excluding randomly allocated copy IDs. Publish synchronously through the existing workspace owner, finish the operation at memory application, and report later persistence failure through existing recovery feedback.

Deletion review remains reachable from an edited object's separated destructive section. Review cancellation retains raw drafts. Route conflicts include endpoints removed by Orbit/ancestor cascades. Existing selection, visit and creation owners prune missing references; unrelated work is preserved.

Import retains the current map/context and remaps copied entities using established compatibility rules. Resolve only an entity draft affected by changed reusable definitions. A conflicting retained Fields draft exposes an actionable return to its authoritative owner; hiding Fields does not resolve it. Refresh a clean retained definition editor when its committed definition changes. New definition names conflicting with a create draft also require owner resolution. Repeat ownership/freshness checks after awaited guards and immediately before publication.

Use Nuxt UI modal composition with bounded desktop and full compact presentation, scrollable body and bottom actions. Suspend the review during its authoritative draft guard or Fields handoff, with ordinary focus and hit testing; no manual positioning or shell restructuring. Existing JSON export reads applied memory and must not clear failed-save feedback.

## Initial TDD evidence

The first deletion tracer failed against verified compiled baseline `8379b29` in 11.3 seconds: `Delete Primary Star` was absent while its inspector draft was open. No application source had changed. Evidence: host TEMP `ticket23-ticket27-red-deletion/results.json` and retained failure trace. The implementation writer was then released for this slice.

The independent-import tracer also failed against compiled `8379b29` in 9.5 seconds: `Review import` was absent before unrelated chart-draft resolution. Evidence: host TEMP `ticket23-ticket27-red-import/results.json`. Both tests use the existing actual-product controls and download seams; no application test API was added.

The first deletion implementation passes its complete tracer on frozen warm development source: 1/1, 19.0 seconds (`ticket23-ticket27-deletion-frozen`). Two preceding development attempts are retained failures, not passes: the initial SSR compilation exceeded the Welcome timeout; a second attempt during concurrent shared-domain edits lost its session under HMR. No source correction was made for that unstable second result. All application source is frozen during subsequent browser checks. Existing test discovery succeeds: 174 cases before any additional acceptance regressions.

Integrated typecheck and both initial tracers pass (2/2, 21.5 seconds). Five existing development preservation journeys yield 4 passed / 1 timeout: the long dependent-deletion journey reaches the final retained-system state at its 30-second deadline; compiled verification is required before classifying that limit. No global timeout/retry/worker increase is introduced.

## Independent review — correction cycle 1

The frozen 16-file application candidate is identified by `../implementation-lab/ticket-27-2026-10-22/qa/review-source-manifest.json`. Separate SOL 6.1 High reviewers report two accepted P2 defects:

- **Standards / technical:** creation-owner inputs/candidates can retain a deleted host or Orbit while the same system remains open. Prune only affected pending references through their owner, retaining unrelated Add work.
- **Spec / domain:** the deletion signature includes removed route IDs/level labels but omits endpoint references and unresolved-exit content. Applying an edited route can change the removed dependency footprint without renewing review. Include and present those semantic route effects, then require confirmation of changed effects.

The domain reviewer independently corroborates the pending-target defect. No other confirmed initial source blockers are reported. Root accepts both and assigns bounded Luna XHIGH regression/correction work; no broad command engine or format change is authorized. Reviews did not execute runtime checks and do not certify physical-device behavior.

## Completion

Both source corrections pass focused compiled checks; independent technical/domain rechecks report no remaining blockers. Final typecheck and corrected production build pass. The single complete suite executes 180 cases in 16.5 minutes: **169 pass / 11 fail**, zero retries/skips/flaky cases. All eight new ticket tests pass. The eleven failures are outdated legacy assumptions about automatic post-import navigation, native confirmation wording and the new Delete tab stop. A bounded six-file test-only batch preserves all data/reference/cascade/reload/pointer assertions, receives an independent preservation review and passes **11/11** in 1.4 minutes. Application and compiled hashes remain unchanged throughout that batch; no fresh 180/180 whole-suite pass is claimed.

The [verification record](../implementation-lab/ticket-27-2026-10-22/qa/README.md) includes exact source/test/compiled manifests, result summaries, prior failed attempts and actual compact screenshots. The accepted B/Dock shell is retained with Nuxt UI modal/button/alert primitives. Physical Android Chrome keyboard/safe-area checks remain unavailable. No unrelated historical untracked artifacts are included.

Origin is refreshed again before completion: feature baseline remains equal to `8379b29` and main has no unique commits. Source issue 3 is re-fetched unchanged/open with no comments. Ticket 27 closes locally; 28 is the next unclaimed frontier and 29 remains last. No successor is started, PR 28 remains draft, and no merge or source-issue closure is performed.
