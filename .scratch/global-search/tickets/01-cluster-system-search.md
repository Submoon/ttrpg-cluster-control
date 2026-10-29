---
title: "Find and reveal the cluster and its systems"
status: in-progress
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 01: Find and reveal the cluster and its systems

## Source and scope

[Global search with branch-aware map framing](../spec.md) is the parent specification; its validated product behavior and confirmed test seams remain authoritative.

Source: [Global search with auto-fit, GitHub #7](https://github.com/Submoon/ttrpg-cluster-control/issues/7), refreshed on 2026-10-29 with unchanged body, OPEN state, enhancement / priority:P1 and no comments. Actual planning baseline: **8d4b66504ca6723db5405ed7cb93d0a666264c9a**, equal to detached HEAD, local main and freshly fetched origin/main (0 ahead / 0 behind). No alternative base is intended. Refresh source/baseline before implementation and preserve local and predecessor work.

## What to build

A Warden can open a visible search from either map context, find the current Jump Cluster or any star system by name, deliberately choose a distinct result and see the appropriate cluster destination. Establish the reusable editor-level result-reveal operation with real draft guards, truthful completion and accessible search/query lifetime.

## Blocked by

None. This is the initial executable frontier once product implementation is explicitly authorized.

## Specification coverage

User Stories 1, 3-4, 7-9, 11-16, 18-23, 25-28 and 31-52 as applicable to cluster/system results. Remaining object-specific and global-object coverage is delivered by 02 and 03; these story references do not narrow the acceptance requirements below.

## Acceptance criteria

- [ ] Search is visibly reachable and named from cluster and system contexts on desktop and compact layouts, without a mandatory shortcut.
- [ ] Applied cluster/system names across the current workspace match literal case/accent-insensitive text with trimmed surrounding whitespace, exact -> prefix -> substring ranking and a deterministic tie-break. Empty input invites typing; no match is explicit; all matches remain reachable.
- [ ] Results follow the latest applied names/imports/deletions/history traversal even while durable saving is pending; drafts/previews and recovery snapshots are excluded.
- [ ] Stable-ID results remain separate despite identical names. Show type/context and a result-only occurrence number when needed; do not rename data or show raw IDs to disambiguate.
- [ ] Typing, hovering and result traversal do not change map/tool/selection/camera/data or resolve drafts. Explicit activation uses one focused editor operation, not UI-coordinated navigation calls.
- [ ] Cluster activation opens and fits the cluster overview; system activation opens the cluster view, selects that node and frames its visible card/label without entering its local map or silently replacing the separately active system.
- [ ] Existing Apply/Discard/Stay guards cover modified and hidden sessions. Stay or invalid Apply retains starting map/selection/camera and query; validation and focus remain usable. Deleted targets, changed context and superseded deferred requests cause no partial navigation or stale reveal.
- [ ] Accepted context transitions and pending gesture/continuous-adjustment handling reuse existing ownership. Result activation cannot accidentally place or move an entity, and search adds no data/history action; an explicitly accepted guard Apply remains its own ordinary edit.
- [ ] Success closes search, focuses the map and does not automatically open Inspect. Retain useful desktop panels; hide the compact fullscreen panel while preserving retained work. Frame after map restoration and the resulting layout are ready, accounting for obstructions.
- [ ] Repeated activation reframes; ordinary Back/revisit keeps existing memory. The query survives closing/reopening/reflow during the editor session and resets on identity change or editor exit.
- [ ] Keyboard users can reach results and activate with Enter; composition cannot activate accidentally. Escape closes only search and returns focus to its opener. Touch users can type, scroll and activate; compact/short-landscape layouts leave usable input and results.
- [ ] Pure matching cases, real composed command scenarios and public desktop/compact journeys establish these behaviors, including duplicate system names, guard choices, stale targets, remembered cameras and focus. Supply affected checks and rendered evidence, identifying the boundary of emulated mobile testing.

## Verification and continuation

Use the confirmed editor-command integration seam, public browser flows and targeted pure calculations. Do not mock away draft resolution. Run lint/typecheck and affected behavior/UI checks for the candidate. The demo is complete for cluster/system discovery; object matches are not yet enabled. Preserve the same search entry, identity model, guard outcome and query lifetime for the next slice.

## Shared constraints

- The parent specification and its confirmed editor-command, public-browser and pure-calculation test seams are authoritative. Deliver the enabled entity kinds end to end; do not absorb the next slice or claim all-workspace object search before ticket 03.
- Search latest applied data, including pending durability, not drafts/previews. Match literal case/accent-insensitive text, trim surrounding query whitespace and rank exact before prefix before substring; use deterministic ties. Empty input invites typing, no matches are explicit and all matches remain reachable.
- Keep distinct stable IDs despite identical display text or normalized keys. Show type/context and object Location key when applicable, then a deterministic result-only occurrence number for collisions. Do not rename data or introduce persistent search identity.
- Consultation never changes map/tool/selection/camera/data or resolves drafts. Explicit activation uses the single guarded reveal operation; recheck captured ownership and destination after guards, mount/restoration and any deferred camera/focus work.
- Preserve Apply/Discard/Stay, same-target sessions and validation feedback. Rejected or stale navigation must not partly change map/selection/camera. A separately accepted guard Apply remains a legitimate ordinary edit; search neither rolls it back nor replays it.
- Cluster results fit the cluster overview; system results select/frame a cluster node without entering its system map. Object results, once enabled for the slice, select their exact object and frame its hosted recursive Orbit branch, excluding parents/siblings and unrelated links.
- Whole-branch containment takes priority over small-label readability; use valid scale support, visible content bounds and usable map space. An isolated target retains context. Frame after visit restoration; repeated activation reframes while ordinary Back/revisit keeps its existing semantics.
- Success closes search, focuses the map and does not automatically open Inspect. Retain useful desktop panels, hide compact fullscreen panels while preserving retained work, and keep Inspect available.
- Retain the query for hide/reopen/reflow within the editor identity/session; reset on identity change or editor exit. Escape first dismisses search and returns opener focus; it must not also cancel tools/drafts or pan the map. Preserve native editing, composition and nested-dialog ownership, keyboard traversal/Enter and touch input.
- Reuse editor session/gesture/continuous-adjustment ownership and the sole workspace writer. No new schema, persistence path, durable query history, navigation stack or search/history mutation is introduced. Respect SSR/browser resource lifetime.
- Fuzzy matching, descriptions/custom fields/routes/Orbits as search results, other workspaces/profiles and raw-ID disambiguation are out of scope. Concrete UI composition and spacing remain design choices within the approved contract.
- Follow repository implementation/review and verification guidance. Record actual evidence; do not claim physical-input or screen-reader certification from browser viewport emulation. Keep work in this effort's worktree and preserve unrelated environment files.

## Planning authorization and execution frontier

The user explicitly approved these three vertical slices and the dependency graph 01 -> 02 -> 03 on 2026-10-29. This authorizes local ticket publication only, not product implementation, commits, pushes, PRs, merges, releases or changes to the parent GitHub issue.

The tickets are fully specified (enhancement, ready-for-agent) but lifecycle and dependency availability are separate. At publication, ticket 01 is open and unclaimed; tickets 02 and 03 are blocked until their linked predecessor is closed. Remove the dependency blocker and return a ticket to open when it clears; claim it only after implementation is authorized. Refresh source/baseline and preserve completed predecessor work rather than resetting to the historical planning revision.

## Implementation authorization and baseline

On 2026-10-29, the user explicitly requested coordination of ticket 01 through the implement skill using sub-agents on a separate branch. The coordinator claims only this ticket on **codex/global-search-ticket-01**. Actual implementation baseline: **8d4b66504ca6723db5405ed7cb93d0a666264c9a**, equal to freshly fetched origin/main and local main; no alternative base or fast-forward was needed. GitHub #7 was re-read and remains unchanged.

Use the Complex route: architect before implementation, developer ownership with TDD at the already approved seams, then independent Standards and Spec review against this pinned baseline. The coordinator owns shared Git, ports, runtime/browser sessions and integrated checks. Commit scoped work when complete; preserve unrelated environment files. No push, PR, merge, remote issue update or work on tickets 02/03 is included.
