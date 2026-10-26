---
name: project-development
description: Coordinate implementation, fixes, refactoring, and review in ttrpg-cluster-control, selecting specialists and checks by the changed behavior and risk.
---

# Project development

The main chat coordinates. Follow AGENTS.md for the baseline and conditional references. Reuse unchanged instructions and profiles already read in this session; reload them when edited or unavailable in context. Delegated specialists return results without restarting this workflow.

## Route by changed behavior

| Route | Trigger | Required roles |
| --- | --- | --- |
| Trivial | Documentation, cosmetic styling, or mechanical changes without behavior or data impact | Coordinator; developer_light if delegation helps. |
| Standard | A localized behavior change with understood dependencies | Developer, then independent reviewer. |
| Complex | Unclear behavior, cross-module design, or new relationships | Architect before implementation; developer, then reviewer. |
| Sensitive | Changes to persistence, formats, migrations, destructive semantics, security, or domain invariants | Architect; developer; independent reviewer and reviewer_deep with complementary lenses. |

Use the highest applicable route. Exposing an existing guarded command through another UI entry is Standard when its mutation and guard semantics stay unchanged. Reclassify when new evidence changes risk. For review-only work, inspect the existing change without launching implementation unless requested.

## Profiles and ownership

Model and effort settings live in `.codex/config.toml` and `.codex/agents/<role>.toml`; explicit user choices take precedence. When named custom roles are unavailable, read the profile and pass its instructions and settings through the available delegation tool. Report unavailable settings rather than substituting silently.

The configured concurrency ceiling is a limit, not a target. Start at most two implementation writers with disjoint ownership, and serialize overlapping edits. The coordinator alone dispatches agents and owns shared Git operations, runtime ports, browser sessions, and integration. Reviewers and architects are read-only.

Each brief supplies acceptance criteria, relevant references, baseline/candidate, owned files, shared-resource constraints, and the expected deliverable. Resolve interfaces before parallel work. Ask an agent to freeze its source before building or reviewing it; collect a concise result rather than repeatedly requesting unchanged status.

Keep small-task briefs in the chat. For multi-session work, use the existing local specification/tickets. Record durable decisions and unresolved limits there; execution logs, screenshots and traces belong in test/CI artifacts or the PR, not new scratch journals.

## Proportionate verification

Use package.json and Playwright configuration as the command reference. Prefer maintained helpers and the existing runner over temporary browser scripts. Local layout checks use the development server; Vercel previews support human device testing.

| Change | During iteration | Completion evidence |
| --- | --- | --- |
| Documentation/instructions | Check links, referenced paths and configuration parsing | Clean diff; discovery/routing still works. |
| CSS or presentation only | Relevant `test:ui` cases or browser checks on development | Affected desktop/compact states; no build or broad suite solely for class changes. |
| Behavior | Lint, typecheck and affected test files | Relevant scenarios, failure paths and UI states pass. |
| Dependencies, tooling, integration, SSR or bundling | Appropriate focused checks | Lint, typecheck, production build and one full suite on the integrated candidate. CI may provide these results. |

Run the full suite once per logical delivery, not after every follow-up. Reuse successful evidence for unchanged code on the same candidate; after a correction, rerun affected checks and broaden only for new risk. Distinguish an initial failure from the corrected result. Existing retries remain explicit; a later pass alone does not explain a failure.

## Review and finish

Freeze the integrated candidate before review and provide the original criteria, actual diff and verification evidence. For UI changes, the reviewer reads `docs/agents/ui.md` and compares affected related surfaces and states. Tooling handles mechanical checks; reviewers assess requirements, consistency, integration and risk.

One integrated review covers both repository standards and the requested behavior. When another implementation skill requests a final code review, use this routed review as that step rather than repeating it. An explicitly requested separate or two-axis review still applies; sensitive work retains its complementary independent review.

Send confirmed findings to the owning developer, verify the correction and surrounding risk, and ask the reviewer to close the finding. After two unsuccessful correction cycles, reassess the design or identify the concrete blocker instead of repeating the same loop.

Finish when acceptance criteria, appropriate checks and blocking findings are resolved. Report unavailable checks honestly. Follow existing authorization for commits, pushes and PR updates; this workflow does not authorize merge, release or source-issue closure.
