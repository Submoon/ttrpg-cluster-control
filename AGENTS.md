## Documentation language

Write all project documentation in English, including planning artifacts under `.scratch/`, specifications, tickets, research reports, domain documentation, and agent instructions.

## Repository baseline

Before GitHub-driven analysis or implementation, fetch `origin` and compare the checkout with `origin/main`. Fast-forward an outdated `main` when safe, preserving local work. Record the actual baseline commit in planning artifacts; identify any intentionally different base explicitly.

## Agent skills

### Issue tracker

For GitHub intake or local planning, read `docs/agents/issue-tracker.md`: GitHub holds requests; local Markdown holds complex efforts under `.scratch/<feature>/`.

### Triage labels

For triage role mappings and their separation from ticket lifecycle, read `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md` for consumer rules.
