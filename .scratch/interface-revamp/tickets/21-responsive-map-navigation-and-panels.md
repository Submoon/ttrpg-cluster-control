---
title: 'Explore separate maps through the responsive Dock, Hierarchy and Inspect'
status: closed
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 21: Explore separate maps through the responsive Dock, Hierarchy and Inspect

## Scope

Stories 4–20, 23, 50, 53–54; checks 21–22, 24, 28–32, 44–46, 59, 82–86, 96, 105–111, 119–120. Families B1–B5 and B9. Deliver separate maps, bottom Dock, desktop overlays, and exclusive compact panels under the [specification](../spec.md#user-stories).

## Resolution

Completed 2026-10-19 against the corrected B/Dock contract. The real persisted editor now uses a bottom Dock, one bottom-right zoom set, an uninterrupted map, optional resizable desktop overlays, compact context chrome, and exclusive fullscreen compact panels. Nuxt UI controls and Dashboard panels are adapted while mounted editor sessions are retained.

The sole full suite is 74 passed / 25 failed of 99; attributed failed cases receive focused retests, with the final blocker sequence 7/10, then 2/3, then 1/1. This is not a single-run 99/99 result. Typecheck, build, source reviews, paired presentation checks, and the 48/48 cue supplement pass their recorded scope. Compiled candidate gel10 changed only test prerequisites after gel8; application hashes match. Physical Android Chrome, OS-keyboard, safe-area, and gesture checks remain unavailable. See the [original final QA record at cleanup baseline](https://github.com/Submoon/ttrpg-cluster-control/blob/cf469857862565c58047fee98f8f174bee845c7c/.scratch/interface-revamp/implementation-lab/ticket-21-resume-2026-10-19/qa/final-gate-report.md).
