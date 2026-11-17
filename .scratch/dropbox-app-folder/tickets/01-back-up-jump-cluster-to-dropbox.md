---
title: Back up a Jump Cluster to Dropbox
status: closed
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 01. Back up a Jump Cluster to Dropbox

[Back up and restore a Jump Cluster with Dropbox](../spec.md)

## What to build

Let a Warden save a complete dated Jump Cluster JSON from **Map files** to the application's Dropbox App Folder. Show the saved name and destination after Dropbox confirms the create. This slice provides browser authorization for the restore workflow.

## Blocked by

None. This ticket uses the existing complete Jump Cluster JSON export.

## Acceptance criteria

- [x] From **Map files**, show Dropbox App Folder as the destination and explain that the backup can include GM notes. Start authorization on the Warden's action using a configured App Folder app and OAuth authorization code with PKCE S256. Keep credentials short-lived and in memory. Document the configuration, required file scopes, and the supported-account verification plan.
- [x] Capture the complete applied Jump Cluster once when the Warden starts the backup. Use the same versioned JSON as the local export. Later edits and unapplied drafts stay under the editor's ownership.
- [x] Send the file directly from the browser to Dropbox. Create a distinct dated file per backup action without replacing an existing copy. Use the returned filename and App Folder location in the confirmation after the provider acknowledges the save.
- [x] Preserve local editing, autosave, file download and restore, and previous Dropbox backups when the service is unavailable or when authorization or upload is denied, canceled, or fails.
- [x] Reconcile an uncertain upload against the captured bytes, intended path, and authorized account. A retry resolves to the same logical backup and preserves previous copies. Show an unresolved result when Dropbox cannot verify what happened.
- [x] Use controlled provider responses at the backup boundary to verify authorization and callback handling, capture, confirmed and uncertain writes, path collisions, retries, and cancellation.

## Resolution

Integrated the Dropbox OAuth and backup core in `6c203df3` and the Map files entry and setup documentation in `5448d9d8`. The focused authorization and backup checks passed with 20 controlled tests. The real save and restore acceptance check belongs to [Restore a Jump Cluster from Dropbox](02-restore-jump-cluster-from-dropbox.md).
