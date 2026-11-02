---
title: "Global search: approved vertical implementation slices"
status: closed
---

## Purpose and approval state

The user explicitly approved the three slices and their dependency graph on 2026-10-29. This document preserves the reviewed proposal; the separate published tickets linked in Resolution are authoritative for their execution status. No implementation is authorized by this planning approval. Each ticket has local `enhancement` / `ready-for-agent` triage roles, its specification link and its blocking edges. Following repository lifecycle rules, ticket 01 is initially open/unclaimed, while 02 and 03 are blocked by their unresolved predecessors.

The parent is [Global search with branch-aware map framing](spec.md). Its accepted behavior and test seams remain unchanged. The historical [Global search with auto-fit: behavior framing](framing.md) records the product answers.

## Source issue and actual baseline

[Global search with auto-fit, GitHub #7](https://github.com/Submoon/ttrpg-cluster-control/issues/7) was re-fetched on 2026-10-29 with body, comments, labels and state. It is unchanged: OPEN, `enhancement`, `priority:P1`, no comments. GitHub remains the source request; this proposal and future implementation tickets are local. No parent-issue modification is requested.

After a fresh `origin` fetch on 2026-10-29, detached `HEAD`, local `main` and `origin/main` are all **8d4b66504ca6723db5405ed7cb93d0a666264c9a**. Both comparisons with `origin/main` are 0 ahead / 0 behind; no different base or fast-forward is needed. Implementation must recheck its actual starting base and completed blocking tickets rather than reuse this historical hash as a mandate to reset.

## Breakdown and real blocking edges

| Proposed ticket | Blocked by | Demonstrable outcome |
| --- | --- | --- |
| 01 — Find and reveal the cluster and its systems | None | From either map, search cluster/system names, choose a distinct result, resolve any draft guard and see its fitted cluster destination using keyboard or touch. |
| 02 — Find an object and frame its branch in the active system | Ticket 01 | Search active-system objects by name or Location key, distinguish homonyms, select an object and fit its complete nested Orbit branch without opening Inspect or losing work. |
| 03 — Find and reveal objects across every system | Ticket 02 | The same search includes objects in unopened systems and reveals the exact destination through one guarded operation, retaining complete-branch framing and correct camera/focus ordering. |

The graph is deliberately linear: **01 -> 02 -> 03**. Ticket 02 extends the usable search/reveal entry delivered by 01. Ticket 03 depends on both the object-result semantics and branch-aware framing delivered by 02; it is not merely waiting on shared files. No additional transitive 01 edge is needed on 03.

There is no independent prefactoring ticket: no necessary broad mechanical refactor was established by code analysis. Introduce the complete reveal boundary with the first working slice, and extend it in later slices. If implementation discovers a concrete prerequisite refactor, record its necessity and impact before changing this approved graph.

Each slice includes data calculation, the real guarded command, UI access/feedback, framing and meaningful tests for the entity kinds it enables. Accessibility, identity safety and draft protection are obligations from the first slice, not final polishing tickets. No ticket is a search-engine-only, camera-only or tests-only layer.

**Intermediate scope is explicit.** Ticket 01 enables cluster/system results. Ticket 02 adds objects in the active system only; this is a temporary increment, not the final meaning of global. Ticket 03 removes that limitation. The full source request is not complete after 01 or 02, and no intermediate delivery may claim that all-workspace object search is already satisfied.

## Proposed ticket 01 — Find and reveal the cluster and its systems

**What to build:** A Warden can open a visible search from either map context, find the current Jump Cluster or any star system by name, deliberately choose a distinct result and see the appropriate cluster destination. Establish the reusable editor-level result-reveal operation with real draft guards, truthful completion and accessible search/query lifetime.

**Blocked by:** None (can start immediately).

**Specification coverage:** User Stories 1, 3-4, 7-9, 11-16, 18-23, 25-28 and 31-52 as applicable to cluster/system results. Remaining object-specific and global-object coverage is delivered by 02 and 03; these story references do not narrow the acceptance requirements below.

### Acceptance criteria

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

### Verification and continuation

Use the confirmed editor-command integration seam, public browser flows and targeted pure calculations. Do not mock away draft resolution. Run lint/typecheck and affected behavior/UI checks for the candidate. The demo is complete for cluster/system discovery; object matches are not yet enabled. Preserve the same search entry, identity model, guard outcome and query lifetime for the next slice.

## Proposed ticket 02 — Find an object and frame its branch in the active system

**What to build:** A Warden on a star-system map can use the same search to find any object in that active system by name or Location key, distinguish repeated-looking results and select the exact object. Its complete hosted Orbit branch is framed in usable map space, with the editor's existing draft and input guarantees preserved.

**Blocked by:** Ticket 01 — Find and reveal the cluster and its systems.

**Specification coverage:** User Stories 5-6, 10, 17, 29-30 and 32-34; extends 7-20, 21, 25-28 and 35-52 to object results within the active system. Cross-system coverage in 2, 15 and 24 remains assigned to 03.

### Acceptance criteria

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

### Verification and continuation

Run affected matching, command, geometry and browser checks plus lint/typecheck. Inspect useful rendered branch detail, compact states and minimum-scale behavior. Existing map-fit/navigation cases remain regression anchors. The demonstration is an end-to-end active-system object lookup and complete-branch reveal; global lookup of inactive-system objects follows in 03.

## Proposed ticket 03 — Find and reveal objects across every system

**What to build:** A Warden can search every object's name or Location key in the entire current workspace from either map, including unopened systems, then activate an exact result through one complete guarded cross-map reveal. Reach the correct object and full branch after remembered camera restoration without losing drafts, query state or accessible focus.

**Blocked by:** Ticket 02 — Find an object and frame its branch in the active system.

**Specification coverage:** Completes User Stories 2 and 24 and extends all applicable matching, identity, applied-data, draft, framing, mobile and session stories to every system. The complete 52-story specification is the final acceptance boundary; this is a functional extension, not a tests-only integration ticket.

### Acceptance criteria

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

### Verification and completion boundary

Use focused checks while developing, then follow the repository's integrated verification policy for the final candidate; reuse passing unchanged evidence and broaden only when changes justify it. Lint/typecheck, relevant failure paths, visible desktop/compact framing, the maintained UI smoke selection and the established integrated suite requirement belong to delivery, not an invented fourth testing ticket.

Completion means the full local specification is satisfied with recorded evidence, not merely that cross-system selection changed an ID. Source-issue closure, remote labels/comments, push/PR/merge and release still require the user's applicable instructions; this ticket does not grant them.

## Completed user review

The user accepted the recommended three slices and the linear graph 01 -> 02 -> 03, without requesting a merge, split or dependency change. This isolates the substantial branch-geometry work from cross-map asynchronous ownership while keeping each increment independently usable.

## Resolution

Closed on 2026-10-29 after approval and publication of these local implementation tickets:

1. [Find and reveal the cluster and its systems](tickets/01-cluster-system-search.md)
2. [Find an object and frame its branch in the active system](tickets/02-active-system-object-branches.md)
3. [Find and reveal objects across every system](tickets/03-global-object-reveal.md)

The 35 reviewed acceptance items were preserved in those tickets, along with their scope, verification requirements and blocking links. Ticket 01 is the only initial frontier. The full specification remains open until implemented and verified; GitHub #7 is unchanged and remains open. No product code, commits, remote tracker writes or implementation claims were created by this planning step.

### Implementation outcome

All three separately authorized tickets are now closed on the single **codex/global-search** branch. [Ticket 03's resolution](tickets/03-global-object-reveal.md) records the complete all-workspace feature, native UI follow-up, Control/Command+K entry, successful actual-phone journey and green 531-case integrated CI. The original dependency graph remains 01 -> 02 -> 03; no fourth implementation slice was introduced. [Draft PR #36](https://github.com/Submoon/ttrpg-cluster-control/pull/36) remains unmerged and the coordinator did not close the remote source issue.
