# Editor architecture audit and implementation

Date: 2026-10-26. Architecture implementation and independent source reviews are complete. The integrated application passed the full CI suite; the CI follow-up below has separate acceptance evidence.

## Baseline and scope

Audited and implementation baseline: `92d2716595d65ba2886f9adb89d872e558005f06` on `codex/interface-revamp`, [PR 28](https://github.com/Submoon/ttrpg-cluster-control/pull/28). Fetched `origin/main`: `629d2a98715c3a16b954e0f77c639b1f0c31212c` (0 main-only / 63 feature-only). The feature branch is intentionally retained.

The user authorized adopting Pinia, separating source responsibilities, fixing the audit findings and writing focused English conventions. The accepted B/Dock interface, Nuxt UI composition, saved formats and single workspace writer remain constraints.

## What the audit established

The editor had been split into files but exposed one broad application interface: TypeScript inspection counted 170 workflow members, 91 editor-state members and 28 cluster inputs. These were evidence of repeated forwarding and mixed responsibilities, not maximum-size rules.

`useEditorState` mixed selected IDs and panel state with editing sessions, unresolved confirmation callbacks, map handles and browser subscriptions. Object draft initialization was duplicated; relationship changes appeared in both forms and independent workflow implementations. Obsolete child-save interfaces described a draft authority that no longer existed.

SOL and Astra recommended a modest shared UI store with specialized editing and browser-resource owners. Pinia alone would not correct the dependency boundaries.

## Implemented direction

- Shared selection, map/tool, panels and visit memories now belong to the Pinia UI store. Workspace identity and editor lifetime control its reset; ordinary updates preserve it.
- Navigation, chart drafts, transition sequencing, map controls, viewport effects and asynchronous candidate requests have separate owners. Dock and Hierarchy consume shared state and a focused guarded-command context.
- Parent-owned editing sessions and the ordered IndexedDB writer remain separate. Applying a change in memory and completing a durable save retain distinct meanings.
- Object-placement changes use a pure domain operation that preserves unaffected occupants' effective angles. Draft projection and validation are shared outside presentation components.
- Obsolete editor-state and child-save interfaces were removed. Map redraws retain logical keyboard focus; cancelled mouse gestures release their owned D3 resources.

The durable contracts and code-navigation index are in [editor architecture](../../docs/architecture/editor.md). [Source conventions](../../docs/agents/conventions.md) cover responsibility, interfaces, Vue/Nuxt/TypeScript and meaningful comments. [Verification guidance](../../docs/agents/testing.md) defines proportional checks. [ADR 0001](../../docs/adr/0001-editor-state-with-pinia.md) records the Pinia decision. The development skill coordinates specialists and links to those documents.

## Supporting defects and evidence

Before implementation, Inspector relocation moved an untouched Orbit occupant by 160 map units; cluster selection with Enter dropped focus to `BODY`. Source inspection found incomplete native D3 drag cleanup. These supported the architecture changes; they did not replace the responsibility/interface review.

The baseline [CI](https://github.com/Submoon/ttrpg-cluster-control/actions/runs/40328129722) passed 201/202 tests. Its exact-radius Orbit pointer search failed on Linux. The test now calculates the expected radius from an actually representable pointer pixel instead of requiring an unavailable exact radius.

## Verification and review

Local evidence covers ten placement/draft/isolated-Pinia tests and 49 selected production-build scenarios, reusing successful checks for unchanged code. Lint and typecheck pass; the production server builds and renders successfully. The initial SSR run exposed bundled-versus-external Pinia identities; the focused bundling rule removes that split. Two new test locators and an implicit Add-menu setup were corrected rather than adding retries.

SOL and Astra verified substantive ownership and interface changes. Their compact-panel, shared-placement and completion-feedback findings are closed. Browser checks also caught blocked-drag feedback being lost during synchronous cleanup; the corrected ordering passes its existing regression. A final repaint-only correction is source-reviewed and linted; the CI rebuild checks the exact candidate. Full-suite results, including the Linux Orbit case, belong to the [current PR checks](https://github.com/Submoon/ttrpg-cluster-control/pull/28/checks), avoiding a duplicate complete local run.

The first complete CI run passed 216/217, including the Linux Orbit case. The remaining test mixed a touch cancellation with an immediate mouse retry, making it sensitive to D3's post-touch mouse guard. It now retries with touch and preserves all failure/recovery assertions; all ten surrounding gesture cases pass locally. CI now uses the official Playwright image with an installed-package version guard: the previous setup spent 10m30 fetching Linux dependencies but approximately seven seconds fetching browser binaries. Independent review accepted both follow-up changes; current PR checks verify their runner execution.

Physical Android keyboard behavior and screen-reader speech are outside the collected evidence. Unrelated `.codex/environments/` files are preserved.

## CI follow-up

Commit `c366660c6d085a43e9ff0371cfe4cc062949852c` passed [all 217 tests](https://github.com/Submoon/ttrpg-cluster-control/actions/runs/40354008558), with no retries or skips. The job took 18m02, including 16m30 of tests; container preparation took 26 seconds. The CI follow-up intentionally starts from this feature commit and the same `origin/main` baseline (0 main-only / 65 feature-only).

The follow-up separates 15 existing pure tests, one development-only storage regression and 201 public browser cases, adds 12 resolver/authentication contract checks, and divides the browser cases into two shards (104 and 97). SOL and Astra source reviews found no remaining material issues. The exact-SHA resolver also successfully selected the existing deployment through GitHub's real API. Three campaign route cases share an immutable, in-memory IndexedDB snapshot while retaining isolated contexts; the focused local comparison took 22.1s with repeated public imports and 18.8s with snapshot preparation, including worker setup. This small sample is indicative, not a prediction of total CI duration.

Lint and typecheck pass. All 28 checks-partition cases and all seven affected route scenarios pass locally with the final fixtures; discovery finds 229 cases without duplication. The protected-preview browser run still requires the repository's `VERCEL_AUTOMATION_BYPASS_SECRET`; deployed authentication and final shard timings are not yet verified. [Verification guidance](../../docs/agents/testing.md) records the maintained setup and isolation contracts.
