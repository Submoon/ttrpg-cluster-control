---
title: "Export all three player map image scopes"
status: in-progress
assignee: Codex
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 20 — Export all three player map image scopes

## What to build

Offer the same three PNG and SVG scopes in player preview and reader using only the detached published document and the current public view where applicable.

## Blocked by

- [Inspect shared Jump Routes in the player views](17-inspect-shared-player-routes.md)
- [Export all three Warden map image scopes](19-export-warden-map-images.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 41–47, 53–56.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

## Acceptance criteria

- [ ] Entire Cluster frames the published overview and permitted anonymous destinations. Selected system frames its complete public detail and dashed public route segments. Current viewport preserves public framing, detail and filters.
- [ ] Images contain only permitted marks and published path geometry. Public bounds and image content do not change when private source extents change without changing the document. Disclosure for attached Jump Points and anonymous ends matches the view.
- [ ] Older shares export using the cleaned public document, with no same-system loops and no inferred Jump Point associations.
- [ ] PNG and SVG obey the same scope behavior used by the Warden image workflow. Verify the public serializer against paired disclosure fixtures and one representative download from the shared player experience.
