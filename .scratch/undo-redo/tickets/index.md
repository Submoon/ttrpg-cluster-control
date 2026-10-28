# Undo/redo implementation tickets

Eight local implementation tickets were approved through the Codex question form on 2026-10-27, including read-only History consultation. All eight are now closed following the user's separate implementation instructions. The completed 2026-10-28 ticket 07 execution supplies the final keyboard/compact behavior and integrated verification. Local triage roles remain `enhancement`/`ready-for-agent`.

Parent: [Undo and redo for applied workspace changes](../spec.md). Planning and approval record: [Undo/redo implementation ticket plan](../ticket-plan.md). Source: [Undo/redo functionality — GitHub issue #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5).

Planning baseline: `9edfa66c4f505d56f106fc4af8245f200abfba78`, equal to freshly fetched `origin/main` at publication on 2026-10-27.

| Ticket | Delivery | Blocked by |
| --- | --- | --- |
| 01 | [Prepare truthful mutation outcomes and action context](01-prepare-mutation-outcomes.md) | None |
| 02 | [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md) | [Prepare truthful mutation outcomes and action context](01-prepare-mutation-outcomes.md) |
| 03 | [Restore useful context without stale drafts](03-restore-context-and-drafts.md) | [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md) |
| 04 | [Group continuous keyboard and wheel adjustments](04-group-continuous-adjustments.md) | [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md) |
| 05 | [Restore deletion cascades and shared Fields effects](05-restore-cascades-and-fields.md) | [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md) |
| 06 | [Traverse reviewed imports and exports with exact identity](06-import-export-history.md) | [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md) |
| 07 | [Complete keyboard and compact interaction](07-keyboard-and-compact-controls.md) | [Restore useful context without stale drafts](03-restore-context-and-drafts.md) |
| 08 | [Inspect retained session history](08-inspect-session-history.md) | [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md) |

## Execution frontier

All eight tickets are closed; no implementation ticket remains on the frontier. This graph expresses behavior dependencies, not permission for overlapping writers or Git operations.

The first working history in 02 records every mutation and includes the safety floor. Later family tickets add their complete consequence/consent integration and evidence rather than leaving unrecorded data paths.

All eight are integrated. Parent verification includes the recorded Sensitive-route restoration/persistence reviews and the final complete suite below. Each ticket owns its affected failure evidence.

The user separately authorized tickets 01 and 02 on the current branch `codex/undo-redo-ticket-01`. Their tickets record the respective baselines and execution contracts. The subsequent 2026-10-28 instruction authorized tickets 03/04/05/06/08 and local commits. It did not authorize ticket 07, remote writes, push, PR or merge.

## Completed work

[Prepare truthful mutation outcomes and action context](01-prepare-mutation-outcomes.md) established the shared application contract, separate memory/durable results and stale-session guards. Its resolution records the static/build checks, independent reviews and full-suite results, including two timeouts that passed isolated retests.

[Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md) delivered the shared bounded session history, direct commands, saved-state/pending-work gates, oversized consent and recovery. Its resolution records the independent reviews, larger-workspace observations, initial complete attempt and passing targeted corrections, including stable controls during menu dismissal.

## Batch execution (completed)

The 2026-10-28 batch intentionally starts from completed prerequisites at `4ad6976aaf0953bcaac90c26eb4e289c3ef75487`. Fresh `origin/main` remains `9edfa66c4f505d56f106fc4af8245f200abfba78`; local `main` is already current. A read-only architect established shared interfaces before two disjoint implementation writers: 03+08 owned context and consultation; 05+06 owned reviewed families/imports. Ticket 04 followed shared integration, with disjoint map and controller ownership. Final integration used the previously approved testing seams, one complete suite and independent Standards, Spec and Sensitive persistence reviews. Current-branch commits are authorized by `implement`; remote writes/push/PR/merge are outside this instruction.

## Batch verification

The user authorized local tickets 03/04/05/06/08 on 2026-10-28. Implementation intentionally starts at completed prerequisites `4ad6976aaf0953bcaac90c26eb4e289c3ef75487` on `codex/undo-redo-ticket-01`; freshly fetched `origin/main` and local `main` were `9edfa66c4f505d56f106fc4af8245f200abfba78`. The GitHub source was re-fetched unchanged before finalization: open, same labels and no comments. No remote issue/PR write, push, merge or other-worktree change was performed.

Source candidate `021ae929c67eb7f75aa1efda81679d973555b624` includes the final route focus correction. Independent Standards, Spec and complementary persistence reviews closed their findings; the last route component change received a focused Standards review. Earlier architecture audits also closed queued reset/cancellation and stale focus-frame defects. Review corrections have public regressions for accepted-consent sequencing, net-zero representations, discarded save acknowledgements, single-Apply sequencing and modal ownership.

Global lint and TypeScript checks passed. The initial production build passed in 1m46s; the corrected production build passed in 1m15s and all 7 affected route/responsive retests passed in 31.6s. One complete configured suite attempt covered 336 scenarios: checks/real IndexedDB passed 113/114 in 44.3s, and browser journeys on the production build passed 221/222 in 17.8m, with no skips or retries. The pure failure was a controlled test gate released before asynchronous preflight reached it; its observable pending-request signal fixes the test without weakening assertions, and the affected file passed 4/4. The browser failure exposed a real invalid-route validation-focus regression, fixed and verified on the corrected production build without changing the original focus/Stay assertion.

The additional retention browser test passed 1/1 using 101 real key press/release operations after Orbit creation: 100 retained rows, eviction of the creation action, real scrolling/current position, unchanged consultation data/history and persisted geometry with empty history after reload. Desktop/compact History and held-key reflow screenshots were inspected. Earlier focused tests include 23 controller/adapter/Apply regressions, exact family round trips, descriptor context and mounted grouping/consultation flows. The first focused 11-case browser batch had 8 passes; all three failed cases passed targeted corrections for context/visible text and camera/panel test preconditions. Both Ctrl-wheel orders and pending compact reflow were verified.

Local ignored reports include `test-results/batch-03-08-full-checks-results.json`, `test-results/batch-03-08-full-browser-results.json`, `test-results/ticket04-transition-file-fixed-20261028-results.json`, `test-results/spec-closure-250b3050-results.json`, `test-results/tickets04-gesture-reflow-20261028.json` and `test-results/tickets03-08-retention-ui-retry2-20261028.json`. Early per-slice reports were accidentally cleared by one default-output test invocation; later commands used isolated output directories, and the integrated attempt covers their maintained scenarios. Do not present this evidence as one entirely green full-suite attempt.

Viewport/input automation verifies browser behavior, not physical-device, operating-system keyboard or screen-reader certification. Headless Apply tests emit Vue lifecycle warnings; mounted browser tests cover the actual lifecycle hooks. Encoded history capacity remains 100 edges / 32 MiB, not a heap guarantee; no new performance guarantee is claimed.

Final route verification: 7/7 passed on source candidate `021ae929c67eb7f75aa1efda81679d973555b624` (`test-results/batch-03-08-route-final-results.json`). Both full-attempt failures are corrected and reverified. The additional retention case passed separately, bringing maintained scenario coverage to 337 unique cases across the complete attempt and affected follow-ups. Final source review has zero remaining Standards or Spec findings and complementary persistence approval. Completion-only documentation is the only difference between that verified source candidate and the final commit. All owned local servers have been stopped.


## Ticket 07 execution

The user separately authorized [Complete keyboard and compact interaction](07-keyboard-and-compact-controls.md) on 2026-10-28. It is closed after coordinator-owned execution starting from `bee7f13f2150d71097ea097d5fbb155b66f4c3ff` with all dependencies closed. Fresh `origin/main` remains `9edfa66c4f505d56f106fc4af8245f200abfba78`. This Standard-route change exposes existing guarded commands without changing mutation, history or persistence semantics. TDD used the already approved public command/browser seams. Independent Standards/Spec reviews and a complementary guard/persistence review each closed with zero findings. The existing writer, saved-state gate, context reveal and bounded-history evidence remain authoritative.

## Ticket 07 verification

Frozen source candidate `66541d3a414f6cd04b1cadef3e751d13c72c3738` passed global lint, typecheck, a production build and one complete suite: 114/114 checks/real IndexedDB scenarios in 38.1s and 232/232 production browser journeys in 15.3m, with no skips, failures or retries. This is 346 successful maintained scenarios on the fully integrated eight-ticket implementation. Nine focused keyboard scenarios and ten existing button/consultation scenarios also passed before the complete run. Compact screenshots and desktop/mobile/short-landscape control geometry were checked. The ticket resolution records exact report paths, behavioral coverage and browser-emulation limits. All owned servers are stopped; only completion documentation differs from the verified source candidate. No remote issue write, push, PR or merge was performed.

## PR feedback refinement

The user authorized four refinements to [PR #32](https://github.com/Submoon/ttrpg-cluster-control/pull/32) on 2026-10-28. Execution starts at `e65049a0fb6907506e45b2d0e1b7694d7beccd58`; refreshed `origin/main` and local `main` remain `9edfa66c4f505d56f106fc4af8245f200abfba78` (zero behind, four implementation commits ahead). Preserve unrelated environment configuration. The requested changes remove routine session-start copy, put Undo/Redo counts inside their buttons, move Back left of the Star System name, and allow history traversal while Add is idle. Actual unapplied inputs, previews, choices, gestures, modified drafts and unsaved data continue to block traversal. An armed Add tool alone is UI state rather than unapplied work.

The coordinator owns Git, runtime ports and integration. Two disjoint writers own presentation and Add lifecycle respectively, followed by independent review. The user has authorized updating the existing PR branch; merge and source-issue closure remain outside this instruction. Successful unchanged history/storage evidence remains applicable.

The initial red reproduced unavailable Undo after saved object, Orbit and Cluster system creation. The integrated development attempt passed 24/27 scenarios; it exposed independent wrapping of Back and long titles, plus two assertions for the intentionally removed counter sentence. The title now has a nonwrapping, truncatable Back/name group. Independent review also caught rearming Cluster Add incorrectly accepting dirty coordinates as a new baseline; the correction preserves the original baseline, with a public controller regression. Both UI and Add reviews have zero remaining production-code findings.

A native pointer probe then demonstrated a genuine adjacent-command regression: closing Map files removed the blocker sentence and moved Hierarchy upward by about 16 pixels between pointer-down and pointer-up. Real feedback/errors now use a noninteractive callout outside command flow; its chrome stacking context rises only while the notice exists, above desktop panels and below real compact modals. This keeps the notice readable without consuming Escape or adding an empty toolbar row. The public post-import Hierarchy regression preserves one physical click. A forced-open tooltip alternative was discarded after its library source showed Escape ownership. The temporary diagnostic, including its isolated CSS hypothesis, was removed; the maintained regressions exercise actual application source.

Verification includes six passing controller scenarios, lint and typecheck, and a successful 7m39s production build before the final presentation-only notice refinement. On that build, 26/27 affected browser scenarios passed; the remaining count assertion was updated to observe the intentionally hidden Undo button while a listbox owns interaction, then passed its focused retest. Final notice/command layout was verified on actual development source: all ten affected button/capacity/navigation scenarios passed across the integrated attempt and focused corrections, plus the nested listbox and complete short-landscape placement journey. Test corrections respected existing modal ownership rather than making the map visible behind compact Inspector or imposing focus on one specific input. Desktop/compact screenshots, including a long system name, were inspected. Earlier development attempts included a cold click timeout and incorrect compact test preconditions; this evidence is not described as a clean full-suite run.

The first PR CI attempt on `e65049a0fb6907506e45b2d0e1b7694d7beccd58` reported three browser failures. The export and touch cases passed on the corrected production candidate; placement passed on final actual source after resolving the demonstrated command displacement. The complete configured suite is rerun by CI for the updated PR head. Local ignored reports include `test-results/pr32-feedback-pure-results.json`, `test-results/pr32-feedback-production-browser-results.json`, `test-results/pr32-feedback-stable-controls-results.json`, `test-results/pr32-feedback-final-affected-results.json` and `test-results/pr32-feedback-navigation-closed-results.json`. The source branch remains based on the original four completed implementation commits; no merge, release or source-issue closure is authorized. Browser emulation retains the previously recorded physical-input and assistive-technology limits.
