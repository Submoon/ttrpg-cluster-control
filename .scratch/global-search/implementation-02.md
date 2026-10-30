---
title: "Active-system object search: implementation and verification"
status: in-progress
---

## Scope and baseline

The user authorized sub-agent coordination of [Find an object and frame its branch in the active system](tickets/02-active-system-object-branches.md) on 2026-10-30, after pushing completed ticket 01. Only ticket 02 is claimed. Branch: `codex/global-search-ticket-02`. Pinned implementation/review baseline: **f60da958d75cd671cb801ae538a84076c638ff3d**, preserving the completed predecessor. Freshly fetched `origin/main` and local `main` remain `8d4b66504ca6723db5405ed7cb93d0a666264c9a`; this intentional base is five commits ahead and zero behind. No main fast-forward is needed. GitHub #7 was re-read unchanged, OPEN, with enhancement / priority:P1 and no comments.

Ticket 01 was pushed to `origin/codex/global-search-ticket-01`; the new branch keeps that delivery intact. Preserve unrelated untracked `.codex/environments/`. No PR, merge, release or source-issue modification is authorized. Object search across inactive systems remains ticket 03.

## Architecture and ownership

Complex route: a read-only architect resolves the smallest extension of the existing result identity, complete guarded reveal, branch geometry and zoom/restoration contract before developers edit source. At most two writers receive disjoint file ownership. The coordinator owns shared Git operations, server ports, browser sessions, preparation/static/build scheduling and integrated checks. Architects and reviewers are read-only.

The user already approved the seams: actual composed editor reveal commands with real draft guards; public browser journeys for visible framing/focus/compact input; pure matching, branch membership and geometry calculations. TDD uses one failing behavior and minimal implementation per cycle, without mocking internal draft resolution. No new product decision is inferred.

The completed architect handoff found no unresolved product question or need for an ADR. Extend the existing result target with explicit object/system identity and an optional Location key on its row. The pure search calculation includes objects only when composition supplies the active system ID from system view. Keep cluster/system behavior intact. The complete reveal command validates that scope, preserves a matching object session by full identity, and compares the complete accepted destination signature after every asynchronous boundary. Geometry refusal is atomic; rejected/obsolete work must not overwrite newer selection or camera, and legitimate guard Apply remains applied.

Branch membership follows hosted Orbits and their occupants recursively with visited sets, excluding the target's parent, siblings and arbitrary references. Bounds combine applied object marks/keys/names and analytic rotated ellipse extents, excluding invisible hit areas, edit handles and preview geometry. The mounted system renderer owns a valid lower zoom floor shared by D3, pinch, controls, viewport restoration and redraws; no persisted field or global zoom constant is introduced. Search fits in the existing obstruction-aware usable rectangle, with a bounded scale for isolated objects.

Writer A owns `utils/workspace-search.ts`, `WorkspaceSearch.vue`, `useEditorWorkflows.ts`, `useEditorNavigation.ts`, existing search matching/command tests and README. Writer B owns `SystemMap.vue`, `WorkspaceMapCanvas.vue`, renderer changes if required, a focused pure branch/framing helper and tests, and the new public object-search browser specification. Shared interfaces are agreed before editing; further ownership changes require coordinator assignment.

## Check record

Implementation is in progress after the architecture handoff. The coordinator owns the development server on loopback port 3217. Use focused checks during development, freeze source before integration, run lint/typecheck and production build where required, and run the complete suite once. Rerun only affected checks after corrections and record first-run failures honestly. Runtime screenshots/traces belong in ignored test artifacts. Browser mobile emulation does not certify a physical software keyboard or screen reader.

| Scope | Evidence | Outcome |
| --- | --- | --- |
| Pure active-system lookup | `test-results/global-search02-core-red-model-2` | Behavioral red: query by the first object's Location key expected one result and received none. |
| Public object-search tracer | `test-results/search02-browser-tracer-red-warm/report.json` | Behavioral red after successful public system import/navigation: Search could not expose the named nested object (21.8s). Source writers paused for this run. |
| Initial browser environment | `test-results/search02-browser-tracer-red/report.json` | Cold Nuxt first SSR render took 33.6s, exceeding the default 30s test during page navigation. This is not behavioral red evidence; the unchanged warm repeat reached the missing feature. No timeout was increased. |
| First integrated typecheck | `test-results/search02-first-typecheck.log`, then `search02-first-typecheck-fixed.log` | First run found one missing destination-signature argument in rollback and two fixture typing diagnostics. Explicit narrowing/required fixture capability and the missing argument corrected them; the repeat passed. |
| First rendered branch | `test-results/search02-browser-first-complete/report.json` | 1 passed (7.2s): readable branch beside retained Inspector, explicit Location key/context, large rotated branch below 25%, excluded parent/sibling targets, obstruction containment and matching zoom floor. Both detail and large-branch PNGs were inspected before broader verification. |

