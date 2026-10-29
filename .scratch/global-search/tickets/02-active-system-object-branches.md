---
title: "Find an object and frame its branch in the active system"
status: blocked
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 02: Find an object and frame its branch in the active system

## Source and scope

[Global search with branch-aware map framing](../spec.md) is the parent specification; its validated product behavior and confirmed test seams remain authoritative.

Source: [Global search with auto-fit, GitHub #7](https://github.com/Submoon/ttrpg-cluster-control/issues/7), refreshed on 2026-10-29 with unchanged body, OPEN state, enhancement / priority:P1 and no comments. Actual planning baseline: **8d4b66504ca6723db5405ed7cb93d0a666264c9a**, equal to detached HEAD, local main and freshly fetched origin/main (0 ahead / 0 behind). No alternative base is intended. Refresh source/baseline before implementation and preserve local and predecessor work.

## What to build

A Warden on a star-system map can use the same search to find any object in that active system by name or Location key, distinguish repeated-looking results and select the exact object. Its complete hosted Orbit branch is framed in usable map space, with the editor's existing draft and input guarantees preserved.

## Blocked by

- [Find and reveal the cluster and its systems](01-cluster-system-search.md)

## Specification coverage

User Stories 5-6, 10, 17, 29-30 and 32-34; extends 7-20, 21, 25-28 and 35-52 to object results within the active system. Cross-system coverage in 2, 15 and 24 remains assigned to 03.

## Acceptance criteria

- [ ] In system view, the shared search includes all catalogue families/subtypes in the active system by object name and Location key, alongside the cluster/system results already available. In this intermediate slice, objects outside the active system are not yet included; do not claim final global-object coverage.
- [ ] Name/key matching follows the same literal normalization and ranking. An entity matching both fields appears once at its strongest rank. Distinct IDs and valid case-distinct keys remain separate.
- [ ] Object rows expose type, system context and Location key, with a deterministic result-only number for otherwise identical labels. Applied renames/key changes/imports/deletions/Undo/Redo refresh the results without persisting another index.
- [ ] The principal reveal command selects the exact active-system object through real session guards, with stale target/context checks and an observable accepted/rejected outcome. Selecting the current draft target retains its session; Stay or invalid Apply cannot partly retarget the editor.
- [ ] Frame the object, all Orbits it hosts, their occupants and recursively hosted branches. Exclude its parent Orbit, siblings, unrelated Jump Routes and optional physical Station-reference targets.
- [ ] Branch bounds contain visible object marks, Location keys/names and Orbit rings, excluding invisible hit areas and edit handles. Flat renderer groups must not be mistaken for domain parentage.
- [ ] Contain the whole branch with a margin, including rotated/nested ellipses and descendants on either side. Prioritize the full extent over small-label readability; support a valid lower scale when the former system floor prevents the fit and coordinate it with zoom controls and viewport restoration.
- [ ] For an isolated object, retain useful context and a reasonable scale rather than zooming its small glyph to maximum. Concrete margins/caps are design choices verified in rendered desktop and compact states.
- [ ] Account for desktop obstructions and compact panel/keyboard layout. Success closes search and shows the framed map, focuses it and leaves Inspect available; retained drafts survive hiding panels and responsive reflow.
- [ ] All query, keyboard/composition/touch, no-write/history, reactivation and ordinary visit guarantees from 01 continue to apply to objects. Pending gestures/continuous proposals retain established completion/cancellation semantics.
- [ ] Pure cases verify branch membership and geometry; composed commands verify real same-system guards; public browser journeys show leaf/nested branches, parent/sibling exclusion, large-branch fit, desktop overlays and compact focus without regression to cluster/system results.

## Verification and continuation

Run affected matching, command, geometry and browser checks plus lint/typecheck. Inspect useful rendered branch detail, compact states and minimum-scale behavior. Existing map-fit/navigation cases remain regression anchors. The demonstration is an end-to-end active-system object lookup and complete-branch reveal; global lookup of inactive-system objects follows in 03.

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
