---
name: project-development
description: Coordinate implementation, bug fixes, refactoring, and code review in ttrpg-cluster-control, selecting specialist subagents by complexity and risk. Use for project development work; delegated specialists follow their assigned scope.
---

# Project development

The main chat is the coordinator. Follow the repository's AGENTS.md baseline rules and, for GitHub intake or local planning, docs/agents/issue-tracker.md. Specialist agents return evidence to the coordinator rather than recursively invoking this workflow.

## Classify and route

Inspect the request and relevant code, identify acceptance criteria, then state the selected route and its reason briefly. Evaluate uncertainty, coupling, and failure impact; file count alone does not determine complexity. Apply the highest applicable route and reclassify when new evidence appears.

| Route | Trigger | Required workflow |
| --- | --- | --- |
| Trivial | Local text, cosmetic styling, or a mechanical change with no behavior, data, or shared-contract impact | Coordinator handles it directly; use developer_light only if delegation is useful. Focused verification. |
| Standard | Clear behavior change or localized bug fix with understood dependencies | developer implements; reviewer independently reviews the integrated change. |
| Complex | Unclear behavior, cross-module changes, new domain relationships, or interface design | architect resolves the design first; developer implements bounded tasks; reviewer reviews the integrated change. |
| Sensitive | Persistence or save-format changes, import/export compatibility, migrations, destructive operations, security boundaries, or changes to established domain invariants | architect defines contracts and failure cases; developer implements; reviewer and reviewer_deep independently examine complementary technical and functional risks. |

A clear, small mechanical subtask may go to developer_light within any route; this does not remove the route's design or review requirements. For a review-only request, apply the required review lenses to the existing change without launching implementation or fixing findings unless requested. Consult architect only when understanding the requirements or design needs clarification.

## Profiles and dispatch

Project settings live in .codex/config.toml. Specialist model and reasoning settings are authoritative in .codex/agents/<name>.toml; use the names in the routing table. The coordinator runs in the main session with the project defaults unless the user has chosen different settings.

Use the client's named custom-agent facility when available. If the available spawning tool only accepts a model, reasoning effort, and task prompt, read the selected TOML file and pass its model, model_reasoning_effort, and developer_instructions explicitly with the scoped brief. Where model overrides require a fresh context, use a fresh-context spawn and include the repository path, applicable instructions, source requirements, and relevant artifact paths.

Respect explicit user model choices and runtime capacity. If a model, effort, or delegation facility is unavailable, report the limitation and agree on a substitution instead of claiming that the configured profile ran. Continue independent work while resolving it.

The configured ceiling is six simultaneous subagents, excluding the coordinator; it is not a target. Honor any lower effective runtime limit and queue dependent work. Reuse or close finished agents when supported. The coordinator alone dispatches agents.

## Coordinate execution

Before dispatch, give each agent:
- The objective, acceptance criteria, source requirements, and relevant domain or design references.
- The baseline commit and candidate snapshot when relevant.
- Owned files or directories, allowed actions, shared resources, and dependencies.
- The expected deliverable: decisions or changed files, evidence, validation outcomes, and unresolved questions.

Resolve shared interfaces before parallel implementation. Allow at most two simultaneous implementation writers initially, with disjoint file ownership; serialize overlapping changes. Assign planning files to one writer as well. Worktrees are useful for genuinely independent changes, but they still require integration and testing.

Keep Git checkout, staging, commits, merges, and integration under coordinator ownership in a shared checkout. Reviewers and architects do not modify application code. Serialize tests or browser operations that share ports, storage, fixtures, or output directories.

For multi-session efforts, use the existing .scratch/<feature>/ map/specification and ticket lifecycle, recording baseline, decisions, dependencies, ownership, and verification there. For small tasks, keep the brief in the chat. Maintain domain terms and durable decisions through docs/agents/domain.md rather than agent memory.

## Review, correct, and finish

Integrate completed work, run the relevant checks, and identify a stable candidate for review. Use a commit ID or an explicit captured diff and file snapshot; if reviewing the working tree, freeze writes to the reviewed scope until findings return. Review the actual task change, separating unrelated pre-existing branch work.

Give reviewers the original criteria and relevant evidence. For sensitive changes, assign reviewer the technical correctness/integration lens and reviewer_deep the domain/data compatibility lens, adjusted to the actual risk. Obtain their initial findings independently before synthesizing them.

The coordinator adjudicates findings using evidence, sends confirmed defects back to the owning developer, and records the reason for any rejected finding. After corrections, rerun affected checks and have the reviewer verify the fixes and surrounding risks. Substantial changes require another broader review.

After two unsuccessful correction cycles, reassess the design, narrow the work, or report the concrete blocking decision. This checkpoint does not waive unresolved defects or acceptance criteria.

Select validation from the repository's current scripts and the behavior changed. Application changes normally require type checking, a build, and relevant behavioral tests; interface changes also need browser verification when applicable. Documentation and configuration changes need appropriate parsing, discovery, and instruction checks rather than unrelated application tests.

Completion requires satisfied acceptance criteria, integrated code or artifacts, recorded validation results, and resolved blocking findings. Report any unavailable checks or runtime limitations accurately. Follow existing GitHub write authorization and completion rules; this workflow does not independently authorize publishing, merging, deployment, or issue closure.
