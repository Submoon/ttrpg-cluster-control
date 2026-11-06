---
title: Reliable, focused Playwright tests and shared testing guidance
status: open
triage_labels:
  - enhancement
  - ready-for-agent
---

# Reliable, focused Playwright tests and shared testing guidance

The original scope below was delivered through tickets 01–09; ticket 10 delivered its retrospective. The [approved follow-up](#approved-follow-up-behavior-first-pruning-and-shorter-feedback) adds new requirements and tickets without reopening those completed deliveries. Its implementation is pending.

## Problem Statement

Contributors cannot consistently distinguish a product regression from slow preparation, fragile targeting, or an ineffective assertion. The suite provides valuable protection, but some browser scenarios repeat existing coverage, combine independently failing behaviors, or depend on presentation details unrelated to their purpose. Several tests can pass without exercising the behavior named in their title.

Humans and coding agents need one discoverable testing policy that explains which behaviors belong in the browser, how to target controls, how to prepare isolated state, and what evidence establishes a reliable correction. That policy must be applied to the existing suite rather than left as advice for future tests.

### Request and baseline

- Source: the user's audit request and subsequent requests to investigate duplication, improve HTML targeting, document the policy for humans and agents, and correct the findings. No GitHub source issue was supplied. This specification is published to the repository's configured local tracker.
- Original audit revision: `8d4b66504ca6723db5405ed7cb93d0a666264c9a`. Inventory: 432 cases in 77 files, including 173 pure cases, 258 browser cases, and one development-storage case.
- Planning baseline: `971e91c0ad2fc78e4f92c1e625091a577960b41b`, fetched from origin on 2026-10-30. Local main was safely fast-forwarded, and the specification branch `codex/playwright-test-quality` starts at this revision. There is no intentional alternate base. Existing unrelated local environment configuration was preserved.
- Discovery on the planning baseline reports 450 cases in 79 files. New map-tool shortcut regressions are included in the implementation inventory; original execution results below are historical evidence, not validation of the newer revision.
- On 2026-10-30, the user explicitly approved three existing test boundaries: domain functions for rules and validation; real controllers for transitions and deferred saving; browser tests for gestures, focus, rendering, IndexedDB behavior, and a small set of complete journeys.
- This phase authorizes the local specification only. The document describes future implementation and its completion criteria; it does not claim that corrections or permanent guidance have been delivered.

## Solution

Retain Playwright as the maintained runner and give each test a clear behavioral responsibility. Correct ineffective assertions, investigate the observed timing failure, and reduce redundant browser execution while preserving meaningful integration coverage. Use stable, intentional locator contracts and reusable isolated preparation.

Extend the existing verification guidance into the shared policy for contributors and agents. Reach it from contributor documentation and conditional agent instructions, keeping each rule in one authoritative place. Link framework recommendations to official Playwright documentation and clearly identify repository-specific choices.

The result should let a contributor answer: what regression does this test catch, why does it need this test boundary, what state does it own, and what evidence will an unexpected failure retain?

## User Stories

1. As a contributor, I want one testing reference, so that human and agent changes follow the same rules.
2. As a contributor, I want to find that reference from the development documentation, so that test maintenance does not require knowledge of agent-specific entry points.
3. As a coding agent, I want conditional instructions to reach the same reference when writing or reviewing tests, so that the policy is applied consistently.
4. As a reviewer, I want official Playwright recommendations distinguished from local conventions, so that I can assess exceptions accurately.
5. As a contributor, I want a test-boundary decision guide, so that deterministic rules do not require full browser journeys.
6. As a Warden, I want retained browser journeys to protect real editing, saving, and recovery workflows, so that reducing the suite does not remove product protection.
7. As a reviewer, I want browser coverage inventoried by behavioral obligation, so that duplicates can be identified beyond similar names or code.
8. As a reviewer, I want every removed or migrated assertion mapped to retained coverage or an explicit obsolete requirement, so that cleanup is auditable.
9. As a contributor, I want long journeys reduced to their integration purpose, so that one early failure does not conceal unrelated regressions.
10. As a contributor, I want smoke selection to reuse canonical scenarios, so that a smoke suite does not duplicate the same behavior.
11. As a contributor, I want stable roles and associated labels for ordinary controls, so that tests follow meaningful interactions.
12. As a contributor, I want stable test identifiers where wording or markup is incidental, so that presentation changes do not break unrelated workflows.
13. As a Warden using assistive technology, I want accessible names to remain meaningful, so that test targeting does not distort the interface.
14. As a contributor, I want map entities located by their identity when identity matters, so that renaming an object does not invalidate its locator.
15. As a reviewer, I want semantic and accessibility assertions retained where they are the contract, so that technical identifiers do not hide regressions.
16. As a contributor, I want explicit, isolated fixture preconditions, so that test order and previous runs do not influence results.
17. As a contributor, I want reusable preparation for scenarios that do not test creation or import, so that setup work is not repeatedly exercised through the UI.
18. As a contributor, I want shared fault-injection helpers with reliable cleanup, so that save-failure tests remain consistent and independent.
19. As a reviewer, I want tests to establish the interaction mode and pending gesture they claim to exercise, so that a passing result demonstrates the intended transition.
20. As a reviewer, I want recovery tests to distinguish current and backup records, so that unintended replacement is observable.
21. As a reviewer, I want callback observations asserted outside exception-swallowing production boundaries, so that failed assertions fail the test.
22. As a reviewer, I want camera changes compared with the immediate pre-action state, so that an earlier action cannot satisfy the assertion.
23. As a contributor, I want geometric expectations derived from delivered input where appropriate, so that pixel rounding does not create false failures.
24. As a contributor, I want cold preparation measured separately from scenario work, so that the reported failure identifies the actual bottleneck.
25. As a contributor, I want failure traces available on the first unsuccessful run, so that diagnosis does not depend on retries.
26. As a contributor, I want pure tests to run without an application server or preview credentials, so that their feedback remains independent and inexpensive.
27. As a reviewer, I want targeted repeat and cold-start evidence, so that one successful rerun is not presented as proof of stability.
28. As a contributor, I want lifecycle tests to mount and dispose their actual owners, so that listener and watcher cleanup claims are exercised.
29. As a reviewer, I want test-count and execution-cost changes reported alongside preserved coverage, so that fewer files or more workers are not mistaken for reduced duplication.
30. As a maintainer, I want enforceable mechanical rules checked by existing tooling where appropriate, so that the written policy remains effective over time.

## Implementation Decisions

### Shared guidance and ownership

- Reuse the existing verification reference as the source of truth. Keep contributor entry points and agent navigation concise, and reconcile their current command/runtime descriptions with the implemented configuration. Write project documentation in English.
- Document test-boundary selection, fixture ownership, locator choices, assertions, timing, geometry, failure diagnosis, and review criteria. Include focused examples and official references without duplicating command/configuration inventories across documents.
- Keep the effort's inventory, disposition decisions, and before/after measurements with implementation planning or reports. Execution logs, screenshots, and traces remain artifacts, not permanent policy text.
- Use the repository's development and review workflow. Domain rules, controller session ownership, Pinia boundaries, and the sole ordered workspace writer remain authoritative. Instrumentation may observe or control a dependency; it must not replace the behavior whose correctness is being asserted.

### Coverage reduction

- Inventory every browser scenario on the implementation baseline, including parameterized variants and newly integrated shortcut tests. Record its distinct browser-dependent obligation, preconditions, overlap, and disposition: retain, narrow, merge, migrate, or retire. A family-level explanation may cover cases sharing a rationale, but every case must have a disposition.
- For each removal or migration, identify the retained test or replacement boundary for its meaningful assertions. Distinct input mechanisms, failure paths, responsive states, and integration wiring are reasons to retain coverage, even when setup looks similar.
- Consolidate repeated behavior rather than merely moving assertions into fewer giant tests. A smaller test count produced by concatenating journeys is not a successful reduction.
- Prioritize the overlapping creation/reload journeys, desktop panel independence checks, simple deletion confirmation/cancellation, campaign import/export checks, and detailed import-remapping assertions. Evaluate the old variant URLs as compatibility requirements; retain their distinct obligation with minimal scenarios rather than repeating persistence end to end for each URL.
- Keep one canonical smoke-capable scenario per shared UI obligation and select it by the existing tagging approach. Preserve separate tests for meaningful variants such as compact focus ownership or portaled hit targets.
- Migrate deterministic permutations to existing domain/controller boundaries while retaining representative browser wiring checks and genuine IndexedDB cases. Similar assertions at two boundaries are justified only when they protect different failure modes.

### HTML targeting and assertions

- Prefer scoped role/name and associated-label locators for ordinary interaction. Improve missing semantics when they benefit users. Use stable `data-testid` contracts where incidental wording, wrappers, or presentation would otherwise control test identity. This follows Playwright's distinction between user-facing locators and explicit test contracts. [Locator guidance](https://playwright.dev/docs/locators)
- Give identifiers semantic purposes, keep them stable across layouts, and ensure uniqueness within the intended active scope. Scope helpers explicitly when desktop and compact representations coexist. Reuse existing domain identity attributes for map entities; obtain generated identities through legitimate fixture or observable-result data.
- Replace the identified structural counter indexing, map-context child selector, concatenated Apply-button name dependency, and parsing of formatted accessible names to infer creation targets. Helpers should receive explicit identity/placement preconditions instead of reconstructing them from display prose.
- Preserve assertions about accessible name, role, keyboard operation, and visible text when those are the behavior under test. Native semantics remain preferred; ARIA expresses user meaning and is not a technical identifier namespace.
- Keep structural measurements when structure or geometry is the actual contract. Avoid a blanket ban on CSS, positional iteration, or all repeated setup; require a concrete reason for each exception that matters to reliability.

### Fixtures, state, and synchronization

- Reuse fresh per-test contexts and the existing cloned IndexedDB snapshot pattern for stable setup. Shared preparation must be immutable, compatible with the project origin, and free of live page/context sharing. Dedicated creation, import, hydration, and recovery journeys retain the relevant public path. Playwright fixtures support isolation and owned setup/teardown. [Fixture guidance](https://playwright.dev/docs/test-fixtures)
- Consolidate genuinely identical setup and fault-injection responsibilities, including one-shot workspace-write aborts and export observation. A helper owns the resources and probes it installs and restores them after failure as well as success.
- Use real controller actions and observable state transitions. Mount lifecycle-owning composables for tests that claim mount/unmount behavior; plain reactive scopes remain suitable where only non-lifecycle behavior is claimed. Account for the lifecycle warnings observed in the audit without treating them as proof of a production leak or suppressing them indiscriminately.
- Use awaited, retrying assertions for eventual UI state and explicit controllable dependencies for async ordering. Timed waits are allowed only when elapsed time itself is the scenario's subject, with the threshold and observation explained. Actionability bypasses require a scenario-specific justification. [Playwright best practices](https://playwright.dev/docs/best-practices)
- Keep expected geometry independent from the post-action result. Derive it from the pre-gesture transform and delivered input, preserve exact domain/persistence equality, and express rendering tolerance in CSS pixels. Preserve the upstream horizontal Orbit resize correction.

### Runtime and diagnosis

- Investigate the historical 30-second timeout before choosing a fix. Measure server readiness, browser/client readiness, fixture preparation, and the scenario separately. HTTP readiness alone does not establish that the first client interaction is ready.
- Keep all preparation bounded and observable. A measured slow fixture may have a dedicated timeout; a scenario may have a justified explicit budget. Increasing global timeouts or adding retries alone does not satisfy the reliability goal. Playwright normally counts test fixture setup and hooks in the test budget, and supports separate fixture budgets. [Timeout guidance](https://playwright.dev/docs/test-timeouts), [fixture timeout](https://playwright.dev/docs/test-fixtures#fixture-timeout)
- Enable automatic browser failure artifacts on the initial attempt, including retained traces and a failure screenshot when a live page is available. Retain zero automatic retries for the existing quality gate. `retain-on-failure` records the initial attempt and keeps its trace on failure; a retry-only trace mode would not serve that policy. [Trace options](https://playwright.dev/docs/api/class-testoptions#test-options-trace)
- Preserve separate artifacts per run/shard and actionable owned-server logs. Diagnostic output must not expose preview credentials. Pure tests do not acquire preview authentication or launch browsers.
- Provide a supported pure-only selection that starts no Nuxt server and needs no fake base URL. Preserve complete local runs, development-storage coverage, explicit external base URLs, immutable exact-commit Preview selection, and scoped Preview authentication.
- Use existing lint/check infrastructure for clearly mechanical mistakes when enforcement is useful and precise. Deduplication, seam choice, and assertion strength remain review judgments. Adding another test runner is not required.

## Testing Decisions

### Approved test boundaries

| Boundary | Responsibility | Existing approach to preserve |
| --- | --- | --- |
| Domain functions | Validation, geometry, placement invariants, import/export transformations and identity relationships. | Deterministic inputs and exact observable results. |
| Real controllers and stores | Draft guards, cancellation, stale-context handling, mutation verdicts, history, and save ordering with controlled dependencies. | Deferred durability/consent, controlled clocks, real actions, and mounted owners for lifecycle claims. |
| Browser and browser storage | Native gestures, focus, keyboard ownership, responsive layout, hit testing, downloads, IndexedDB integration, and representative complete editor journeys. | Public actions, isolated contexts, cloned prepared state where appropriate, and measured native input. |

Test the externally observable contract of each boundary at the narrowest existing boundary sufficient to reproduce its failure mode. Preserve a higher integration check when composition itself is the risk. The user-approved allocation above governs this effort; the generic preference for a single high-level boundary does not move deterministic permutations back into full browser journeys.

### Finding register and required outcomes

| ID | Evidence status | Finding and required outcome |
| --- | --- | --- |
| F1 | Confirmed static coverage defect; still present on planning baseline. | The mode-change long-press scenario starts and remains in Select, where the claimed inspection timer is not armed. Establish Navigate/Move, a qualifying held entity press, and an actual mode change; check cancellation and the eventual release outcome. Preserve a positive companion case proving the gesture can activate. |
| F2 | Confirmed static coverage defect; still present. | The all-modes palette journey resets to Select after object creation and does not restore the requested mode for the Orbit half. Establish and assert the intended mode independently before each claimed Object/Orbit variant. |
| F3 | Confirmed static coverage defect; still present. | Damaged current and backup records are identical. Use distinguishable invalid sentinels and assert preservation of both records after rejected restoration. |
| F4 | Confirmed static coverage defect; still present. | An assertion inside the best-effort applied observer can be swallowed. Capture what the observer sees and assert outside the swallowed callback, preserving the separate deliberate-observer-error case and durable acknowledgement checks. |
| F5 | Confirmed static coverage defect; still present. | The Pan-right check compares against a camera captured before an intervening Fit. Capture immediately before the action and verify the intended displacement. Review the related pre-button wheel baseline and hardcoded identity camera comparisons for the same weakness. |
| F6 | Observed failure followed by success on the original audit revision; cause not isolated. | The Move-with-unresolved-metadata scenario timed out during setup after a slow first field interaction. Diagnose and correct the preparation/budget relationship, then collect the cold and warm evidence below. Recheck on the newer baseline before attributing a current defect. |
| F7 | Confirmed configuration/documentation mismatch; still present. | Selecting only pure tests can still start the global application server unless an external base URL suppresses it. Make the supported pure-only command independent of that server and align guidance. |
| F8 | Confirmed diagnostic gap; still present. | Default browser runs do not automatically retain a trace or screenshot on failure. Verify first-attempt diagnostics with retries disabled. |
| F9 | Corrected upstream during planning. | The exact horizontal radius expectation was replaced with delivered-input geometry in commit `1f355bfa3bd055fc049540dd78b65666f7f09247`. Preserve and reuse that approach; no duplicate correction is required. Its new implementation was inspected, not rerun in this specification phase. |
| F10 | Maintenance/coverage improvements, not proven application defects. | Review long multi-purpose journeys, redundant scenarios/setup, unmounted lifecycle claims, and the coordinator no-op test that claims Redo preservation without first establishing a Redo branch. Correct the precondition or narrow the title while preserving existing browser coverage. |

### Completion criteria

1. The shared English policy is reachable by both contributors and agents, links official sources, and agrees with supported local/CI execution. It describes how to choose a boundary and how to review exceptions.
2. Every browser case on the implementation baseline has a coverage disposition. Every removed/migrated meaningful assertion has a retained owner or a justified obsolete requirement. The identified overlaps produce an actual reduction in redundant browser execution; helper extraction or sharding alone does not count.
3. F1-F5 are corrected and demonstrate sensitivity to the specified regression. Use a controlled negative case or temporary local fault injection where necessary, record the observed failure, restore the candidate, and retain only appropriate regression tests. No production fault is committed.
4. F6 has a documented disposition on the implementation baseline, with preparation and scenario timing separated. The affected scenario passes ten consecutive warm executions and the first execution after three independent owned-server starts, with fresh browser contexts and retries disabled. Record whether each server start used existing generated/dependency caches; this is not a claim about a fresh dependency installation or a statistical flake-rate guarantee.
5. F7 passes without an application server, browser launch, preview secret, or artificial base-URL override. Complete local and browser/storage selections continue to include their intended coverage; test discovery confirms cases are not silently omitted or duplicated across projects.
6. F8 is demonstrated through a controlled failing browser run that retains an inspectable trace and failure context without retries. Normal focused runs still clean up owned servers, contexts, listeners, and failpoints. Authentication failures remain actionable and redacted.
7. The identified fragile selectors are replaced with scoped semantic, test-identity, or domain-identity contracts. The affected desktop/compact journeys still verify accessibility and visible behavior where required, including cases where a name or mode changes after selection.
8. F9 remains intact. Every F10 improvement receives an explicit retain/change/migrate decision; lifecycle-sensitive checks run with the lifecycle they claim. Broad warning suppression is not accepted as resolution.
9. Perform focused checks during implementation and freeze source before integrated verification. Run lint, typecheck, the production build for runner/configuration or integration changes, and one complete integrated suite. CI may supply appropriate immutable-preview evidence. Subsequent runs target corrections unless their scope justifies broader verification.
10. Publish a concise result record with candidate revision, commands, runtime conditions, failures and reruns, artifact locations, counts by project, migrated/removed cases, and remaining limitations. Compare equivalent baseline/candidate scopes and environments for performance claims; label unmatched timings as observations. Finish with the repository's independent review of behavior and standards.

## Out of Scope

- New editor features, changed domain rules, changed save formats, or a replacement persistence architecture. A product defect revealed by the stronger tests must be reported and scoped explicitly.
- A second test runner, wholesale testing-framework replacement, or an arbitrary target number of browser tests.
- Blanket replacement of roles/labels with test IDs, blanket removal of responsive/gesture variants, or duplicated permanent policies for humans and agents.
- Achieving green results through skips, swallowed failures, relaxed domain equality, indiscriminate tolerance increases, or retry-only mitigation.
- A broad cross-browser/device certification or a complete accessibility audit. Viewport emulation and semantic locators do not certify physical input devices or screen-reader behavior.
- Publishing GitHub issues, creating implementation tickets, implementing fixes, commits, pushes, or PR actions as part of this specification step.

## Further Notes

### Evidence collected before specification

- On the original audit revision, all 173 pure cases passed in approximately 1.8 minutes. The pure-only run used an explicit base URL to suppress the configured server; that workaround is evidence for F7, not the desired interface.
- Nine browser scenarios were run twice with one worker and retained failure traces: 17 executions passed and one failed. The failing Move-with-unresolved-metadata execution reached the 30-second test limit during catalogue-object preparation; the same scenario passed in 14.1 seconds on its second execution without a source change.
- Trace inspection located about 23.3 seconds in the first Jump Cluster field interaction. The placement helper was where the timeout surfaced, not an established root cause. Earlier loopback access denial came from the execution sandbox and is separate from this application-test result.
- The [successful CI run for the last PR head integrated before the original audit](https://github.com/Submoon/ttrpg-cluster-control/actions/runs/40860407047) ran 258 browser cases in two shards, approximately 8.5 and 6.1 minutes, without configured retries. It demonstrates one successful execution, not longitudinal stability or validation of the later planning baseline.
- The original pure runs emitted Vue lifecycle warnings in some controller harnesses. Their presence motivates accurate lifecycle scope; it does not establish a production resource leak.
- Original local JSON reports and the failed browser trace remain execution artifacts from this chat. Implementation must record its own evidence and must not depend on those local artifacts being present in a fresh checkout.

### Documentation references

Official Playwright pages were consulted on 2026-10-30. The implementation must check API compatibility with the repository's installed version and preserve the existing CI browser/package version agreement.

- [Best practices](https://playwright.dev/docs/best-practices): behavioral tests, isolation, and awaited assertions.
- [Locators](https://playwright.dev/docs/locators): roles, labels, scoping, and explicit test contracts.
- [Fixtures](https://playwright.dev/docs/test-fixtures): setup, teardown, ownership, and fixture timeout behavior.
- [Timeouts](https://playwright.dev/docs/test-timeouts): attribution of setup and scenario time.
- [Trace configuration](https://playwright.dev/docs/api/class-testoptions#test-options-trace) and [Trace Viewer](https://playwright.dev/docs/trace-viewer): retained diagnostic evidence.

### Readiness

The three test boundaries are user-approved. The scope, confirmed findings, unresolved diagnostic work, and completion evidence are specified; the effort is ready for local ticket planning. `open` is the lifecycle state and `ready-for-agent` is the separate triage state. No implementation is claimed by this document.

### Requested retrospective follow-up

On 2026-10-30, the user additionally requested [Review recent repository sessions and prioritize testing improvements](tickets/10-retrospective-test-session-problems.md). That ticket invokes `$retro` across recent repository sessions and produces an evidence-based improvement plan. It is a separate analysis follow-up and does not extend the original completion criteria or block ticket 09.

## Approved follow-up: behavior-first pruning and shorter feedback

### Request, baseline and scope

On 2026-11-04, after the original delivery, the user requested that permanent coverage protect necessary behavior, aesthetic checks be temporary implementation aids, and low-value tests be removable without replacement. The user proposed three increasingly selective sub-agent passes, with Astra at High reasoning for the last pass, and requested corresponding documentation and implementation tickets for the retrospective's recommendations.

The actual planning HEAD is `155be7c96fdef07ff1124cdcbd4d0fd47eb44f1d`. Origin was fetched on 2026-11-04: `origin/main` and local `main` both equal `47c0418a835da285e9edb88e8f8dffc19c3a2bba`; this branch contains all of main and nine additional commits. The intentional implementation base is the delivered quality branch, not main alone. Its latest integrated result is [ticket 09's 583-case qualification](implementation-09-results.md), including 315 browser cases. Refresh/reconcile the baseline and discovery at execution time; its historical timings do not establish the next candidate's performance.

This follow-up implements R1–R4 from the [retrospective](retrospective-test-sessions.md). The original completion criteria and closed tickets remain historical delivered scope. The following requirements govern the new work; the original specification-phase restriction on creating tickets does not prevent this expressly requested follow-up planning.

### Required behavior and documentation

- Retain tests for identifiable user or verification failures at the narrowest existing boundary that reproduces the risk. Each retained scenario or permutation must justify its distinct value and proportionate cost. Necessary composition, native input, accessibility, focus, hit testing, clipping, durability, recovery and cartographic geometry remain eligible for permanent coverage.
- Use purely aesthetic checks as temporary implementation aids unless an explicit lasting product requirement justifies them. Retire incidental styling assertions and unnecessary tests without replacement; migrate useful deterministic behavior only when another boundary is actually needed. An existing test or past failure alone does not justify retention.
- Perform three sequential passes with fresh sub-agents and increasingly demanding retention criteria. The last pass is an independent, read-only Astra (`gpt-6-astra`) review at `high` reasoning; the coordinator assigns accepted corrections to the implementation owner and obtains closure. Report unavailable model settings rather than substituting silently. Use the repository's ordinary profiles for the first two passes.
- Protect owned artifacts and existing qualification/privacy guards, shorten ordinary focused feedback, and requalify the existing live local session only between completed verification epochs. An active run remains permanently invalid after a relevant input/HMR change, including a transient edit restored before completion.
- Update the shared English testing guide for contributors and agents, the coverage/disposition inventory after each pass, and helper/fixture contracts when their behavior changes. Verify existing contributor/agent entry points reach the same guide. Retain one authoritative permanent policy; the retrospective supplies the rationale and the implementation report supplies outcomes.

### Tickets and blocking edges

| Ticket | Retrospective coverage | Blocking dependencies |
| --- | --- | --- |
| [11: Remove clear low-value tests and establish the permanent coverage policy](tickets/11-remove-low-value-tests-and-document-policy.md) | R1, pass 1; permanent versus temporary policy and first documented reductions | Completed 09 and 10 |
| [12: Minimize retained behavior journeys and permutations](tickets/12-minimize-behavior-journeys-and-permutations.md) | R1, pass 2; challenge pass-1 survivors and choose cheaper existing boundaries | 11 |
| [13: Protect retained test evidence across supported execution paths](tickets/13-protect-test-evidence-ownership.md) | R2; demonstrate and close uncovered evidence-ownership hazards | Completed 09 and 10 |
| [14: Shorten focused feedback with safe idle requalification](tickets/14-shorten-feedback-with-idle-requalification.md) | R3; focused selections, owned epoch replacement and equivalent-condition measurement | 13 |
| [15: Complete Astra High pruning and test-oracle review](tickets/15-astra-high-final-pruning-and-oracle-review.md) | R1, pass 3, and R4; independent retention/oracle review plus cumulative qualification | 12 and 14 |

The reduction passes are 11 → 12 → 15; tooling is 13 → 14 → 15. Tickets 11 and 13 are the initial frontier. Application-coverage writers in 11/12 and tooling writers in 13/14 have disjoint source ownership; the coordinator serializes shared guidance/inventory edits and owns all Git/runtime resources. Tooling cases reserved to 13/14 are assessed in pass 3. This ordering makes the last pass inspect the complete candidate, including newly added tooling coverage.

The [11/13 delivery record](implementation-11-13-results.md) records the first pass and output-protection implementation, focused checks, native counter-controls and review evidence. Tickets 12 and 14 begin on 2026-11-05 at `7f5ed98575e4158b965284f0375a627f2947adc7`, deliberately using the quality branch. Fetched `origin/main` and local `main` both point to `47c0418a835da285e9edb88e8f8dffc19c3a2bba`, which is 11 commits behind this implementation base. Baseline discovery has 586 cases, including 313 browser cases. The user asked for a substantially stronger second pruning pass after the first removed two browser cases. Start from representative browser owners and keep a separate journey only for a distinct meaningful failure. Ticket 15 remains the cumulative qualification after both tickets close.

The [12/14 delivery record](implementation-12-14-results.md) closes the second pruning pass and idle requalification. Discovery now selects 542 cases across 93 files. It includes 272 browser cases, 269 pure cases and one development-storage case. The [pass 2 ledger](coverage-inventory.md#ticket-12-pass-2-disposition) identifies the retained owners and retired variants. Ticket 15 can now review the integrated suite, including the new launcher guards.

For future changes, the user specified a small browser budget. Reuse an existing owner where it catches the regression. Cover an important new browser contract with one representative happy path when appropriate and at most two distinct important failure or edge cases. Keep deterministic combinations in domain or controller tests. The [per-change browser policy](../../docs/agents/testing.md#browser-coverage-for-a-feature-or-fix) is the maintained contributor reference.

The user also set a maximum of 100 browser-backed cases after reviewing the intermediate ticket 15 reduction. This includes development-storage and leaves pure checks outside the browser budget. The [ticket 15 delivery record](implementation-15-results.md) closes the final pass with 97 browser cases, one development-storage case and 232 pure cases. It records Astra High's closure, the first Chromium failure and the successful focused run after retiring a redundant wheel variant.

### Follow-up completion criteria

1. The shared guide states the permanent-behavior/temporary-aesthetics policy and deletion criteria; contributor and agent navigation, helper contracts, implemented tests and inventory agree.
2. All three passes have distinct handoffs. The final inventory accounts for discovered cases and named decisions to keep, narrow, move or delete. Retired unnecessary or aesthetic obligations can be deleted outright. Removed meaningful obligations have a tested retained owner. Apply the user-approved maximum to browser-backed cases.
3. The retained suite protects meaningful user/verification failures with effective assertions and representative native composition. The Astra/High pass challenges earlier retention decisions and cumulative removals; important uncertain rewritten oracles receive a bounded sensitivity check, rather than blanket mutation testing or another exhaustive audit.
4. Supported focused/pure/CI paths preserve retained evidence, reject demonstrably invalid or empty analysis selections, and keep authentication/artifact sanitation fail-closed. Changes reuse existing runners and guards and address demonstrated gaps.
5. Idle requalification is bounded and isolated from completed/active epochs. Verify unchanged repetition, successful idle edit/rerun, edits during active execution or preparation, transient edits, stale callbacks, cancellation, cleanup and configuration changes requiring a fresh session. Report matched focused-loop costs without promising an unmeasured speed gain.
6. Run affected checks during implementation and one cumulative integrated qualification on frozen source after the final corrections. Reuse valid unchanged evidence. Publish commands, source/runtime identity, failures/reruns, before/after counts, eliminated preparation/downloads, equivalent-condition timings, necessary retained risks and independent review closure. Purely cosmetic deletions, skipped tests, retries or altered clock accounting alone do not establish a runtime improvement.

New product features, domain/save-format changes, runner replacement, broad device certification and remote publication remain outside this follow-up. Planning these tickets does not launch their implementation.
