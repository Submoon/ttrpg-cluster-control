---
title: Validate the selected B direction on representative devices and preservation flows
status: in-progress
label: wayfinder:task
type: task
mode: HITL
parent: ../map.md
assignee: codex-wayfinder-device-preservation
---

## Parent map

[Revamp the interface: make the map central on desktop and mobile](../map.md)

## Question

Which physical-device, accessibility, and state-preservation guarantees can be demonstrated by the accepted B direction before final library adoption, and which guarantees require later production integration evidence?

## Context and scope

Created on 2026-10-14 to retain explicit missing evidence from [Interface prototype evidence and comparison plan](../prototype-evidence.md). Baseline: `629d2a98715c3a16b954e0f77c639b1f0c31212c`, confirmed by the root's fresh fetch on 2026-10-14, `main == origin/main`, zero ahead/behind. Refresh the baseline and [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3) when claiming. No physical-phone, virtual-keyboard, touch-gesture, complete accessibility or production-storage acceptance has been established by the browser emulation runs.

The human has already chosen B, with full-height mobile Inspect, mutually exclusive mobile Inspect/Hierarchy, removal of the pictured utility toolbar and LIVE MAP badge. Do not require another design approval. The mobile inspector covers the map while open; hiding/reopening must preserve editing and map state. Desktop retains independently navigable map editing. This explicit mobile amendment supersedes the earlier simultaneous mobile-pan presentation assumption, not domain/draft/save guarantees.

## Required evidence and artifact

Write `../research/b-device-preservation-evidence.md`. Record exact capture, physical device/browser/OS versions, data/scenes, actual actions and observations, screenshots where useful, failures, simulated behavior and unmeasured limitations. Human participation supplies physical-device access/observations where unavailable to the agent; it is not a new vote on the layout.

- Use dense populated Jump Cluster and star system scenes on representative desktop and a modest physical phone. Cover portrait, landscape/short viewport, virtual keyboard and safe areas in both themes. Measure the actually visible map area in map mode and full-height editor geometry in Inspect mode; verify internal scroll, Hide, close/reopen and reachable actions/status.
- Exercise every mobile Inspect/Hierarchy opening path, accepted selection/context transitions and desktop-to-mobile reflow. Demonstrate exclusivity, same-target reopening, dirty-draft Apply/Discard/Stay, refusal/invalid Apply preserving the prior panel and draft, and no stale selection. Keep hierarchy initially closed and placement-type catalogue distinct from existing-entity selection.
- Demonstrate touch/pinch/second-contact cancellation, keyboard and single-pointer alternatives, target indication/ambiguity/invalid rejection, targeted one-shot Add and persistent Move/Modify under the resolved interaction contract. Desktop pan/zoom while editing and mobile hide-to-map navigation must preserve session work and prior applied data.
- Review focus/scroll restoration, modal confirmation containment/return, icon names/help, non-color states, measured contrast/focus/target criteria, and screen-reader/color-blindness observations. Coordinate the separate accessibility request; do not claim a full audit or conformance from a small representative sample.
- Cover object/Orbit/Jump Route/chart/field drafts, hidden ownership and dependency conflict guards; native/custom definition types/options/applicability and affected-value review; cancellation and renewed destructive review after Apply; import/cascade-deletion previews and validation refusal. Record unsupported stubbed flows separately from domain command evidence.
- Exercise clean full-scene SVG/PNG for both maps, active/print palettes, dense/off-viewport geometry and active draft/gesture conditions: output excludes temporary decoration/unapplied work and preserves live context/view/tool/theme/draft. Capture actual files and visually inspect them.
- Separate in-memory Apply from durable saving/error/Retry/current JSON/reload/recovery. The prototype's simulated saves cannot prove real IndexedDB ordering, latest-snapshot Retry, backup restoration or full functional parity. Identify exact remaining production acceptance scenarios without connecting the disposable prototype to the user's real storage or implementing the production revamp in this evidence task.

## Resolution criteria

The artifact distinguishes executed representative checks, observed failures, unsupported disposable behavior, and later product-acceptance requirements. Closing this task records an honest completed investigation, not automatic passage of every gate. Essential unknowns that prevent final adoption require a precise follow-up dependency. [Confirm Nuxt UI adoption from prototype evidence](08-confirm-nuxt-ui-adoption.md) owns the subsequent live library decision.

## Blocked by

- [Choose a map-first UI direction through desktop and mobile prototypes](04-map-first-ui-direction.md) — **closed**, final capture and resolution supply the accepted presentation contract.

## Notes

Apply `wayfinder` and suitable browser/accessibility tools; claim before work. Claimed on 2026-10-14 by the dedicated device/preservation analysis session after publishing the chantier checkpoint. Browser resizing is not physical touch or a virtual-keyboard test. Preserve application data and existing contracts; all project documentation is English. No GitHub writes or production implementation.

## Comments

> *This was generated by AI during triage.*