The initial two geometry-helper tests first failed because their module was absent, then passed together; this is preliminary slice evidence rather than two independent behavioral reds. A later malformed-cycle test was shown sensitive by temporarily removing already-correct visited guards, then restoring them; that is mutation-sensitivity evidence, not a new red-to-green feature cycle. Subsequent missing behaviors use sequential cycles. The first rendered run also exposed a test-only context punctuation mismatch; the next exposed premature camera sampling before the command's final focus. Correcting the assertion and waiting for observable map focus, without sleeps/deadline changes, produced the passing first-slice run above. Product framing was unchanged for those two test corrections.

## Frozen candidate evidence

Both developers completed their assigned source handoffs. The search/command writer passed 34 owned pure cases; the geometry writer passed five pure cases. An additional real-command regression reproduced a material ownership defect: reopening and closing Search during readiness, followed by target deletion, could enter removal rollback despite the changed context. External Search open/close now invalidates the request as well as its context generation; the accepted command's own close remains protected. The regression verifies stale rejection, normalized selection and mode/query/panel preservation, and no camera/focus effect. Ordinary removal still restores a surviving starting selection. Valid Apply, Discard, invalid Apply, Stay, hidden modified Orbit and matching compact dirty-object sessions use the real controllers.

| Frozen scope | Evidence | Result |
| --- | --- | --- |
| Matching, actual editor commands, branch geometry and existing zoom calculations | `test-results/search02-focused-final-pure/report.json` | 42 passed (5.5s), including 34 search cases, five branch cases and three existing zoom regressions. |
| Public object journeys plus predecessor Search and panel regressions | `test-results/search02-focused-final-browser/report.json` | 15 passed (1.1m), with one worker and unchanged deadlines. |
| Rendered desktop/compact review | PNGs in `test-results/search02-browser-visual-final` and the final focused browser report | Isolated leaf at 200%, readable hosted branch beside Inspector, complete large rotated/multiple recursive branches, and compact populated search/portrait reveal were inspected. Touch activation, keyboard list scrolling, retained dirty draft, map focus, repeated framing and ordinary lower-scale revisit passed. |

The final browser oracle is independent of the product's usable-area calculation: painted ring/label client bounds must lie inside the measured SVG and avoid every visible obstruction. An earlier draft reused that product calculation; it was replaced before final focused verification. The test's original singular ring locator was also corrected to inspect all four hosted rings after the fixture expanded. No assertion was weakened, test skipped, or deadline increased.

Final lint, typecheck, production build, independent review and one complete-suite run are pending. Stop the owned development server during shared preparation/build; restart and warm it before the full suite. Source remains frozen except confirmed-review corrections.

## Independent review

Initial integrated candidate: **a9d20ee4de838e2772e1477dfd1605d2c1ed022b**. Its final lint and typecheck passed (`test-results/search02-final-lint.log`, `search02-final-typecheck.log`). The production build was stopped before completion for the confirmed Spec correction below and is not claimed as a successful build.

The independent Standards reviewer found zero actionable violations or significant smell-baseline concerns after inspecting source/callers, ownership, tests/report JSON and all five visual states. The independent Spec reviewer identified one P2: object results matched a chart-name session solely by system ID and therefore bypassed the hidden dirty chart guard. Ordinary object selection guards that transition; selecting an object is not reselecting the chart editing target. The coordinator confirmed the source evidence and assigned a real-command regression/minimal correction plus a public hidden-chart Search regression. Restrict the chart-session exception to system-name results, retaining matching object draft preservation. Reviewer closure and corrected-candidate checks remain pending.

The core developer reproduced the P2 with the real composed operation: a modified hidden chart-name session produced no guard (`observedGuard === null`). The one-line correction restores the exception to `target.kind === 'system'`. Hidden-chart object Stay, invalid Apply and valid Apply then passed; the existing matching system-result chart draft remains preserved. All 37 owned pure search cases passed in `test-results/global-search02-core-pure-final-after-chart-guard`. The UI developer added a public Search regression for Stay/context/camera/query/draft retention followed by Discard/reveal/focus; it is frozen for coordinator verification. No other product behavior changed for this correction.

## Review and completion

Independent Standards and Spec reviews compare the integrated candidate with the pinned predecessor baseline, using the repository rules and ticket/spec criteria. Resolve confirmed findings through the owning developer and obtain reviewer closure. Close ticket 02 only after acceptance and appropriate verification; then unblock ticket 03 without claiming it. The parent specification and GitHub #7 remain open until global object search is complete.
