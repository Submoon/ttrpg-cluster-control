---
title: Project multi-agent development workflow
status: closed
---

# Project multi-agent development workflow

## Request and baseline

Configure project-local Codex profiles with the agreed models and reasoning efforts, a ceiling of six subagents, and automatic routing by complexity and risk.

Fetched origin on 2026-10-15. Implementation intentionally uses the existing `codex/interface-revamp` checkout at `d6feb188e58a9e28ae5eeb9e91ff6a91c5b89937`, which is ten commits ahead and zero behind `origin/main` (`629d2a98715c3a16b954e0f77c639b1f0c31212c`). Preserve existing untracked environment configuration and server logs.

## Acceptance criteria

- The main session defaults to GPT-6.1 Sol / high; specialist profiles explicitly set both model and reasoning effort.
- Architect and deep reviewer use GPT-6 Astra / high; developer uses GPT-6.1 Sol / high; light developer uses GPT-6 Luna / high; reviewer uses GPT-6.1 Sol / xhigh.
- Configure six concurrent subagents excluding the main agent, respecting lower runtime limits when present.
- Route trivial, standard, complex, and sensitive changes with independent review for behavior changes and complementary review for sensitive changes.
- Assign disjoint write scopes, integrate centrally, and bound repeated review cycles without accepting unresolved defects.
- Preserve existing issue tracking, domain documentation, permission boundaries, and user overrides.

## Validation

- All six TOML files parsed successfully with Python tomllib; the skill passed skill-creator's quick_validate.py.
- A temporary local Codex app-server started with --strict-config returned the effective project layer: gpt-6.1-sol / high, agents enabled, and max_concurrent_threads_per_session = 6. Its skills/list API discovered project-development with repository scope and enabled = true. See validate_runtime.py for the read-only protocol check.
- An independent GPT-6.1 Sol / xhigh reviewer evaluated seven routes: trivial edit, localized behavior fix, cross-module domain concept, save migration, sensitive review-only request, constrained runtime, and repeated correction failures. No blocking findings.
- git diff --check passed. Application tests were not needed for this configuration-only change.
- The current chat's concurrency limit is unchanged. New sessions load the project settings, subject to runtime limits and explicit session overrides. Native named-profile execution and every configured model were not exercised; the independent review used explicit model/effort dispatch.

## Resolution

Added project defaults, five specialist profiles, and an automatically selected development skill reached through AGENTS.md. Existing environment setup and unrelated local files were preserved.
