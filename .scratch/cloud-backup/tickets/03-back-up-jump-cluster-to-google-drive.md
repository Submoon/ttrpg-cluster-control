---
title: Back up a Jump Cluster to Google Drive
status: in-progress
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 03. Back up a Jump Cluster to Google Drive

[Back up and restore a Jump Cluster](../spec.md) · [Cloud provider comparison](../provider-research.md)

## What to build

From **Map files**, let a Warden save a dated Jump Cluster backup directly to a private My Drive folder they select. Show where Drive saved the new file once it confirms the write. Deliver the browser authorization and Picker integration that the restore action can reuse.

## Blocked by

None. This ticket can start immediately using the existing complete Jump Cluster export format.

## Acceptance criteria

- [ ] The backup captures one detached, complete applied Jump Cluster at the initial click. Later edits, pending drafts, and gestures do not alter the backup. Local editing and autosave can continue while the Warden authorizes Drive, chooses a folder, or uploads.
- [ ] Use Google Identity Services, Google Picker, and short-lived `drive.file` authorization in the browser. Transfer the existing JSON bytes directly to Drive and load the provider on demand. Local workflows work when provider configuration, consent, or connectivity is unavailable.
- [ ] Before upload, verify that the Warden owns the selected writable My Drive folder and that the complete effective permissions establish private access. Refuse shared and indeterminate destinations. Bypass Workspace domain default visibility without changing sharing permissions. Keep the Warden in control of later sharing.
- [ ] Each backup creates a distinct dated file. Report the confirmed filename and destination after Drive acknowledges the completed create. A denied, canceled, failed, or ambiguous operation preserves local data and earlier files. Reconcile a lost acknowledgement against the same file identity when possible so a retry does not duplicate a logical backup.
- [ ] Document the test origin, account setup, and verification results for the actual folder selection, permission check, and upload with an allowlisted account. Record which private, shared, and indeterminate cases were exercised.

## Verification

Use controlled provider responses for snapshot timing, privacy refusal, cancellation, unavailable configuration, uncertain acknowledgement, and retry. Verify the write with a real Drive account and synthetic map data. The full two-profile round trip is a delivery check in ticket 04. Follow the project's Sensitive development route.
