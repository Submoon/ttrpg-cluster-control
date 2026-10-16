# Inspector form refinement decisions

## Scope and baseline

Work the existing [inspector-form decision](../tickets/14-decide-inspector-form-refinements.md), following the human's request to continue Wayfinder after accepting Fields. This is analysis and human decision work, without application changes. Preserve the selected B/Dock, exclusive fullscreen mobile Inspect/Hierarchy, accepted Fields flow and existing draft/save/impact contracts.

Fresh `origin` fetch confirms `346984f80226f9db2a44ae160d68f492f85e611b`, intentionally 0 main-only / 16 feature-only versus `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Source issue 3 remains open with unchanged requirements and no comments. Analysis and the read-only code audit use SOL 6.1 High; any future prototype code belongs to Luna XHIGH. The coordinator owns planning and Git operations.

## Read-only audit

The delegated audit checks the actual prototype, baseline inspectors, catalogue labels and [Astra's global review](astra-interface-review-2026-10-15.md). It changes no files and provides source-only evidence, without browser measurements.

- [Prototype inspector](../../../components/PrototypeInspector.vue): name at line 15; object/system/chart “Session notes” at line 19; route level/unresolved exit and endpoint summary at lines 23–30; object native/custom fields and Manage at lines 33–59; actions, validation, simulated save feedback and Delete at lines 62–79. Name is presented as Route name, Chart label or Name according to selection. Custom text values currently use a single-line input; the baseline uses a textarea.
- Form controls lack explicit full-width styling; actions follow the fields without sticky positioning. The mobile Hide header is already sticky. Astra reports narrow name/notes controls and excessive travel to actions at lines 62–66 of its review. This audit confirms the source structure, without measuring rendered width.
- [Workbench](../../../components/PrototypeWorkbench.vue), line 311: object eyebrow directly uppercases stored family/subtype, producing technical spellings such as CELESTIALBODY or JUMPPOINT. The catalogue already supplies readable subtype names and the picker readable family labels. Reuse existing catalogue/domain vocabulary rather than inventing another taxonomy or changing stored identifiers.
- Workbench lines 400 and 685–686 map an object's “Session notes” to its existing `description`. The [baseline object inspector](../../../components/inspector/MapObjectInspector.vue), line 182, calls this Description. A separate seeded custom definition is named Session note at Workbench line 1361. These are distinct field identities.

## Baseline parity boundaries

The prototype remains incomplete; accepting its layout must not turn omissions into scope cuts:

- Baseline object editing also exposes Other's Type label, Location key, Placement, an optional physical Jump Station association and conditional Schematic X/Y. See the baseline object inspector lines 15–76 and 159–190.
- [Baseline Orbit editing](../../../components/inspector/OrbitInspector.vue), lines 15–106, exposes horizontal/vertical radii, unoccupied Center X/Y, reordering and Detach. Prototype Orbit Name has no corresponding Apply mutation at Workbench lines 674–704.
- [Baseline route editing](../../../components/inspector/JumpRouteInspector.vue), lines 64–102, edits the From Jump Point, destination kind and To Jump Point; the prototype displays their summary.
- The prototype's system Apply changes the name and ignores displayed Session notes, while the chart fallback is not complete chart editing. These paths must not claim functional acceptance through a cleared draft or success toast. Baseline chart-name fields are in [ChartDetailsPanel](../../../components/inspector/ChartDetailsPanel.vue), lines 19–22.
- A focused follow-up confirms that baseline Jump Cluster and Star system text controls are names only: those domain types have no description property (`workspace-model.ts`, lines 121 and 128). Description applies to an actual object's `description`; it must not turn the prototype's unsupported system/chart Session notes into new stored fields. Baseline object labels are Name and Description. The prototype's Chart label edits the same object `name`, so existing wording can be restored without introducing another concept.
- Reuse readable catalogue names while preserving an Other object's existing custom subtype text. Do not replace that custom text indiscriminately with Other.
- Saves are simulated at Workbench lines 712–720. No storage durability or complete product parity follows from this analysis.

## Human decision rounds

### Round 1 — confirmed

The human explicitly accepts both recommendations:

1. A single form with visible sections adapted to the selection; one column on phones; names and notes use the available width; short controls may share two columns on desktop. No tabs or default-collapsed sections.
2. A persistent bottom Apply / Discard changes bar during form scrolling, with Hide accessible at the top. Hide retains the draft; Discard changes explicitly drops it. The content scrolls in the remaining space, including a reduced viewport with the mobile keyboard.

The Fields Bottom choice is an input; this round explicitly confirms its persistent-action adaptation for Inspect.

### Round 2 — confirmed

The human explicitly accepts both recommendations:

3. Use Description for the built-in object text. Keep the custom Session note definition's own name and visually distinguish native/custom values without changing field identities or data.
4. Keep ordinary actions, compact save status and accessible validation/save feedback at the bottom. Show errors beside the affected controls and make those controls reachable from feedback. Keep Delete in a separate final section with consequence review before confirmation.

## Handoff

The [inspector-form decision](../tickets/14-decide-inspector-form-refinements.md#resolution) is closed on these explicit answers. A separately prepared [focused inspector prototype](../tickets/17-prototype-inspector-form.md) will test the confirmed layout and labels; it starts open and unclaimed. No application code, browser measurement or prototype acceptance is supplied by this analysis. Existing draft/persistence contracts, baseline parity, selected B/Dock and accepted Fields remain authoritative.
