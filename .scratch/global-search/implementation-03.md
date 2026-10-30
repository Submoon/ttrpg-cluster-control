---
title: "Global object search: implementation and verification"
status: in-progress
---

## Scope, branch and baseline

The user authorized sub-agent coordination of [Find and reveal objects across every system](tickets/03-global-object-reveal.md) on 2026-10-30, after pushing completed ticket 02. The user then explicitly required one branch for the entire feature. **codex/global-search** is the canonical branch for tickets 01, 02 and 03. It was renamed from the cumulative ticket 02 branch and pushed at `a230349258de37b480123da76a9f681d473a19f0`, preserving every predecessor commit. Historical branch names in earlier records are past provenance, not parallel feature work.

Pinned ticket 03 implementation/review baseline: **f2ca2fc5c8c8d1e211a9af4604d4f99822537e4a**. Freshly fetched `origin/main` and local `main` are **971e91c0ad2fc78e4f92c1e625091a577960b41b**. The three newer map-tool-shortcut commits were merged cleanly before implementation. The predecessor feature commits remain intact; no main fast-forward was necessary. GitHub #7 was re-read unchanged, OPEN, with enhancement / priority:P1 and no comments.

The old ticket 01 local/remote references were proven ancestors of the new pushed feature branch. Automatic approval review rejected their deletion for lack of explicit remote-deletion authorization. The canonical branch is published; optional obsolete-reference cleanup awaits the user's separately requested answer and does not block implementation. Preserve unrelated `.codex/environments/`. No PR, merge to main, release or remote issue update is authorized.

## Architecture and ownership

Complex route: a read-only architect resolves global candidate identity/disambiguation, one protected cross-map reveal, mount/restoration/selection ordering and safe failure ownership before developers edit source. At most two writers receive disjoint file ownership; the coordinator owns shared Git, runtime ports, browser sessions, preparation/static/build scheduling and integration. Architects/reviewers are read-only.

Approved seams remain the real composed editor activation command with existing session controllers, public browser journeys, and targeted pure matching/branch/framing calculations. Use one failing behavior and minimal implementation per TDD cycle. Preserve completed-slice behavior and reuse the current branch-framing implementation rather than add another renderer or data writer.

## Verification boundaries

Ticket 02's complete run was not green: 483/487, three failures subsequently passed unchanged and an old Orbit timeout also reproduced on its predecessor. The new main merge changes that Orbit test's pointer-derived expectation; do not assume the old result certifies or characterizes the new baseline. Recheck relevant current anchors without relaxing assertions/deadlines.

The final ticket explicitly requires actual software-keyboard/input evidence and forbids treating viewport emulation alone as full mobile acceptance. No mobile-specific connector or adb/emulator command was found on this Windows host. The coordinator requested the user's available real-device test path and will prepare a concise protocol alongside independent implementation work. Record browser emulation, actual input/device evidence and any remaining screen-reader/hardware limits separately. Do not mark the full mobile criterion or parent specification complete without the required evidence or an explicit revised acceptance instruction.

Freeze source for integration. Run appropriate lint/typecheck/build, maintained UI smoke and one complete suite; after corrections, reuse unchanged evidence and rerun affected checks. Keep reports, traces and screenshots in ignored test artifacts. Source-issue closure and later publication remain separate from local implementation completion.

## Check record

Architecture handoff completed before releasing either developer. The merged baseline `f2ca2fc5` passed Nuxt typecheck (`test-results/search03-merged-baseline-typecheck.log`), 45 focused pure checks (`test-results/search03-merged-baseline-pure/report.json`) and 27 browser checks covering existing search, map shortcuts/guards and the pointer-derived Orbit resize regression (`test-results/search03-merged-baseline-browser/report.json`; 137 seconds, no skips or retries). This establishes the current starting point, not completion evidence for ticket 03.

Artifact retention correction: a subsequent focused command run used Playwright's default output directory and removed the earlier `test-results` contents, including those baseline reports and the first cross-map browser attachment. The pass counts above were directly observed before that deletion; the paths are historical and no longer available. Require a unique `PLAYWRIGHT_OUTPUT_DIR` as well as a unique JSON report path for every subsequent run, and retain fresh integrated-candidate evidence. Do not describe missing historical files as reviewable artifacts.

Both developers were released after these checks: one owns the pure global model, search presentation and public browser journeys; the other owns composed navigation, context cleanup ownership and command scenarios. All product behavior and test seams were approved earlier; the resource question concerns collection of actual mobile evidence, not reopening the search contract.

The first global matching tracer failed before extending enumeration and passed afterward. The composed command tracer failed with the predecessor's explicit active-system `stale` rejection, then passed after removing that restriction and the caller's scope filter. A first public run reached the exact remote map/selection and focus but failed an invalid test precondition: the imported desktop Inspector was already open. Closing it through its public toggle before activation correctly tests the specified no-auto-open behavior; existing desktop panels are otherwise retained.

At the first frozen cross-map/visit checkpoint, two public journeys passed (exact Harrow Arrival destination, and unopened Iria–Orbit–Nix branch) in `test-results/search03-crossmap-branch-checkpoint/report.json`; Nuxt typecheck passed in `test-results/search03-checkpoint-typecheck.log`. The coordinator inspected `global-search-branch-reveal-desktop.png`: target/child labels and the hosted ring were visible at a useful scale; excluded parent content may remain cropped. These checks precede the complete Add-context lease, layout settlement and final integration. The focused failed-reveal visit-preservation tracer also passed in `test-results/search03-navigation-visit-lease-green/report.json`.

The [actual mobile input protocol](mobile-validation.md) is prepared; its execution remains pending.

At the frozen Add-context checkpoint, Nuxt typecheck passed (`test-results/search03-add-lease-typecheck.log`). Four global public journeys passed in `test-results/search03-global-public-first/report.json`, including system-A-to-system-B key activation overriding the remembered destination and two identical independent imports reaching distinct IDs. The fifth reached the correct late object by touch but failed a test-only label parser that retained the `Location key:` prefix; after trimming before prefix removal and using a literal accessible-label comparison, that focused case passed in `test-results/search03-500-public-green/report.json` (16.2 seconds). It exercised all 500 matches across 20 systems, keyboard reachability/shortcut ownership, compact rotation, touch activation and query reuse. Desktop branch containment is measured against actual map and obstruction rectangles. Compact screenshots were inspected, with stronger explicit selected-paint containment requested before final acceptance; presentation-settlement work remains outstanding. These are checkpoint results, not the final integrated suite.