2026-10-14 — Claimed by SOL 6.1 High for device/preservation analysis. Fresh origin fetch confirms production `origin/main` at `629d2a98715c3a16b954e0f77c639b1f0c31212c`; the intentionally different published chantier `codex/interface-revamp` is at `0dafd28fc18f75c758e70acb6058faadfdf7805e`, four commits ahead and zero behind. The refreshed source issue is unchanged. The [in-progress evidence artifact](../research/b-device-preservation-evidence.md) separates inspected trial behavior, new isolated browser checks, mandatory later product acceptance and human evidence. Luna XHIGH owns measurement code.

2026-10-14 — Human response to the phone/access question requests a PR so Vercel can automatically deploy the main application for testing, with B reachable through the main route. The parent session owns the authorized PR publication; a Luna XHIGH agent prepares a small preview adaptation. This is an explicit access prerequisite, not device/browser identification or a successful physical test. New preview evidence must carry its own build identity; current lab observations remain attached to the accepted prior capture plus the documented fixture normalization. Physical observations and the separate library-adoption decision remain pending; no Resolution is recorded.

2026-10-14 — First human deployed trial on [the preview PR](https://github.com/Submoon/ttrpg-cluster-control/pull/28), commit `99fe1a5709839d12d95fb3aacf1d73117015aa01`: access confirmed; phone model/OS/browser unspecified. Reported defects include Navigation opening editing as well as context, two-contact Move mutating objects while navigating, hidden return, duplicate Inspect/Details and zoom controls, and rail overlap/placement. The human requests long-press object inspection, suggests bottom slide/collapse panels, and **requires open mobile Details/Hierarchy to hide the rail like Fields**. This supersedes the earlier visible-above-panel rail arrangement; retain full-height open Inspect, exclusivity and preservation guarantees unless explicitly changed. The [evidence artifact](../research/b-device-preservation-evidence.md#first-deployed-trial-and-human-amendment) records the translated observations and cause/contract brief. Parent-directed Luna XHIGH corrections and a new-build human retest are pending. Earlier normalized laboratory results remain historical; no task/adoption Resolution is recorded.

2026-10-14 — Targeted SOL source review of the corrective working tree retained one-finger Move editing and the second-contact cancellation contract. It found a concrete long-press release-publication risk after slight jitter on the already-selected entity; Luna added rollback when Inspect is triggered and retained click suppression through release. The final focused source pass found no additional concrete blocker in the requested scope, while build/typecheck, targeted browser traces and physical retest remain delegated/pending. The parent also verified authenticated read-only IAB access to the original preview (about 817×900), distinct from the earlier anonymous Login redirect and the human's phone observations. No new broad QA campaign, ticket Resolution or adoption decision was made.

2026-10-15 07:45 UTC — Resumed by SOL 6.1 High under the existing `codex-wayfinder-device-preservation` claim; status remains `in-progress`. The root's fresh origin fetch and local identity check establish `codex/interface-revamp` at `99fe1a5709839d12d95fb3aacf1d73117015aa01`, matching its remote branch, five commits ahead and zero behind `origin/main` at `629d2a98715c3a16b954e0f77c639b1f0c31212c`. This intentionally different prototype-preview base is retained with the shared uncommitted corrective work. The root refreshed the unchanged, open source request. Luna XHIGH owns corrective code and targeted validation; the root owns commit/push and preview publication. The current published preview is still the earlier human-tested build, not evidence for the uncommitted patch. Phone identity is recorded as supplied, “Nothing phone 4a pro”; OS/browser remain unknown.

2026-10-15 — The human specifically asks the later Astra review to judge whether the current “Tools” make sense as a set and could be organized more coherently, citing Foundry VTT as a reference. The [independent Astra interface review brief](../research/astra-interface-review-brief.md) requires an explicit judgment on persistent modes versus placement operations, commands and panels; Navigate/Move, Add, Hierarchy, Inspect, Import/Export grouping; and mobile reachability/mental model. Astra must inspect official Foundry documentation at review time before making comparisons. The parent launches `gpt-6-astra` only after the corrected version is validated and published. Preparing this brief does not execute that review, redesign the tools, or resolve a human decision. Corrective retest and the separate library-adoption decision remain pending.

2026-10-15 — Corrective code and evidence are now published on `codex/interface-revamp` at `4d90f9774ea14b49fe6f99f1c72becacfd8454ed`. [The preview PR](https://github.com/Submoon/ttrpg-cluster-control/pull/28) remains a draft; Vercel reports **SUCCESS for that exact commit**, with [the deployment record](https://vercel.com/submoon/ttrpg-cluster-control/FN4szvZbJrXNqsHAaHqioZhMx4zg). The parent checked the corrected preview in a fresh authenticated IAB tab: Navigate opens Vela's system with Inspect closed; Back and one zoom set are visible; opening Inspect gives the full-height panel and hides rail/zoom, followed by Hide/reset. The requested browser viewport was 390×844; the document was 375×844 with a desktop scrollbar gutter. These are browser observations, not physical-phone acceptance; the [evidence artifact](../research/b-device-preservation-evidence.md) holds the parent's detailed record. The parent has launched `gpt-6-astra` for the **whole-interface review, including the required detailed Tools assessment**; its independent report is in progress and its authenticated browser access works. Physical retest on the human-provided “Nothing phone 4a pro”, OS/browser identification and the separate live library-adoption decision remain pending. This task retains its existing claim and `in-progress` status; no Resolution or adoption is recorded.
