---
title: "Find and reveal objects across every system"
status: in-progress
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 03: Find and reveal objects across every system

## Source and scope

[Global search with branch-aware map framing](../spec.md) is the parent specification; its validated product behavior and confirmed test seams remain authoritative.

Source: [Global search with auto-fit, GitHub #7](https://github.com/Submoon/ttrpg-cluster-control/issues/7), refreshed on 2026-10-29 with unchanged body, OPEN state, enhancement / priority:P1 and no comments. Actual planning baseline: **8d4b66504ca6723db5405ed7cb93d0a666264c9a**, equal to detached HEAD, local main and freshly fetched origin/main (0 ahead / 0 behind). No alternative base is intended. Refresh source/baseline before implementation and preserve local and predecessor work.

## What to build

A Warden can search every object's name or Location key in the entire current workspace from either map, including unopened systems, then activate an exact result through one complete guarded cross-map reveal. Reach the correct object and full branch after remembered camera restoration without losing drafts, query state or accessible focus.

## Blocked by

None. [Find an object and frame its branch in the active system](02-active-system-object-branches.md) is closed. Its active-system object search, guarded reveal and complete hosted-branch framing are the completed predecessor. Its remaining validation limitation is recorded in the linked implementation outcome.

## Specification coverage

Completes User Stories 2 and 24 and extends all applicable matching, identity, applied-data, draft, framing, mobile and session stories to every system. The complete specification, including the later opening-shortcut story 53, is the final acceptance boundary; this is a functional extension, not a tests-only integration ticket.

## Acceptance criteria

- [ ] Object-name and Location-key results cover all systems in the current workspace from both cluster and system views. Remove the active-system-only limitation; unopened maps are included without loading another workspace or recovery snapshot.
- [ ] Preserve one row per entity while ranking across all eligible fields and kinds. Repeated names, same keys across systems, case-distinct keys and duplicate imported systems/objects remain distinct stable-ID destinations with contextual labels and occurrence numbers.
- [ ] One command accepts explicit destination identity, resolves existing modified sessions and revalidates target/context after waits. The search UI does not chain void-returning system-selection and object-selection commands or infer success from a changed view.
- [ ] Successful cross-system activation opens the owning system, selects the intended object and applies the complete branch framing from 02. Neither a same-named object in the starting system nor a remembered destination selection can win.
- [ ] Destination mount, visit restoration, panel closure, software-keyboard layout and deferred focus/camera work are sequenced with request ownership checks. A newer activation, removed destination or editor reset cannot receive an obsolete completion.
- [ ] Apply/Discard/Stay and invalid Apply behave consistently for visible/hidden object, Orbit, route and chart-name sessions. Rejected navigation preserves the starting map/selection/camera/query; same-target session reuse remains intact. A legitimate accepted guard Apply is neither rolled back nor replayed if the later reveal becomes stale.
- [ ] Renaming, importing, deletion and Undo/Redo update global matches and disambiguation. Applied values remain searchable during pending durability; drafts/previews remain excluded. Query retention/reset and accessible reachability of all results remain correct.
- [ ] Cluster/system destinations stay unchanged: a system result still frames its cluster node rather than entering its map. Search reactivation overrides the destination camera for that activation; normal Back/revisit still restores valid per-map state.
- [ ] Desktop/compact users can discover, scroll to and deliberately activate a result in another system, see its full branch with Inspect closed as specified and continue with map focus. Search Escape/composition/input ownership and retained drafts survive nested guards and rotation/reflow.
- [ ] A representative larger workspace proves that later matches are reachable and selection remains usable without silent truncation. Do not infer numerical capacity/latency guarantees from tiny existing fixtures.
- [ ] Real command and public-browser scenarios cover cluster-to-object, system-A-to-system-B, same-system reactivation, identical imports, context/target changes during confirmation and remembered-camera races. Include all earlier slice regressions and full-spec acceptance evidence.
- [ ] Record actual software-keyboard/input evidence for the mobile journey and clearly distinguish any remaining physical keyboard/screen-reader certification limits from browser emulation. Do not mark the full mobile criterion satisfied solely by viewport emulation.
- [ ] Remove the redundant initial empty-query instruction while keeping an inviting input and explicit no-match state. Control+K on Windows/Linux and Command+K on macOS open Search with query focus and a visible keyboard hint; repeated opening preserves the query. Preserve ordinary desktop drafts, competing dialog/fullscreen-panel ownership, composition and active gestures.

## Verification and completion boundary

Use focused checks while developing, then follow the repository's integrated verification policy for the final candidate; reuse passing unchanged evidence and broaden only when changes justify it. Lint/typecheck, relevant failure paths, visible desktop/compact framing, the maintained UI smoke selection and the established integrated suite requirement belong to delivery, not an invented fourth testing ticket.

Completion means the full local specification is satisfied with recorded evidence, not merely that cross-system selection changed an ID. Source-issue closure, remote labels/comments, push/PR/merge and release still require the user's applicable instructions; this ticket does not grant them.

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

On 2026-10-30, the user requested pushing ticket 02 and coordinating this ticket with the implement skill and sub-agents, then explicitly required **one branch for the entire feature**. The current canonical branch is **codex/global-search**, pushed with both completed predecessor slices at `a230349258de37b480123da76a9f681d473a19f0`. No ticket-specific branch is created for this slice. Historical branch names in predecessor records describe past provenance only.

Freshly fetched `origin/main` and local `main` are **971e91c0ad2fc78e4f92c1e625091a577960b41b**. They include three newer map-tool-shortcut commits absent from the predecessor. The coordinator merged them without conflicts, preserving all feature work; the pinned ticket 03 implementation/review baseline is **f2ca2fc5c8c8d1e211a9af4604d4f99822537e4a**. No main fast-forward was needed. GitHub #7 was re-read unchanged, OPEN, with enhancement / priority:P1 and no comments.

Use the Complex route: read-only architecture handoff, at most two disjoint developers with TDD at the already approved pure calculations, real composed editor command and public-browser seams, then independent Standards and Spec review. The coordinator owns Git, shared preparation/checks, servers and browsers. See [Global object search: implementation and verification](../implementation-03.md). Actual mobile software-keyboard evidence is a separate explicit acceptance requirement; browser emulation alone must not close it. No PR, merge to main, release or remote issue update is requested.

The user later authorized [draft PR #36](https://github.com/Submoon/ttrpg-cluster-control/pull/36) for its rolling Vercel branch preview, successfully tested the preceding UI on Nothing Phone 4a Pro / Firefox, and requested native Navbar/Toolbar/CommandPalette while proposing Tree for Hierarchy. The [native presentation refactor](../dashboard-refactor.md) is part of this same implementation and branch. Preserve all behavioral criteria; revalidate mobile input after replacing the search widget. Merge, release and source-issue closure remain outside scope.
