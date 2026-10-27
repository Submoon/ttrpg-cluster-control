---
title: "Implement the interface revamp through twelve approved delivery tickets"
status: closed
type: implementation-plan
parent: spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# Implementation plan

`spec.md` is the accepted product contract: 120 user stories, the B1–B10 workflow families, preservation requirements, and validation limits. The human approved this twelve-ticket delivery graph on 2026-10-16. All seventeen decision tickets and twelve delivery tickets (18–29) are closed. The [finalization dossier](finalization.md) records final verification and explicit limits.

The initial twenty-slice proposal was rejected as too granular. The approved graph retains all 120 stories and B1–B10 while grouping them into independently reviewable delivery scopes; two independent reviews found no blockers.

## Decision records

Navigation and preservation: [map navigation](tickets/01-map-navigation-boundary.md), [Nuxt UI fit](tickets/02-nuxt-ui-fit.md), [touch and keyboard interactions](tickets/03-touch-keyboard-interactions.md), [B direction](tickets/04-map-first-ui-direction.md), [draft and save guarantees](tickets/05-editor-state-and-preservation.md), [theme, accessibility and export](tickets/06-themes-accessibility-export.md).

Library and evidence: [prototype adoption direction](tickets/07-nuxt-ui-adoption.md), [production Nuxt UI decision](tickets/08-confirm-nuxt-ui-adoption.md), [integration measurements](tickets/09-measure-nuxt-ui-integration.md), [device and preservation findings](tickets/10-validate-b-device-preservation.md). Controls and forms: [tools contract](tickets/11-finalize-tools-contract.md), [control presentation](tickets/12-decide-controls-presentation.md), [mobile Fields flow](tickets/13-decide-mobile-fields-flow.md), [Inspector refinements](tickets/14-decide-inspector-form-refinements.md), [tools prototype](tickets/15-prototype-resolved-tools-contract.md), [Fields prototype](tickets/16-prototype-mobile-fields-flow.md), [Inspector prototype](tickets/17-prototype-inspector-form.md).

The planning branch began at `f4aa1b4438217412c308e61733d862f3d71597ca`, intentionally different from `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. The complete `origin/main` identity is retained in the specification. The original source request, [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3), remains open; local ticket closure does not close it.

| Ticket | Scope | Blocked by |
| --- | --- | --- |
| [18 — Open and recover the real local workspace](tickets/18-open-and-recover-local-workspace.md) | Product-root workspace creation, resume, and recovery. | — |
| [19 — Choose a coherent local light or dark presentation](tickets/19-theme-and-local-resources.md) | Durable theme preference, shared palettes, and local resources. | 18 |
| [20 — Rename charts and recover saved edits](tickets/20-resumable-chart-drafts-and-save-recovery.md) | Resumable drafts, guarded transitions, and save recovery. | 19 |
| [21 — Explore maps through responsive panels](tickets/21-responsive-map-navigation-and-panels.md) | Separate maps, Dock, Hierarchy, Inspect, and compact panels. | 20 |
| [22 — Edit complete object and Orbit data](tickets/22-complete-object-and-orbit-inspectors.md) | Resumable inspectors, geometry, validation, and draft exclusion. | 21 |
| [23 — Create system objects and Orbits](tickets/23-system-object-and-orbit-creation.md) | Persistent targeted Add and complete catalogue creation. | 22 |
| [24 — Construct clusters and Jump Routes](tickets/24-cluster-systems-and-jump-routes.md) | Repeated system creation, cluster movement, and route editing. | 23 |
| [25 — Manipulate objects and Orbit geometry safely](tickets/25-safe-system-object-and-orbit-manipulation.md) | Attachment, movement, Orbit controls, and input arbitration. | 23 |
| [26 — Consult, edit, and create Fields](tickets/26-resumable-fields-lifecycle.md) | Resumable Fields lifecycle and reviewed value impacts. | 22 |
| [27 — Review destructive changes and JSON copies](tickets/27-reviewed-deletion-and-json-interchange.md) | Cascade reviews, independent imports, and current JSON. | 24, 26 |
| [28 — Export complete SVG and PNG](tickets/28-clean-themed-svg-png-exports.md) | Applied full-scene output in active or print-light palettes. | 21 |
| [29 — Finish cleanup and validate the product](tickets/29-final-cleanup-and-product-validation.md) | Documentation, prototype retirement, final checks, performance, and whole-interface review. | 25, 27, 28 |

Tickets 18–29 retain their scoped outcomes and exact distinctions between complete runs, focused retests, failures, and unavailable physical-device checks. Ticket 29 records final product-wide verification. Android mobile acceptance targets Chrome; no physical-device pass is implied by browser emulation. The source issue and any release decision remain separate from this local plan.
