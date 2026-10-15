# Independent Astra interface review brief

Prepared on 2026-10-15 for the human-requested review of the **entire corrected B interface**, including a mandatory, detailed assessment of Tools organization. The human explicitly clarified that the review covers the interface as a whole; Tools is a focus within that review. This is a future review brief, not findings or acceptance. Parent task: [Validate the selected B direction on representative devices and preservation flows](../tickets/10-validate-b-device-preservation.md); current provenance and human observations: [B device and preservation evidence](b-device-preservation-evidence.md).

## Start condition and reviewer

The parent launches an independent subagent using **`gpt-6-astra`** after the pending phone-feedback corrections have passed their targeted validation and have been published to the PR preview. SOL analysis does not substitute for this review. Record the actual reviewed commit, deployment URL, readiness result, date, viewport/input method, scene and executed actions before drawing conclusions. If the corrected deployment is unavailable or a blocking regression remains, report that boundary and request the corrected surface through the parent.

The current published draft [Preview the accepted B interface from the main application](https://github.com/Submoon/ttrpg-cluster-control/pull/28) is at `99fe1a5709839d12d95fb3aacf1d73117015aa01`. The [preview URL](https://ttrpg-cluster-control-git-codex-interface-revamp-submoon.vercel.app/) defaults to B; `/?variant=baseline` is the persisted baseline comparison. At brief preparation the corrections are uncommitted and their deployment identity is pending. The named branch URL can change builds: verify the new identity at review time. Use authorized authenticated access; the anonymous Vercel Login redirect is deployment protection. Keep the human's active work and storage intact.

## General interface review

Form an independent overall judgment of the corrected interface on desktop and mobile, in both map contexts. Inspect representative actions and states, beyond the rail, and prioritize concrete problems across these areas:

- Composition, visual hierarchy and readability: map prominence, information density, typography, contrast, labels, icons and light/dark coherence.
- Navigation and context: current map/selection visibility, entering a star system, returning to Jump Cluster, and continuity of the user's location and task.
- Panels, Hierarchy and Inspector: opening/closing paths, spatial relationships, selection versus editing, exclusivity, scrolling and usable map/editor area.
- Forms and fields: labels, grouping, editing flow, validation, reachable actions, field-management surfaces and understanding the effect of a change.
- Discoverability and interaction consistency: recognizable affordances, predictable tap/drag/hold and keyboard behavior, terminology, cancellation and recovery from mistakes.
- Feedback, errors and drafts: useful status, unobstructed controls, Apply/Discard/Stay clarity, preservation on Hide/reopen or transitions, and the distinction between applying a change and saving it. Separate demonstrated behavior from simulated prototype flows.
- Desktop/mobile usability and accessibility: portrait and short/landscape layouts, reachability, focus and keyboard paths, accessible names, non-color cues, safe areas and text/control legibility. State what was actually exercised and what remains untested.

Give an overall interface verdict and prioritized general findings even when the strongest finding concerns another surface than Tools. Relate recommendations to the accepted B direction and preservation contracts; distinguish a regression from a design improvement requiring the human's decision. The detailed Tools assessment below complements this wider judgment.

## Required focus: judge the Tools as a coherent set

The human suspects the current mixture of “Tools” may be incoherent and explicitly asks Astra to judge whether it makes sense and whether a more coherent set is possible. Foundry VTT is offered as a reference to investigate, not a specification to copy. Give a direct, reasoned verdict even if the existing arrangement is defensible; cosmetic polish alone does not answer this question.

Inspect the actual corrected interface and its behavior in both Jump Cluster and star system contexts. Build a short inventory that distinguishes:

- Persistent interaction modes, including Navigate and Move / Modify: what changes on the next tap, drag, hold or keyboard action; how the active state is recognized and exited.
- Targeted placement operations, including adding a system, Jump Route, catalogue mark or Orbit: how a type/target is chosen, how completion/cancellation works, and whether the presentation expresses the accepted one-shot Add behavior.
- Panels and selection surfaces, especially Hierarchy and Inspect: whether opening a panel appears to select an interaction mode; how map selection, context navigation and editing relate.
- Immediate commands and file operations, especially Import and Export: whether their position, names and feedback imply persistent modes, and whether their scope and output are clear.

The preparation-time B source has Navigate/Move, context-dependent Add controls, Hierarchy, Import, Export and Inspect in the main rail, with Fields and Theme in the command bar. Re-inspect the published build; this observation is a starting inventory, not the coherence verdict or a frozen design prescription.

Explicitly assess the grouping and hierarchy of **Navigate/Move, Add, Hierarchy, Inspect, Import and Export**, with Fields and the map/context controls where they affect the mental model. Explain which items belong together, which distinctions matter to the Warden, and whether the same arrangement remains understandable as the map context changes. Judge naming, icons, ordering, active/toggle/command states, discoverability and recovery from the wrong action. If recommending a different grouping, describe one concrete alternative and its trade-offs against the current set; preserve all capabilities and explain any changed interaction expectations. The human retains design decisions, and this brief authorizes review recommendations rather than a redesign implementation.

## Mobile reachability and interaction model

Review desktop and mobile portrait plus a short/landscape viewport. Assess how much map remains usable, thumb reach, safe areas, tool count/overflow, readable active mode, target visibility, and whether the user can predict the next map gesture. Distinguish browser emulation from physical input. The human reported the phone as **“Nothing phone 4a pro”**; OS/browser versions are unknown. Do not infer device specifications or claim a physical test.

Evaluate the corrected behavior against the actual human amendments and existing preservation contracts:

- Navigation opens a star system without automatically opening Inspect; return to Jump Cluster is visible and reachable.
- One-finger touch drag in Move still edits. Two-contact navigation cancels uncommitted edit preview and changes only the view; release and the next distinct tap behave normally.
- Long press on an entity in Navigate or Move requests Inspect directly, with cancellation and follow-up-click handling; explicit Inspect remains available.
- One zoom set remains reachable in map mode without rail overlap. The mobile rail sits at the bottom safe area.
- Open mobile Inspect/Hierarchy panels slide from the bottom and hide the tool rail, as Fields does. Inspect retains its accepted full-height presentation; Inspect and Hierarchy are exclusive. Hide/reopen preserves drafts, valid selection, view and context.

Assess these as part of the mental model and reachability review, while clearly separating observed regression, design recommendation and untested physical behavior. The removed duplicate Details entry and duplicate zoom controls must not be treated as reasons to restore duplication. Existing draft guards, keyboard/single-pointer alternatives and application-versus-save semantics remain binding.

## Foundry VTT reference investigation

At review time, consult **official Foundry VTT documentation**, starting from the [official knowledge base](https://foundryvtt.com/kb/), for the documented control/tool organization relevant to the coherence question. This is a targeted reference for the Tools focus; it must not displace the overall interface review or findings on other surfaces. Open the relevant current primary pages and cite their exact URLs and applicable version/date. Establish documented behavior before describing it; this brief makes no claim about how Foundry controls work.

Explain which documented organizing principle, if any, is useful here and why. Separate sourced Foundry facts from Astra's inference about this application. Consider differences in tasks and domain rather than importing a VTT layout wholesale. If the documentation cannot establish a proposed analogy, mark it unverified and base the judgment on the observed application instead.

## Expected review artifact and completion

Write an English review under `research/` and link it from the device/preservation evidence. Lead with an explicit **overall interface verdict**, followed by **prioritized general findings** across the inspected interface, with observed triggers/effects and supporting screenshots or source locations where useful. Include the reviewed build, coverage and limitations, then an explicit **Tools coherence sub-verdict** backed by the detailed inventory/grouping assessment. Include the considered alternative and its trade-offs when recommending a change, the official Foundry citations, and any decisions that require the human's response. A Tools-only report does not satisfy this review.

An independent review is complete when these questions are answered on the corrected published build, with untested paths identified. It does not close the device/preservation task, replace the physical retest, decide final Nuxt UI adoption, or establish production storage/functional parity. [Confirm Nuxt UI adoption from prototype evidence](../tickets/08-confirm-nuxt-ui-adoption.md) remains a separate blocked HITL decision.
