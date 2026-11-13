---
title: Replace the active Jump Cluster from a local backup
status: in-progress
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - bug
  - ready-for-agent
---

# 01. Replace the active Jump Cluster from a local backup

[Back up and restore a Jump Cluster](../spec.md) · [Portable restore decision](../../../docs/adr/0003-restore-complete-jump-cluster-backups.md)

## What to build

From **Map files**, a Warden can open a complete local Jump Cluster JSON backup and replace the active map after review. **Add a star system** continues to append an independent copy of a standalone system through its existing review.

## Blocked by

None. This ticket can start immediately.

## Acceptance criteria

- [ ] A supported complete Jump Cluster file restores its original cluster identity and content, including GM notes, Fields, player title and publication settings, relationships, and saved layout. Supported legacy backups follow their existing migrations. Invalid or unsupported files, player documents, and standalone system files are rejected by the full restore action before local state changes.
- [ ] The replacement review names the active and incoming clusters and offers a local JSON download of the active cluster. Explicit confirmation is required. The review gives the Warden a way to return to editing when drafts exist and obtains consent to discard them only upon successful replacement.
- [ ] If the active workspace, applied revision, or reviewed draft consent changes, refresh the review and obtain confirmation again before replacing it.
- [ ] The existing persistence owner commits the replacement in IndexedDB before publishing it. Success installs a fresh browser-local workspace identity and an empty undo and redo history. The displaced valid cluster becomes the rolling last-valid snapshot. A tab holding the displaced workspace cannot overwrite the restored one.
- [ ] Cancellation and a failed write preserve the active cluster, drafts, history, and durable recovery records.
- [ ] **Add a star system** accepts a standalone system and preserves the existing reviewed append, relationship remapping, Field compatibility, and undo behavior. Complete cluster restore has its own entry point. Both local workflows work with Drive disconnected.

## Verification

Reuse portable format and publication tests for exact round trips and legacy admission. Exercise stale review and failed commit at the operation boundary. Verify the editor path with real IndexedDB, including confirmation and download, draft and history outcomes, and a write attempt from an obsolete tab. Update user-facing documentation that describes full-cluster append import. Follow the project's Sensitive development route.
