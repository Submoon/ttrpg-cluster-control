---
title: "Improve the verification loop after the global-search retrospective"
status: in-progress
---

# Improve the verification loop

## Scope and baseline

Authorized on 2026-11-02 following the retrospective: reduce redundant qualification, use a reliable local launcher, validate native UI fit and rendered constraints early, and separate parallel editing from shared browser verification.

Fetched `origin` before work. Baseline: `a8711d85c5ca3a21ce8da16e12c18e4ee7fef7c5` on the existing `codex/global-search` branch. `origin/main` is `d40e5f515baf1afeb0e2135461287b243b2a1f6c` (0 behind / 23 ahead); local `main` is current in another worktree. The intentionally different base retains the completed Search feature and its presentation follow-ups. Preserve the unrelated `.codex/environments/environment.toml`.

## Required outcomes

- Documentation-only changes receive deterministic documentation checks and a successful required quality gate. Unknown paths and runtime/test/config/workflow changes retain complete qualification; base/head comparison includes renames and deletions.
- A short compiled-preview smoke precedes full browser shards and exercises the existing painted Search icon and deep Hierarchy cases. The exact-preview identity, authentication and fork boundaries remain intact. Successful runtime delivery still requires all configured cases.
- The existing local launcher establishes browser/client startup readiness outside individual test deadlines, owns the server/process/port/artifacts and marks a run invalid when source edits or HMR occur during verification. Cancellation and cleanup remain bounded.
- Development and UI review guidance explains early native-component selection, total width budgets at the minimum panel width, actual painted geometry and asynchronously loaded resources. Focused checks accompany individual slices; one cumulative suite qualifies an integrated feature candidate, with evidence reused for unchanged code.
- Independent source and security review, meaningful targeted tests and one full integrated qualification close the work. No merge, release or remote issue closure is included.

## Coordination

An architect first resolves the CI and launcher interfaces. At most two writers then own disjoint CI/launcher scopes. The coordinator owns documentation and shared integration, Git, runtime ports and all checks. Reviewers are read-only. Source freezes before browser validation.

The architect selected conservative `docs` / `full` / `reuse` modes with a direct-predecessor full-run witness. A reused run does not mint another witness; this bounds the optimization to one closure push rather than recursive evidence inheritance. CI retains the named required quality gate and exact-preview/fork authentication boundaries. Documentation allowance is a shared side-effect-free path policy consumed by the launcher and CI. The CI writer also owns the narrow package smoke-script and Tailwind-exclusion edits; the coordinator owns the Playwright configuration integration and guides.

An existing coupling requires explicit treatment: Tailwind scans non-ignored project text by default, so a Markdown utility token can change CSS. Approved documentation paths are excluded with `@source not` before allowing evidence reuse. This follows the [Tailwind source-detection documentation](https://tailwindcss.com/docs/detecting-classes-in-source-files#ignoring-specific-paths). Cross-run witness retrieval uses the official [download-artifact action](https://github.com/actions/download-artifact) rather than an ad hoc archive parser. Workflow conditions follow the [GitHub Actions workflow reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).

## Verification record

The first frozen launcher-only pure run used the explicit `--project=pure` path with no local server. It completed in 14.0s: **17 passed / 5 failed**, report `test-results/verification-launcher-pure-first/report.json`. Four failures were native Windows worker exits (`3221226505`); one retained a pre-refactor cancellation-message assertion.

A two-child differential probe minimized the native failure in 1.9s. The same `fs.watch` / write / close sequence crashes with libuv's `!_wcsnicmp(filename, dir, dirlen)` assertion on the short 8.3 temporary path returned by `os.tmpdir()`, and exits successfully after canonicalizing that directory with `fs.realpath`. Owned watch roots now use canonical paths, retaining source-edit tests and symlink boundaries. Only verified probe-owned temporary directories were removed.

Independent launcher review identified and closed a post-cancellation spawn race across asynchronous preparation and a missing `PLAYWRIGHT_CHANNEL` handoff to warmup. Cancellation guards now cover both sides of asynchronous preparation. A new create/delete regression first failed, then passed after missing relevant event paths became permanent invalidations.

Two real launcher attempts then rejected unchanged old files during initial reads. A 1.2s Windows probe reproduced an access-time-only `change` notification: size, modification time and change time were identical. The monitor now ignores only known-file notifications whose mode, size, modification/change timestamps and inode match the baseline; access time is excluded. New, changed, missing and symlink paths still invalidate. The regression checks an old-access-time read followed by a real write.

The final focused launcher/CI run passed **37/37**, without skips, in 3.8s (`test-results/verification-final-pure/report.json`). Full lint, Nuxt typecheck, production build, Markdown corpus checks and actionlint passed. The production CSS excludes both temporary documentation utility sentinels while retaining an application utility; the sentinel files were removed. Typecheck/build evidence remains valid for subsequent launcher-only corrections. Independent standards and complementary security reviews closed without remaining findings, including the final metadata filter.

GitHub's run API exposes an immutable `run.head_sha` but a live nested PR head. Predecessor lookup therefore pins the former to the synchronization event's `before`, using the original full witness to validate base/head and the nested PR only for repository/number association. Unexpected identities select full qualification. CI tooling and checks retain the event merge checkout; Preview browser jobs retain the exact source head.

Real owned-launcher smoke passed **2/2** browser journeys in 20.7s after the hydrated welcome form was ready; the server and browser were cleaned up. Report: `test-results/local-test-2026-11-02T11-25-22-589Z-62024/playwright-run-1/results.json`; outer log: `test-results/verification-owned-launcher-final.log`. A separate real pure-only launcher invocation passed **9/9** in 2.3s without a server or browser. Each invocation owns distinct output and JSON report paths.

Refetched `origin` before publication: `origin/main` is unchanged at `d40e5f515baf1afeb0e2135461287b243b2a1f6c`. Exact-preview full CI and a documentation-only reuse demonstration remain pending. Execution logs and screenshots belong under `test-results` or CI artifacts. PR #36 is currently open and ready for review; its state is preserved, with no merge or source-issue closure.
