---
title: 'Export clean complete SVG and PNG in active or print light palettes'
status: closed
assignee: ticket28
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 28: Export clean complete SVG and PNG in active or print light palettes

## Scope

Stories 112–116; checks 15, 55–57, 82–93, 99–100, 103–110, 120. Families B1, B4, B7, B9–B10. Deliver complete clean SVG/PNG exports in the active or independent print-light palette under the [specification](../spec.md#user-stories).

## Resolution

Completed 2026-10-22 from feature baseline 8d98fa04c17e5b5444ae5f8c965029e0c89dd599. Exports use applied geometry, remove transient elements before measuring bounds, add the current system title, and apply print-light styling only to the export. Live camera, selection, drafts, tools, save state, and browser theme remain unchanged.

Typecheck/build pass. The sole complete run is 185/190; five test expectation/setup/budget issues were corrected and verified through focused retests on unchanged application/compiled hashes. All ten new export cases pass across these retests. No fresh 190/190 run is claimed. Physical Android Chrome checks remain unavailable. See the [original QA record at cleanup baseline](https://github.com/Submoon/ttrpg-cluster-control/blob/cf469857862565c58047fee98f8f174bee845c7c/.scratch/interface-revamp/implementation-lab/ticket-28-2026-10-22/qa/README.md).
