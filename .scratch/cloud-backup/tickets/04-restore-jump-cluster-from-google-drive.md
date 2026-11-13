---
title: Restore a Jump Cluster backup from Google Drive
status: open
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

Let a Warden open a complete backup from Google Drive in the editor, on the welcome screen, or on the damaged-workspace recovery screen. Send the selected file's original bytes through the same validation and restore workflow as a local file. Verify the full Drive backup and recovery journey before delivery.

## Blocked by

- [Restore a local Jump Cluster backup from welcome and recovery](02-restore-local-backup-from-welcome-and-recovery.md), which extends the common restore workflow to all three entry points.
- [Back up a Jump Cluster to Google Drive](03-back-up-jump-cluster-to-google-drive.md), which supplies browser authorization, Picker, and a real uploaded backup for the round trip.

## Acceptance criteria

- [ ] A Warden can authorize Drive and select a backup from each entry point, including in a fresh browser profile with no prior site state. Accept valid supported complete Jump Cluster files, including a valid JSON file uploaded independently of the app.
- [ ] The editor uses the same replacement review, pre-replacement download, draft consent, and durable commit as file restore. Welcome and recovery follow the same installation and recovery-record rules as local file restore.
- [ ] Provider denial, cancellation, download failure, invalid content, and stale requests leave local state intact. The provider flow runs outside the local write queue until the confirmed restore is ready to commit. Local editing, autosave, file restore, and last-valid recovery remain available independently.
- [ ] Before delivery, verify the end-to-end flow with a real Google Drive test account and two isolated browser profiles on a configured origin. Confirm a dated backup's filename and location in a private folder, refusal of a shared destination, and recovery in the second profile with GM notes, player publication, Fields, routes, and layout intact.
- [ ] Record live-provider evidence separately from controlled checks. Document the applicable Google OAuth production and brand configuration for public rollout.

## Verification

Use controlled provider responses for failed, invalid, and obsolete downloads and one representative browser path for the Drive-to-restore handoff. Rely on the existing local restore coverage for shared validation and persistence behavior. Complete the live two-profile check before delivery. Follow the project's Sensitive development route.
