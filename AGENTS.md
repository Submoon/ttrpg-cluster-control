## Documentation language

Write all project documentation in English, including planning artifacts under `.scratch/`, specifications, tickets, research reports, domain documentation, and agent instructions.

## Repository baseline

Before GitHub-driven analysis or implementation, fetch `origin` and compare the checkout with `origin/main`. Fast-forward an outdated `main` when safe, preserving local work. Record the actual baseline commit in planning artifacts; identify any intentionally different base explicitly.

## Agent skills

### Development workflow

For implementation, bug fixes, refactoring, or code review, the main agent must read and follow `.agents/skills/project-development/SKILL.md`. It coordinates the work and must delegate to the specialist subagents required by that skill's complexity routing, without waiting for a separate delegation request. Delegated agents execute their assigned scope and return results to the coordinator; they do not restart the routing workflow.

### Issue tracker

For GitHub intake or local planning, read `docs/agents/issue-tracker.md`: GitHub holds requests; local Markdown holds complex efforts under `.scratch/<feature>/`.

### Triage labels

For triage role mappings and their separation from ticket lifecycle, read `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md` for consumer rules.
