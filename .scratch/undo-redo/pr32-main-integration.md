---
title: Integrate current map positioning into Undo/Redo
status: complete
assignee: coordinator
---

# Integrate current map positioning into Undo/Redo

## Authorization and baseline

The user reported conflicts and a failing test on [PR #32](https://github.com/Submoon/ttrpg-cluster-control/pull/32) on 2026-10-28 and authorized the necessary correction through that request. Current feature baseline: `e40e138c2fce6032bde1665a3c37d833c28fd913`. Refreshed `origin/main`: `e145a48c1a1237174dc5eb894a1f1263dd74c01d`, the merge of [Enable durable exit placement and map-based positioning — PR #31](https://github.com/Submoon/ttrpg-cluster-control/pull/31). Their merge base is `9edfa66c4f505d56f106fc4af8245f200abfba78`; main has eleven newer commits and this branch has five implementation commits.

The coordinator began a local `origin/main` merge into `codex/undo-redo-ticket-01` with `--no-commit --no-ff`. This preserves published history and avoids a force push. No PR merge, release or issue closure is authorized. Local main belongs to another checkout and is left untouched; unrelated `.codex/environments/` configuration and other worktrees remain outside this effort.

## Required outcome

Preserve the complete Undo/Redo session contract and the incoming map-only placement contract. Numeric X/Y and positional-angle editors must not return. New unresolved-exit and unoccupied-Orbit-center movements must participate in the shared history executor, with exact restoration of identities, relationships and optional target positions. Keep saved-state, modified-draft, gesture, preview, candidate-choice and capacity gates, and allow a clean armed Add tool. Maintain the incoming explicit-versus-inferred Orbit preference behavior and relationship-safe Inspector draft rebasing.

Resolve eleven conflicted files and audit automatically merged workflow wiring; textual conflict clearance alone is insufficient. An architect establishes shared interfaces before disjoint implementation ownership. Independent integration and complementary persistence/guard reviews follow the frozen resolution. The coordinator owns Git, runtime ports, builds and integrated verification.

## Confirmed CI defect

Run `40712162622`, browser shard 2 job `122901039029`, failed the attached-Orbit invalid-import recovery test. `getByRole('alert')` correctly found the actual import error plus an empty history error placeholder incorrectly marked as an alert. Correct the placeholder semantics while retaining genuine history alerts and the strict import-error assertion. The original CI log is preserved in ignored `test-results/pr32-current-ci-shard2.log`.

The completed first shard also failed four scenarios because of the same empty alert: object validation, invalid Cluster coordinates, malformed JSON and invalid Orbit-center inputs. Some numeric-position scenarios are replaced by the incoming approved map-only workflow, but the bogus alert is still fixed at its source. A separate Chart details appearance assertion failed after selecting a map object and must be reverified on the integrated renderer. Shard 1 evidence is preserved in `test-results/pr32-current-ci-shard1.log`; do not describe this CI attempt as a single failed test or as green.

## Execution

The read-only architect established the integration contract before implementation. Writer A owns controller/types/history integration and a new public-coordinator integration test; Writer B owns map components/rendering, BaselinePage wiring and existing test migrations. A separate narrow writer corrected empty-alert semantics. No writer owns shared Git, servers or final validation.

Keep `EditorWorkflowOptions` based on `mutations` and `initializeWorkspace`; incoming actions must not restore direct writer access. Unresolved-exit proposals are prepared against current data with route identity and Cluster context. Orbit-center confirmation awaits a truthful memory verdict and retains ownership through capacity cancellation or changed previews. Position-only edits retain main's relationship-specific guard behavior; only history traversal requires all unapplied editing work to finish. Rebase an unrelated Inspector draft after accepted positional memory publication, without waiting for durability.

Both renderer preview/event families coexist. Free-center arrows use explicit Move/Confirm; radius and rotation retain continuous history grouping. All system and unresolved-exit gestures contribute to the editing guard and roll back on cancellation. An unresolved route reveals its exit marker; resolved routes retain their fallback. The existing canonical snapshot boundary already preserves `unresolvedExitPositions`, so no parallel codec is added. Clean Add reconciliation clears obsolete explicit Orbit preferences as well as input references; hidden map coordinates cannot become an unresolvable draft blocker.

Verification covers new movement round trips and their automatic/manual distinctions, target-layout cleanup/restoration through route changes and interchange, unrelated-draft rebasing, cancelled/stale confirmation, idle Add versus actual pending work, continuous geometry grouping and save recovery. The exact-head production build and complete suite are tracked in the PR's CI evidence before delivery.

## Verification progress

- Manual resolution baseline: the merge's `AUTO_MERGE` tree is `8abdb4d2f651e04ca63cbc5c92d2ece3b1de7134`; independent reviewers used it to isolate resolutions and then traced merged callers and automatically merged code.
- General integration review and complementary guard/persistence review have no remaining production-code findings. Corrections restore the fresh-route creation blocker and carry Orbit-center preview ownership through delayed capacity consent. Invalid-mode cleanup retains a valid cancelled preview or newer replacement rather than publishing or discarding the wrong intent.
- Global lint passes. The third integrated typecheck passes after correcting merged callback options, duplicate exposure and truthful boolean returns.
- The initial focused pure attempt passed 12/14; its two failures were test oracles for one floating-point normalization bit and the incoming source-point preview created by Move. Their corrections preserve exact history restoration and strengthen actual pending-preview refusal.
- All 145 pure scenarios subsequently passed in 2.8 minutes, including optional target-layout compatibility, remapped import keys, exact new-family Undo/Redo, deferred consent replacement/mode invalidation and route-draft blocking. Report: `test-results/pr32-main-all-pure-results.json` (ignored execution artifact).
- Mounted checks confirm strict malformed-JSON and attached-Orbit validation recovery, Chart details appearance, and the incoming Orbit Inspector geometry without numeric position controls. A second focused run confirms Move System preview, fresh-route traversal refusal and the nested star-system editing journey.
- Initial development-browser batches also exposed test setup/locator errors and development-server timeouts; these attempts are not reported as green suites. Setup corrections preserve strict validation, data and refusal assertions. The unresolved-exit history bridge revealed a genuine offscreen-marker restoration after Undo, including after waiting for deferred reveal; its viewport containment oracle remains intact while the map reveal is corrected.
- Final local affected checks and the exact published-head CI build/full suite remain required before delivery. CI execution evidence will be linked in the PR to avoid a documentation-only commit changing the already verified head.
- A measured diagnostic rejected the initial mount-order hypothesis: the restored marker center was exactly 20 screen pixels inside both viewport edges, while its 336-pixel geometry and 384-pixel painted bounds overflowed. `revealSvgTarget` discarded target extent and delegated to point-only reveal. The final bounded-target calculation uses the actual circle's transformed stroke extent, preserves the explicit Orbit anchor path and removes the unproven canvas queue change. The temporary diagnostic file was removed; its ignored report is `test-results/pr32-reveal-diagnostic-results.json`.
- All seven new geometry checks pass, covering measured painted extent, partially clipped targets, no-op containment, left/top edges, near-full targets, oversized anchor fallback, idempotence, nonuniform transforms and invalid viewports. Final mounted verification passes all four route/object/Orbit context journeys in 42.3 seconds, including complete painted-marker containment and unchanged zoom. Reports: `test-results/pr32-main-reveal-pure-results.json` and `test-results/pr32-main-painted-reveal-results.json`.
- The final Add-label test uses the public page-level Placement dialog because its content is teleported outside the creation group. It passes with the original dirty-draft refusal assertions. Final scoped lint and final typecheck pass after the geometry correction. Independent final review closes the bounded-target correction with no remaining findings; the complementary persistence/guard review remains closed on unchanged source.
- Local integration is complete. The reviewed merge contains no unresolved index entries or conflict markers. Publication and the exact-head CI build/full suite are the remaining delivery gates; their live outcome is recorded in PR #32 rather than a further source commit.
