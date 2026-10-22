---
title: 'Rename charts with resumable drafts and trustworthy Apply/save recovery'
status: closed
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 20: Rename charts with resumable drafts and trustworthy Apply/save recovery

## Scope

Stories 66, 82–93, 99, 117; checks 7, 14, 23, 54–57, 100, 106, 109–110, 120. Families B1, B4, B5, B7, B9. Preserve parent-owned chart sessions, guarded transitions, memory-first Apply, ordered durability, latest-memory Retry, and backup recovery under the [specification](../spec.md#user-stories).

## Resolution

Completed 2026-10-19 at source candidate 65f6cc2cd910e4e05644dbc1e304ae2055f78106, following chart-feedback candidates ffa10250 and dc7861d7. The existing session and storage owners remain authoritative. Compact feedback, truthful save status, direct recovery controls, and overlay-aware Fit correct the scoped composition and reachability defects.

Typecheck passes; the corrected shared-interface build passes 28/28 compiled checks. The final CSS-only candidate passes 3/3 affected tests, 27/27 compact observations, and 37/37 details/focus observations. The only repository-suite attempt exits 1, but its temporary report is unrecoverable, so counts and cause are unknown; no full-suite pass is claimed. Physical Android Chrome checks remain unavailable. The [original QA record at cleanup baseline](https://github.com/Submoon/ttrpg-cluster-control/blob/cf469857862565c58047fee98f8f174bee845c7c/.scratch/interface-revamp/implementation-lab/ticket-20-resume-2026-10-19/qa/final-summary.md) preserves exact test/runtime identities and failures.
