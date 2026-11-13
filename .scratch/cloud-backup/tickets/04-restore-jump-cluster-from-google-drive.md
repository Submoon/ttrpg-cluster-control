---
title: Restore a Jump Cluster backup from Google Drive
status: closed
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 04. Restore a Jump Cluster backup from Google Drive

[Back up and restore a Jump Cluster](../spec.md) · [Cloud provider comparison](../provider-research.md)

## What to build

Let a Warden list dated backups in the app's private Google Drive space in the editor, on the welcome screen, or on the damaged-workspace recovery screen. Let them download a copy or restore the selected file through the same workflow as a local file. Verify the full Drive backup and recovery journey before delivery.

## Blocked by

- [Restore a local Jump Cluster backup from welcome and recovery](02-restore-local-backup-from-welcome-and-recovery.md), which extends the common restore workflow to all three entry points.
- [Back up a Jump Cluster to Google Drive](03-back-up-jump-cluster-to-google-drive.md), which supplies browser authorization, app-data access, and the upload for the round trip.

## Acceptance criteria

- [x] A Warden can authorize Drive and choose a dated backup from the app's list at each entry point, including in a fresh browser profile with no prior site state. A Warden can download a listed file as portable JSON without changing the workspace.
- [x] The editor uses the same replacement review, pre-replacement download, draft consent, and durable commit as file restore. Welcome and recovery follow the same installation and recovery-record rules as local file restore.
- [x] Provider denial, cancellation, download failure, invalid content, and stale requests leave local state intact. The provider flow runs outside the local write queue until the confirmed restore is ready to commit. Local editing, autosave, file restore, and last-valid recovery remain available independently.
- [x] Before delivery, verify the end-to-end flow with a real Google Drive test account and two isolated browser profiles on a configured origin. Confirm the dated filename after upload, recover from the app-space list in the second profile, and verify that restore and JSON download preserve GM notes, player publication, Fields, routes, and layout.
- [x] Record live-provider evidence separately from controlled checks. Document the applicable Google OAuth production and brand configuration for public rollout.

## Verification

Use controlled provider responses for failed, invalid, and obsolete downloads and one representative browser path for the Drive-to-restore handoff. Rely on the existing local restore coverage for shared validation and persistence behavior. Complete the live two-profile check before delivery. Follow the project's Sensitive development route.

## Resolution

The [live verification](../spec.md#live-verification) records the real Drive upload, download, and editor replacement, and the tester's confirmation that welcome restore survived reload in a separate private browsing window. The controlled fresh-context browser check compared the complete saved data after restoring from welcome.
