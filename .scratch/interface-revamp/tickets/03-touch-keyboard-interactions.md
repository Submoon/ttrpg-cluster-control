---
title: Decide touch, mouse, and keyboard map gestures and controls
status: closed
assignee: SOL 6.1 High
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../spec.md
---

## Resolution

Resolved 2026-10-13; ticket 11 later amends the tool model and controls. Preserve explicit user intent, validated targeting, safe attachment and Orbit manipulation, and complete keyboard and single-pointer alternatives. Invalid or ambiguous targets must not mutate data. Navigation takeover cancels only an unfinished preview, never an earlier committed edit or editor draft.

Ticket 11 is authoritative for Select, persistent Add, right-button pan and route-progress retention. The normative behavior and 120-story coverage are in the [specification](../spec.md#user-stories).
