---
name: project-development
description: Coordinate implementation, fixes, refactoring, and review in ttrpg-cluster-control, selecting specialists and checks by the changed behavior and risk.
---

# Project development

The main chat coordinates. Follow AGENTS.md for the baseline and conditional references. Reuse unchanged instructions and profiles already read; reload them when edited or unavailable in context. Delegated specialists return results without restarting this workflow.

## Route by changed behavior

| Route | Trigger | Required roles |
| --- | --- | --- |
| Trivial | Documentation, cosmetic styling, or mechanical changes without behavior or data impact | Coordinator; developer_light if delegation helps. |
| Standard | A localized behavior change with understood dependencies | Developer, then independent reviewer. |
| Complex | Unclear behavior, cross-module design, or new relationships | Architect before implementation; developer, then reviewer. |
| Sensitive | Changes to persistence, formats, migrations, destructive semantics, security, or domain invariants | Architect; developer; independent reviewer and reviewer_deep with complementary lenses. |

Use the highest applicable route and reclassify when new evidence changes risk. Exposing an existing guarded command is Standard when its mutation and guard semantics stay unchanged. For review-only work, inspect the requested scope without implementation unless authorized.

## References

Read [source conventions](../../../docs/agents/conventions.md) for implementation or review, [editor architecture](../../../docs/architecture/editor.md) for state, commands, saving or map integration, and [UI guidance](../../../docs/agents/ui.md) for editor presentation changes. Use [verification guidance](../../../docs/agents/testing.md) to select checks. Keep technical rules in those references rather than duplicating them here.

## Profiles and ownership

Model and effort settings live in `.codex/config.toml` and `.codex/agents/<role>.toml`; explicit user choices take precedence. When custom roles are unavailable, read their profiles and pass their instructions and settings through delegation. Report unavailable settings rather than silently substituting.

Start at most two implementation writers with disjoint ownership; serialize overlapping edits. The coordinator alone dispatches agents and owns shared Git operations, runtime ports, browser sessions and integration. Architects and reviewers are read-only. Each brief identifies acceptance criteria, relevant references, baseline, owned files, shared-resource constraints and expected deliverables. Resolve shared interfaces before parallel editing and freeze source before integrated checks or review.

Keep small-task briefs in the chat. For multi-session work, use the existing local specification or tickets. Record durable decisions and unresolved limits there; execution logs, screenshots and traces belong in test/CI artifacts or the PR. Collect concise results rather than repeatedly requesting unchanged status.

## Review and finish

Provide the integrated candidate, original criteria, actual diff and verification evidence. One routed review covers repository standards and requested behavior, including another implementation skill's final review step. An explicitly requested separate or two-axis review still applies; Sensitive work keeps its complementary independent review.

Send confirmed findings to the owning developer, verify the correction and surrounding risk, and obtain reviewer closure. After two unsuccessful correction cycles, reassess the design or identify the concrete blocker instead of repeating the loop. Reuse successful evidence for unchanged code; follow verification guidance for affected retests and broad integration checks.

Finish when acceptance criteria, appropriate checks and blocking findings are resolved. Report unavailable checks honestly. Follow existing authorization for commits, pushes and PR updates; this workflow does not authorize merge, release or source-issue closure.
