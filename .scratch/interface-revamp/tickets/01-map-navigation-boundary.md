---
title: Set the revamp's navigation boundary against future semantic zoom
status: closed
assignee: SOL 6.1 High
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../spec.md
---

## Resolution

Resolved 2026-10-13. Keep Jump Cluster and star-system maps separate; continuous unified navigation and semantic zoom remain a separate effort. Navigate opens a system on deliberate pointer or keyboard activation. Keep the current context visible and provide an explicit accessible return to the Cluster.

Remember each visited view's temporary pan, zoom and still-valid selection; fit a first visit and clear stale selections. This state is not workspace data or export content. Context changes use the accepted draft guard; refusal keeps the current context and work.
