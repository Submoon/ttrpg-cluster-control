# Ticket 27 verification — 2026-10-22

Baseline: `8379b2901c88ebe3fcd1198ffa8b0175ddecbbe2` on `codex/interface-revamp`. The [execution record](../../../research/implementation-27-2026-10-22.md) records architecture, ownership and corrections. This verifies the persisted application, not the memory-only prototype.

## Candidate and method

The corrected application/test snapshot is [the frozen manifest](corrected-source-test-manifest.json), SHA256 `469566365BBC4CF3F1738C6944C6EEF6A478E5EF3094E9DB4E55050BEA944FCA`. Both independent reviewers verified all 35 hashes. The initial reviewed application is separately identified by [its manifest](review-source-manifest.json) and [compiled entry](reviewed-compiled-entry.json).

The [final test snapshot](final-source-test-manifest.json), SHA256 `8B061D4AB1CC5DFE91D62D0BED34A153FF85E06B0104EC463143D4FD5340648C`, differs only in `tests/workspace-reviewed-deletions.spec.ts`: explicitly collapse/reopen Placement around Inspector deletion before asserting the visible selection. All application hashes remain identical to the independently reviewed corrected candidate and [corrected compiled entry](corrected-compiled-entry.json).

The [released test snapshot](released-source-test-manifest.json), SHA256 `CF5099AC9311C604A7A1DF6B10173C569E8B8DD1C50823A78158332DF97F6B6A`, additionally corrects legacy expectations in six test files after the complete run. Application/compiled hashes are unchanged. Import keeps the current map, so cluster controls require explicit navigation; later user navigation still honors Apply/Discard/Stay. Nuxt reviews expose a target plus confirmation action rather than native question text. The reachable Delete action adds a keyboard stop before Apply. Data/reference/reload/scroll/pointer assertions remain intact.

Root serializes local QA with the existing ticket 23 Playwright configuration, Chrome, one worker, zero retries, isolated browser contexts, actual controls/file inputs/downloads/reload and established IndexedDB failure interception. No new application test API, runner or device matrix is introduced. New coverage comprises three deletion journeys, three import journeys and two pairwise compact presentation journeys. Existing format/codec and preservation tests remain in the main suite; only native product-confirmation interactions migrate to accessible Nuxt UI dialogs. Beforeunload and filechooser checks remain unchanged.

## Results before final run

Host evidence directories below are under `C:/Users/fbal-fontaine/AppData/Local/Temp/` and retain JSON reports/traces:

| Evidence directory | Actual result and interpretation |
| --- | --- |
| `ticket23-ticket27-red-deletion` | Expected baseline RED: Delete unavailable while editing. |
| `ticket23-ticket27-red-import` | Expected baseline RED: no import review before unrelated draft resolution. |
| `ticket23-ticket27-deletion-first`, `ticket23-ticket27-deletion-warm` | Failed development attempts: initial SSR timeout, then an unfrozen concurrent-HMR run. Neither certifies behavior. |
| `ticket23-ticket27-deletion-frozen` | 1/1 deletion tracer passed on frozen warm source. |
| `ticket23-ticket27-integrated-first` | 2/2 integrated tracers passed; integrated typecheck passed after correcting readonly summary props. |
| `ticket23-ticket27-preservation-focus` | 4/5 passed; the long cascade exceeded its 30-second budget. |
| `ticket23-ticket27-compiled-focus` | 2/7 passed; failures were new-test setup/locator expectations and the long cascade budget. |
| `ticket23-ticket27-import-corrections` | 1/2 passed: failed-save import/Retry passed; Fields test reached final export but lacked the existing download-capture setup. |
| `ticket23-ticket27-compact-fields-corrected` | 1/3 passed: Fields ownership passed; compact cases reached import review but expected an undisplayed source name. |
| `ticket23-ticket27-review-findings-red` | 3/5 passed: both compact cases and the full cascade passed; two new defect tracers stopped at incorrect independent-import fixture context. |
| `ticket23-ticket27-review-findings-red-corrected` | Pending-host tracer stopped at the closed Placement UI; route tracer stopped at an invalid SVG locator. These setup failures do not prove the target-state postcondition. The stale-target defect was independently established from source by both reviewers. |
| `ticket23-ticket27-route-freshness-red` | Expected RED: Apply changed route endpoints, but deletion did not request renewed review. |
| `ticket23-ticket27-corrections-green` | Route correction passed; pending-target case stopped at the closed Placement UI. |
| `ticket23-ticket27-pending-add-green` | Test setup failed because the open Placement popover intercepted Inspector Delete; no forced click was used. |
| `ticket23-ticket27-pending-add-final` | 1/1 passed: explicit Placement toggles verify cleared deleted host, retained radii/rotation and valid subsequent creation around Iria. |

Test setup corrections preserve actual data/ownership assertions. The one long multi-review/reload cascade receives a documented 60-second case budget; assertion deadlines, retries and global budgets are unchanged. It subsequently passes compiled in 23.5 seconds. All application writes are frozen during accepted runtime verification.

## Independent reviews

**Standards / technical:** initial P2 pending-creation target cleanup defect accepted and corrected through the creation owner. Focused correction review reports no remaining blockers.

**Spec / domain:** initial P2 route endpoint freshness defect and independently corroborated pending-target defect accepted and corrected. Route effect signatures and visible descriptions include endpoint identities/names, systems and unresolved exits. Focused correction review reports no remaining blockers. Reviewers inspected source/tests; root owns runtime evidence.

## Presentation and limits

Compiled pairwise checks use 390×500 dark and 844×390 light, ordinary hit testing, visible footer actions, keyboard focus and return, Escape/cancel, retained selection and unchanged JSON. Root inspected the actual compact import captures: bounded Nuxt UI modal, scrolling body and bottom actions. The existing B/Dock shell is retained; no bespoke dialog positioning or shell redesign is introduced. Nuxt UI supplies modal, button and alert primitives; the application owns prepared consequences and retained drafts.

Physical Android Chrome keyboard/safe-area/physical-contact checks remain unavailable; responsive emulation does not certify them. Ticket 28 image-export completion and ticket 29 final cleanup/whole-interface review remain separate. Source issue 3 remains open and PR 28 remains draft.

## Final gates

Corrected typecheck and production build passed. Both independent-review corrections pass their targeted compiled checks.

The **single complete run is 169 passed / 11 failed**, 180 cases, 991.6 seconds (16.5 minutes), one worker, zero retries/skips/flaky results. It covers 179 compiled-production cases plus the existing development-only storage case. All eight new ticket tests pass. Exact case statuses and initial failure evidence are in [the full-run summary](full-suite-summary.json); raw report/traces remain at host TEMP `ticket23-ticket27-final-suite`.

The eleven failures are obsolete legacy UI expectations described above, not evidence of eleven application defects. The corrected focused rerun passes **11/11 in 1.4 minutes**, zero retries/skips/flaky cases; see [the rerun summary](preservation-rerun-summary.json) and host TEMP `ticket23-ticket27-preservation-final`. Independent technical review confirms preserved functional assertions and no blockers. Final typecheck passes. All application/compiled hashes remain unchanged. **No fresh 180/180 complete-suite pass is claimed.**

Actual compiled captures from the complete run: [dark portrait import](import-review-390x500-dark.png), [light landscape import](import-review-844x390-light.png), [dark portrait deletion](deletion-review-390x500-dark.png), [light landscape deletion](deletion-review-844x390-light.png).
