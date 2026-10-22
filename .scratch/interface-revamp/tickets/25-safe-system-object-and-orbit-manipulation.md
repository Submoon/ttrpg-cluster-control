---
title: 'Reposition objects and manipulate Orbit geometry safely'
status: closed
assignee: ticket25
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 25: Reposition objects and manipulate Orbit geometry safely

## Scope

Stories 38–43; checks 21–23, 34–37, 44–46, 49–54, 60, 63, 82–93, 96, 107–110, 120. Families B1–B5, B7, B9. Preserve safe object/system movement, attachment, Orbit geometry, and gesture arbitration from the [specification](../spec.md#user-stories).

## Resolution

Completed 2026-10-21 from feature baseline 8d4b67841956e22e5b9d1269724845c902770121. The human-approved drag-out detachment, explicit overlap choices, precise placement controls, host/geometry validation, dependent geometry, and gesture cancellation are supported without changing durable formats.

Typecheck/build pass. The complete suite passes 161/161 in 14.9 minutes with one worker and no retries, skips, or flakes; the earlier 158/161 candidate remains separate. A later hosted-object drag correction passes 14/14 focused cases with typecheck/build and independent review; the full suite was not rerun after it. Physical Android Chrome, OS-keyboard, and safe-area evidence remains unavailable. See the [original final QA record at cleanup baseline](https://github.com/Submoon/ttrpg-cluster-control/blob/cf469857862565c58047fee98f8f174bee845c7c/.scratch/interface-revamp/implementation-lab/ticket-25-2026-10-21/qa/README.md).
