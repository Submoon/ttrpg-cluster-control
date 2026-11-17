---
title: Restore a Jump Cluster from Dropbox
status: in-progress
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 02. Restore a Jump Cluster from Dropbox

[Back up and restore a Jump Cluster with Dropbox](../spec.md)

## What to build

Let a Warden locate and open a saved Dropbox backup from the welcome screen, local recovery, and the editor. Use the authorization and backup destination delivered by the backup ticket. Verify that a complete off-device backup can be restored from a fresh browser profile.

## Blocked by

- [Back up a Jump Cluster to Dropbox](01-back-up-jump-cluster-to-dropbox.md) provides browser authorization and creates the files needed for the live save and restore check.

## Acceptance criteria

- [x] List backups for the authorized account in Dropbox App Folder, including continuation pages. Show filenames and dates. Bind the selection and download to that account and refresh the list if it changes.
- [x] Provide Dropbox restore in the editor, on the welcome screen, and on the local recovery screen. Download the selected file directly from Dropbox in the browser and pass it through the existing portable Jump Cluster admission and workspace restore.
- [x] With an active Jump Cluster, reuse the existing replacement review, pre-replacement local download, and draft consent. Confirm success after the local replacement commits. Retain the recovery copy, fresh undo baseline, and stale-tab write protection defined by the existing restore contract.
- [x] Reject invalid, unsupported, or incompatible data before modifying local state. A canceled selection or review, a failed transfer, a failed local commit, or stale consent preserves the current local data under the shared restore rules. Local JSON restore remains available offline.
- [x] Cover Dropbox-specific listing, download, and failure behavior at the existing controller boundary. Verify UI wiring with a representative browser journey and real IndexedDB.
- [ ] Before delivery, save a synthetic Jump Cluster using Dropbox Personal from one browser profile and restore the exact backup in a fresh isolated profile with the same account. Verify GM notes, Fields, player publication settings, relationships, saved layout, and persistence after reload. Repeat for each additionally supported account type and record the real results separately from controlled tests.

## Verification

The integration branch contains the Dropbox restore entry points and controller. The targeted Chromium run passed the two-profile save and restore using controlled Dropbox responses and real IndexedDB. The exported Jump Cluster after reload matched the original JSON data exactly.

The live Chrome attempt reached Dropbox sign-in. Dropbox reported that the CAPTCHA response could not be verified, and the application received no OAuth callback. On 2026-11-17 the user reported that the manual Firefox test with the Dropbox Personal account succeeded. The real-account result is operator-reported. The exact JSON comparison above used controlled provider responses.
