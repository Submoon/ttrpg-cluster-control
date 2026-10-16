---
title: Evaluate Nuxt UI for the revamp without destabilizing map rendering
status: closed
assignee: SOL 6.1 High (research)
label: wayfinder:research
type: research
mode: AFK
parent: "[Revamp the interface: make the map central on desktop and mobile](../map.md)"
---

## Question

Does Nuxt UI provide enough value for the revamp's controls, panels, and dialogs to justify adopting it in this Nuxt SSR application with client-only D3/SVG maps, instead of continuing with the existing Vue components and CSS variables?

## Sources and scope

- Request: [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3), reviewed on 2026-10-13. The issue requests an evaluation, not mandatory adoption.
- Destination: [Revamp the interface: make the map central on desktop and mobile](../map.md).
- Read `package.json`, `nuxt.config.ts`, `components/FieldDefinitionsDialog.vue`, `components/WorkspaceHeader.vue`, `components/MapEditorLayout.vue`, and `assets/css/main.css` to establish the actual need.
- Apply the `research` skill; prefer official documentation and date versions and findings.

## Expected result

A local report linked from `## Resolution`, with compatibility verified against the repository's versions, integration/migration costs, SSR/hydration behavior, keyboard accessibility and dialog focus, CSS-variable themes, weight, and coverage of mobile needs. Compare full adoption, targeted adoption, and keeping the current components. Separate documented facts, unknowns to prototype, and recommendation. The report must enable a later human decision and must not contain product changes.

Data access and D3 rendering are not to be replaced. The scope of other GitHub issues remains separately coordinated. Future implementation will use subagents `gpt-6-luna` at effort `xhigh`; analysis remains `gpt-6.1-sol` at effort `high`.

## Blocked by

None: research is independent of the choice of layout and map navigation.

## Resolution

Research resolved on 2026-10-13 by SOL 6.1 High: [Nuxt UI: compatibility and options for the revamp](../research/nuxt-ui-fit.md).

Nuxt UI 4.11.3 matches the repository's Nuxt 4.6 / Tailwind 4.3 / Vue 3.5 generation and offers useful primitives for dialogs, menus, tooltips, and mobile panels. The report compares broad adoption, targeted adoption, and retaining the existing components, with current official sources, verified licenses and icons, qualitative cost, and SSR, focus, touch, and offline validations. Actual weight and behavior in this application remain to be measured in a future trial; no performance figures are assumed.

Targeted adoption is a proposed experiment, **not an adoption decision**. The final choice remains with a human in the later decision ticket. Nuxt UI replaces neither D3 nor the SVG/PNG pipeline: UI, map, and export themes must be specified separately. The future player-export policy remains in its separate issue. No product change, dependency, branch, or GitHub write was made.
