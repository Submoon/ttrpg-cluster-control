---
title: Improve editor verification after the positioning retrospective
status: in-progress
---

# Improve editor verification after the positioning retrospective

The user authorized applying the retrospective recommendations on a new branch and PR. Changes are restricted to this repository; shared skills under the user's agents directory remain untouched.

## Baseline and scope

- Fetched origin on 2026-10-28. Actual baseline: `e145a48c1a1237174dc5eb894a1f1263dd74c01d`, the current origin/main after the positioning PR merge.
- New branch: `codex/retro-editor-verification`, created from that exact revision. The previous feature branch and unrelated environment files are preserved.
- Local main remains at `9edfa66c4f505d56f106fc4af8245f200abfba78` in another checkout. This task uses the refreshed origin/main directly and leaves other worktrees unchanged.
- Add early visual evidence and explicit placement invariants to repository guidance, a concise verification record and runtime scheduling rule, and bounded specialist handoffs to the repository-owned project-development skill.
- Extract reusable native-input measurement and SVG/screen plumbing into existing test helpers while retaining scenario-specific mathematical and preservation assertions.
- Product behavior, persistence, dependencies and CI gates remain unchanged.

## Ownership and verification

The coordinator owns repository guidance, this record, Git and runtime. The scoped test-helper developer owns the assigned helper and test files; independent review covers the integrated change. Shared skills are read-only references.

Validate documentation links, final lint/typecheck and affected public journeys for the shared helper, including input accuracy and resource cleanup. Reuse the existing runner and CI; the PR triggers integrated checks.

## Resolution

Pending implementation and verification.

## Implemented changes

- Repository UI guidance defines visual placement criteria and invariants before implementation, then requires inspecting a readable first-slice detail capture before broad verification.
- Verification guidance records candidate-specific evidence and keeps Nuxt generation checks outside browser runs. It points to existing placement-preservation and compatibility regressions.
- The repository-owned project-development skill pins comparison revisions, uses bounded fresh specialist context and resumes completed specialists through an execution-triggering follow-up.
- `snapshotSvgCoordinates` captures forward/inverse SVG matrices before a gesture. `measureMouseDrag` rounds intended CSS points, returns observed window-capture down/up events and owns mouse/observer cleanup. Unexpected cleanup errors fail the check; combined failures retain their diagnostics.
- Existing Orbit/map-point helpers and the elliptical resize journey use the primitives. Scenario-specific radius, accuracy, ratio, occupant-angle and interchange assertions remain. A real invalid-destination failure followed by pointer movement and a successful drag checks release recovery and probe reuse.

## Check record

Candidate: frozen working tree based on `e145a48c1a1237174dc5eb894a1f1263dd74c01d`; product source is unchanged.

| Check | Result | Evidence |
| --- | --- | --- |
| Guidance relative links and whitespace | Passed | All changed guidance targets resolve; `git diff --check` |
| Independent review | Passed, zero findings | Reviewed the integrated guidance, helper extraction, callers and failure cleanup |
| Lint | Passed | `npm run lint` |
| Typecheck | Passed | `npm run typecheck` |
| Affected public browser journeys | Pending CI | Local Nuxt reported ready on port 3127, but HTTP preflight timed out after bounded startup retries; no browser result is claimed |

The coordinator stopped the owned local runtime and publishes a draft PR so the existing immutable-preview CI can supply browser evidence. The affected scenarios are the Orbit ring and ellipse journeys plus the Cluster navigation and expanded System-map consumers of the same helper. Draft readiness remains pending CI; the local runtime failure did not justify changing product code or user settings.
