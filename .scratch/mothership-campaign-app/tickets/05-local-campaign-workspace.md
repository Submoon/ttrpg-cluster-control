---
title: 05. Creating and restoring a local campaign workspace
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
triage_labels:
  - enhancement
  - ready-for-agent
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 05. Creating and restoring a local campaign workspace

## What to build

As a Warden, I can start a campaign without an account, create a local workspace with a Jump Cluster and its first star system, and return to that work later. Committed edits save automatically; if a save fails, the app makes the unsaved state clear instead of implying the campaign is safe.

## Acceptance criteria

- The Warden can use the app without an account or remote workspace API.
- The Warden can create a local workspace containing a Jump Cluster and its first star system.
- Returning to or reloading the app restores that workspace and its committed edits from browser storage.
- Committed edits are saved transactionally in IndexedDB after application hydration.
- A failed write is surfaced as an unsaved/error state; the app never reports the failed edit as saved.

## Blocked by

- None — can start immediately.

## Source specs

- [Mothership Campaign App - V1 Specification](../spec.md)
- [04. Choosing the V1 application and rendering architecture](04-application-architecture.md)

## Resolution

- The Nuxt app creates a browser-local workspace with a Jump Cluster, its first star system, and a primary star.
- It restores the workspace after hydration and saves committed name edits in IndexedDB transactions. Failed saves remain visibly unsaved and do not replace the last stored workspace.
