# Ticket 20 focused feedback evidence

Baseline: `92c4bd85a2891bb1144c01e19d2b6088a93d5a7b` (the coordinator-confirmed feature baseline; intentionally ahead of `origin/main`). The coordinator froze the implementation candidate before the compiled QA run.

The focused Playwright seam is the real `/` workspace UI. The tests verify that a clean, hidden chart-name session has an accurate resume message and that feedback has one visible save owner, stays compact at the bottom, and leaves ordinary controls reachable. At 390×500, the inactive page feedback is inert while the compact panel recovery slot owns presentation.

## Red / green

The red run failed at the intended assertion because a hidden clean session had a Resume button but no `Chart names ready to resume` message. The initial non-escalated attempt was blocked before the test ran by local-network sandboxing; the red report is from the authorized rerun that reached the assertion.

The green run passed both focused tests. It checked hit targets for Add, Fit, Back to Jump Cluster, the inspector chart-name action, and the chart-dialog Apply action; it also checked compact-panel recovery ownership at 390×500.

## Rerun details

Test file: `tests/workspace-chart-feedback.spec.ts`.

Playwright config: `qa/playwright.full.config.ts` in this ticket's `qa/` directory. It uses Chrome at `http://127.0.0.1:3100` and requires `QA_DEV_OUTPUT_ROOT` to point to a fresh directory outside the repository.

Command used for both runs:

```powershell
C:/nodejs/node.exe node_modules/@playwright/test/cli.js test tests/workspace-chart-feedback.spec.ts --config .scratch/interface-revamp/implementation-lab/ticket-20-resume-2026-10-19/qa/playwright.full.config.ts
```

The red invocation added `--grep 'hidden clean chart-name session'`. Reports are `focused-red.playwright.json` and `focused-green.playwright.json` beside this file; original temporary report roots were under `%TEMP%/codex-ticket20-feedback-red-20261019/` and `%TEMP%/codex-ticket20-feedback-finalfocused-20261019/`.

`npm.cmd run typecheck` exited 0. Typecheck stdout was not redirected to a file. The separate existing chart/theme run was interrupted after two chart cases passed, to avoid duplicating the coordinator's compiled QA; it is partial and is not a suite result.

## Fitted-target obstruction regression

This is a separate, causal RED for the later bounded Fit-obstruction correction. The one-test run used the coordinator-authorized compiled Chrome server at `http://127.0.0.1:3180` and the then-current compiled app, before the source correction. The test exercised the real workspace at 390×500 in dark mode, induced an IndexedDB save failure, kept a modified chart-name draft hidden, and invoked explicit Fit. It failed at the public `elementFromPoint` hit-target assertion: the ordinary lower-right planet was not reachable (`Expected: true`, `Received: false`, test line 246). The run reported 0 expected, 1 unexpected, 0 skipped. This report is the causal RED; no GREEN result is claimed here. The corrected-build GREEN run is owned by QA.

The exact focused invocation was:

```powershell
$env:QA_COMPILED_REPORT='C:/Users/fbal-fontaine/AppData/Local/Temp/ticket20-feedback-red-results.json'
$env:QA_COMPILED_ARTIFACTS='C:/Users/fbal-fontaine/AppData/Local/Temp/ticket20-feedback-red-artifacts'
npx.cmd playwright test --config '.scratch/interface-revamp/implementation-lab/ticket-20-resume-2026-10-19/qa/playwright.compiled.config.ts' tests/workspace-chart-feedback.spec.ts --grep 'explicit Fit keeps a lower-right planet reachable beside failed-save feedback and a hidden chart draft'
```

The report and console log were copied from the explicit host TEMP paths into `fitted-target-red.playwright.json` and `fitted-target-red.log` beside this record. A first typecheck attempt failed because a temporary `node:fs/promises` import had no TypeScript declarations; the import was removed, then `npm.cmd run typecheck` exited 0. Typecheck stdout was not redirected, so there is no typecheck log file. This does not change the result of the later compiled RED described above.

Frozen source-candidate SHA-256 values:

| File | SHA-256 |
|---|---|
| `components/WorkspaceFeedback.vue` | `3B517307F74AC7382D6C40FE55FBCA553D5894CC439ED0C7E777DDEB516BA63A` |
| `components/BaselinePage.vue` | `EF27F9AB5A61F2727C2C6806586BDCC733AD204235C633495F8004702596604A` |
| `components/WorkspaceMapCanvas.vue` | `C072CA329361D651EBC8E1CF4F49221A1E1F5FB3575CA6F9E6A6749B064F22ED` |
| `assets/css/map-workspace.css` | `2A94615868B9FD5E837295A85440E582177021F2425F4E7209B7701D441942DD` |
| `tests/workspace-chart-feedback.spec.ts` | `92322A38234DB12BE899439D8EF3CF30326C5D552CAE285A0DB8E065EB39E6E4` |
| `tests/workspace-chart-drafts.spec.ts` | `C0A02672CCCA5BB010F09425DBCD43A8445C4520CC5A409C956BA0C2D731BE51` |
| `components/WorkspaceHeader.vue` | `64745F00DDC3E90448C26DD2A136E819C177C6B0811B3C9EDFAF4272A8386ABE` |
| `components/WorkspaceDock.vue` | `2D87A2C1A0D01C9BA0504776241C5BDBC79FDF7FD5399CAC5D6032A68E9171DB` |
| `components/MapHierarchy.vue` | `79AC410E1F85607FFE20145E79D005789AFB7EAAE41FC28BC0E4B3742CFFA902` |
| `components/inspector/ChartDetailsPanel.vue` | `9AE300F7B6B9434F1B3900624A926794277A8B16B81818FB2D013686302EDA7F` |
