# Frozen-2 full preservation suite: raw outcome

Candidate: ticket21-resume-source-freeze-2. Baseline: e8bb78c014909f9046eb43c405cfbd7a72b43e3f. Actual persisted product /, development server 127.0.0.1:3100, verified host listener PID 12560. Installed headless Chrome 155.0.8059.80, isolated test contexts.

Exactly one full invocation completed: 99 tests in 17 files; 74 passed, 25 failed, 0 skipped, 0 unrun, 0 flaky. Exit code 1. JSON duration 979316.212ms (16m19.316s). Command interval: 2026-10-19T13:55:02.7439249+02:00 to 2026-10-19T14:11:23.0743521+02:00. One worker, maxFailures 0, retries 0; no CLI reporter override.

All 90 frozen source/test/package hashes match before and after the run. No application, canonical test, Git or repository-evidence write occurred during execution. No correction, affected rerun, build or compiled QA has started. The suite CLI is stopped; runtime is released to the coordinator-designated A for affected-only retests. The original development listener remains PID 12560; it was not stopped.

| File | Passed | Failed | Total |
| --- | ---: | ---: | ---: |
| cluster-map.spec.ts | 3 | 0 | 3 |
| object-fields.spec.ts | 1 | 6 | 7 |
| system-map.spec.ts | 1 | 1 | 2 |
| system-orbits.spec.ts | 1 | 6 | 7 |
| workspace-chart-drafts.spec.ts | 17 | 2 | 19 |
| workspace-chart-feedback.spec.ts | 3 | 0 | 3 |
| workspace-composition.spec.ts | 3 | 0 | 3 |
| workspace-data.spec.ts | 3 | 6 | 9 |
| workspace-launch.spec.ts | 2 | 0 | 2 |
| workspace-map-gesture-guards.spec.ts | 4 | 0 | 4 |
| workspace-navigation.spec.ts | 12 | 1 | 13 |
| workspace-panels.spec.ts | 3 | 2 | 5 |
| workspace-recovery.spec.ts | 6 | 1 | 7 |
| workspace-route-inspection.spec.ts | 1 | 0 | 1 |
| workspace-theme.spec.ts | 4 | 0 | 4 |
| workspace-touch-takeover.spec.ts | 2 | 0 | 2 |
| workspace-ui.spec.ts | 8 | 0 | 8 |


## Criterion 10 and evidence boundaries

The complete cluster-map file passes 3/3, including navigation/arrangement, route-follow during drag and the previously unresolved-exit journey. This supplies current evidence for that unresolved-exit case. The independent system-orbits ring-resize case at line 101 fails radius growth: expected >112, received 112. Its full error, screenshot and trace remain raw failure evidence. Do not transfer the cluster journey pass to the independent ring test. Product-versus-pointer/setup attribution requires adjudication.

Coordinator-attributed offline trace findings remain separate from raw outcomes: chart-delete review expects Delete before opening Hierarchy; pending route setup expects System hierarchy from Cluster; panel reflow/nested dialog use obsolete .map-dashboard-panel descendant; attached Orbit imported-radii recovery reaches its rejection/correction before a later System hierarchy-from-Cluster lookup fails; three further Orbit/preview cases use off-viewport drag/drop coordinates. These are not passing retests and do not waive any capability assertion.

The 3/3 composition cases and other passing groups do not establish the required paired compiled B/Dock visual gate. No compiled build, paired PNG inspection, new-surface contrast result or physical Android Chrome/OS-keyboard/safe-area/gesture pass is claimed. The script-preparation syntax check passed before this run; list-only preparation metadata is separate from this actual full-suite JSON.

## Raw failed cases

- object-fields.spec.ts:7 - the Warden can build and edit a nested star-system map.
- object-fields.spec.ts:114 - Chart details is an active, keyboard-accessible inspector view.
- object-fields.spec.ts:172 - the Warden can configure native and reusable custom object fields.
- object-fields.spec.ts:265 - custom field category and subtype scopes hide ineligible objects without deleting values.
- object-fields.spec.ts:349 - field definitions dialog stays centered on desktop and narrow viewports.
- object-fields.spec.ts:374 - field definition management previews destructive changes in a map-bound dialog.
- system-map.spec.ts:22 - the system map expands beyond its initial bounds and exports the full layout.
- system-orbits.spec.ts:101 - dragging an Orbit ring scales both axes and the system caption stays concise.
- system-orbits.spec.ts:147 - the Warden can edit, save, export, and import an elliptical Orbit around an unoccupied center.
- system-orbits.spec.ts:483 - the Warden can detach a hosted Orbit and move its unoccupied center.
- system-orbits.spec.ts:605 - an object drag keeps its hosted Orbit with it before release.
- system-orbits.spec.ts:674 - dropping an existing unoccupied Orbit center onto an object raises too-small radii and round-trips.
- system-orbits.spec.ts:828 - object palette drag previews match placed marks and preserve map, Orbit, and keyboard adds.
- workspace-chart-drafts.spec.ts:781 - canceling the initial system-delete review leaves a hidden chart draft and error untouched.
- workspace-chart-drafts.spec.ts:962 - a delayed import acknowledgement does not take ownership of a pending route guard.
- workspace-data.spec.ts:207 - custom field category and subtype scopes are united on independent system import.
- workspace-data.spec.ts:319 - the Warden can review and safely confirm dependent map deletions.
- workspace-data.spec.ts:486 - the Warden can export a cluster and standalone system as versioned JSON.
- workspace-data.spec.ts:697 - the Warden can validate and import an independent JSON copy.
- workspace-data.spec.ts:928 - the Warden can import a standalone system without adding cluster routes.
- workspace-data.spec.ts:973 - the Warden can complete the local campaign workflow end to end.
- workspace-navigation.spec.ts:345 - Move selects map entities without opening Inspect or entering a system.
- workspace-panels.spec.ts:186 - desktop-to-compact reflow retains an invalid chart-name draft and the active map mode.
- workspace-panels.spec.ts:237 - a nested chart dialog pauses the compact panel focus trap and returns focus to its opener.
- workspace-recovery.spec.ts:103 - an attached Orbit with undersized imported radii is rejected without losing current data.


## Persistent evidence

All operational evidence is outside the watched repository at C:/Users/fbal-fontaine/AppData/Local/Temp/ticket21-final-qa-20261019-run1.

- full-suite.json: original complete configured Playwright JSON.
- full-suite.stdout.log and full-suite.stderr.log: separate command streams.
- full-suite-command-result.json: exact invocation identity/interval/exit.
- full-suite-normalized.json: per-test exact error text, locations and per-file counts derived from original JSON.
- full-suite-artifacts/: original failures, screenshots and traces.
- pre-full-source-hashes.json and post-full-source-hashes.json: all 90 original/final values.
- post-full-runtime-summary.json and runtime-release.json: hash/owned-process/server handoff identity.
- syntax-results.json and per-file syntax stdout/stderr: latest prepared QA script/config syntax only.

Preserve this raw run separately from any future corrected affected-only results. No second full invocation is authorized by this report.
