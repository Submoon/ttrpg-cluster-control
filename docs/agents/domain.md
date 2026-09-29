# Domain documentation

## Layout

This repository uses one domain context: `CONTEXT.md` at the repository root. Durable, surprising domain or architecture trade-offs belong in `docs/adr/`.

## Consumer rules

- Read the relevant context and ADRs before changing domain behavior or terminology.
- Use the `domain-modeling` skill when introducing or changing domain terms and relationships.
- Keep `CONTEXT.md` to the domain glossary and relationships; do not put implementation details or feature specifications there.
- Update the context when terminology or relationships are resolved. Create ADRs sparingly for decisions that are hard to reverse, surprising without context, and the result of a real trade-off.
- Use `CONTEXT-MAP.md` only if the repository later grows into multiple genuine domain contexts.
