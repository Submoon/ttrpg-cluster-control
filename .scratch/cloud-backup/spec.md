---
title: Back up and restore a Jump Cluster
status: open
triage_labels:
  - enhancement
  - ready-for-agent
---

# Back up and restore a Jump Cluster

The user confirmed Google Drive for the first delivery after the [cloud provider comparison](provider-research.md) and required a live Drive round trip before delivery.

## Source issue

[Back up and recover maps using cloud storage — GitHub #51](https://github.com/Submoon/ttrpg-cluster-control/issues/51), fetched on 2026-11-13. The issue is open with the `enhancement` label and no comments. Its first delivery calls for explicit backup and restore through one provider, the existing portable format, Warden-selected storage, a complete round trip in a fresh browser, confirmation from the provider before reporting success, and continued offline local workflows. The [approved scope and provider comparison](analysis.md) also cover correcting the existing append behavior for full local Jump Cluster JSON files.

Baseline after fetching `origin` is `efd9b094634cf60d6c466f612df11cf9573b6b33`. Detached HEAD, `main`, and `origin/main` agree.

Implementation starts at `dfe07f7d9a7cd0a8f8e300b68c9467b7262dc59d` after fetching `origin` and fast-forwarding `main`. The integration branch is `codex/issue-51-cloud-backup`.

## Problem Statement

Wardens can lose the local copy of a Jump Cluster when they clear site data or switch browser profiles. They can download a complete JSON file today, but the import action adds systems and routes to an existing cluster. A Warden who wants to resume work from a backup needs to open the saved Jump Cluster with its GM notes, player publication settings, relationships, and layout intact.

## Solution

**Map files** offers a manual Google Drive backup of the applied Jump Cluster alongside the existing local JSON download. The Warden chooses a verified private folder. Each backup creates a dated file. The Warden can restore a Jump Cluster backup from Drive or disk on the welcome screen, on the local recovery screen, or from the editor. Opening a backup in the editor previews the replacement and requires confirmation. Adding a standalone star system remains a separate action.

## User Stories

1. As a Warden, I want to start a Google Drive backup from Map files so that I can keep an off-device copy of my work.
2. As a Warden, I want to choose my own private folder so that I can find the backup in Drive and manage its access there.
3. As a Warden, I want to authorize access only to selected or app-created Drive items so that I can use the feature without giving the app access to all of Drive.
4. As a Warden, I want the file to reflect the applied state when I click **Back up to cloud storage** so that later edits and pending drafts do not change that backup.
5. As a Warden, I want each backup to create a new dated file so that I can keep earlier copies.
6. As a Warden, I want the actual filename and destination after Drive confirms the write so that I can find the file and know it was saved.
7. As a Warden, I want clear feedback if I select a shared folder, deny consent, or encounter an upload whose outcome is uncertain so that I can choose a private folder or retry safely.
8. As a Warden, I want to open a complete backup from disk or Drive in a fresh browser so that I can resume my preparation without creating a placeholder cluster.
9. As a Warden, I want the restored cluster to retain its names, GM notes, Fields, player publication, routes, and saved layout so that I can resume with the same map.
10. As a Warden, I want local file and Drive choices on the recovery screen alongside the browser's last valid snapshot so that I can recover even when the current local record is damaged.
11. As a Warden, I want to see the active and incoming cluster names and be able to download the active cluster before confirming replacement so that I can keep both copies if I need them.
12. As a Warden, I want to return to editing or confirm the discard of unapplied changes so that a canceled or failed replacement preserves my drafts.
13. As a Warden, I want a successful replacement to start a fresh undo history so that editing the restored map begins from its own baseline.
14. As a Warden, I want invalid files and failed local writes to leave my current work and recovery copy intact so that I can try again safely.
15. As a Warden, I want a tab holding the previous map to be unable to overwrite the restored map so that reopening the site reliably shows the restored work.
16. As a Warden, I want a separate **Add a star system** action so that I can bring a single system into an existing cluster.
17. As a Warden, I want local editing, autosave, JSON download, file restore, and star-system import to remain available with Drive disconnected or offline so that I can continue my work.

## Implementation Decisions

### Backup files and Drive

- Use the existing versioned Jump Cluster JSON format for both disk and Drive. Use the same complete applied data as the local cluster download. Preserve the source cluster's identity, geometry, GM notes, player share title and publication settings, Field definitions and values, relationships, and saved layout. Drafts, temporary editor state, browser-local workspace identity, and undo history are outside the file contract.
- Capture one detached snapshot at the initial backup click. Keep draft and gesture state under the editor's ownership. Authorization, destination selection, upload, and feedback operate on the captured file while editing and local autosave continue independently.
- Use Google Identity Services with short-lived browser access and `drive.file`, Google Picker for folder and file selection, and direct browser-to-Drive transfer. Keep credentials and tokens within the authorized browser flow. Load the provider on demand so local actions are usable when configuration, connectivity, or authorization is unavailable.
- Allow a Warden-selected writable private My Drive folder only when its effective access can be verified before upload. Refuse shared or unverifiable folders. Leave sharing permissions under the Warden's control, and bypass domain default visibility on file creation. Verification is a point-in-time check. Drive can apply later permission changes to existing files. [Drive sharing](https://developers.google.com/workspace/drive/api/guides/manage-sharing) · [File creation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create)
- Create a new dated file for each backup. Show the actual filename and destination after Drive confirms the completed create. Preserve previous files on cancellation, failure, or retry. A lost response after dispatch can leave the outcome uncertain. Reconcile against the same provider file identity when possible so retrying one operation does not create duplicates. [Drive upload guidance](https://developers.google.com/workspace/drive/api/guides/manage-uploads)

### Opening and replacing a Jump Cluster

- Both local file and Drive choices pass through one admission and restoration contract. Admit supported complete Jump Cluster backups, including supported older versions, and reject damaged or unsupported files before modifying local state. A player document or standalone star-system file is ineligible for complete restore. The separate **Add a star system** action uses the existing reviewed system import semantics and associated compatibility checks.
- Offer disk and Drive restore from the welcome screen of a fresh profile, the damaged-workspace recovery screen, and the editor. The damaged-workspace screen retains **Restore last valid backup** alongside those choices.
- For an active cluster, show both names, offer a local download of the active cluster, and require explicit confirmation. If there are drafts, offer to return to editing or confirm their discard once the replacement commits. Keep the active cluster, drafts, and history available on cancellation or failure. Revalidate the review against the active workspace and revision before committing. Require a fresh review if the data or the draft consent changes.
- Serialize the final replacement through the existing local persistence owner. Install the validated cluster in IndexedDB before publishing it to the editor. Preserve the displaced healthy cluster in the rolling last-valid slot, or keep the valid recovery snapshot when replacing a damaged record. If the write fails, preserve the previous durable records and editor state. Start the restored cluster with a fresh browser-local workspace identity and empty undo and redo history. Reject writes from stale tabs holding a displaced workspace.

## Testing Decisions

- At the portable format boundary, verify complete round trips for current and supported older Jump Cluster backups, exact retention of private and publication data, and rejection of incompatible input. Continue covering standalone star-system compatibility separately. Reuse the established workspace codec and publication-data coverage.
- At the operation boundary, exercise the real backup and restore orchestration with controlled provider and storage responses. Cover capture at the initial click, denied or canceled provider actions, rejection of shared or unverifiable destinations, confirmed versus uncertain writes, stale review, and unsuccessful local commit. Assert outcomes through operation results, retained files and snapshots, and visible state.
- Use representative browser journeys and real IndexedDB to verify the local file entry points, replacement confirmation and pre-replacement download, draft and history lifetimes, rolling recovery, and stale-tab write protection. Build on the current reviewed-import and local recovery journeys and keep deterministic cases at their narrower boundaries.
- Before delivery, verify a real Drive round trip across two isolated browser profiles with an allowlisted account and a configured browser origin. Exercise the private folder path, refusal of a shared folder, the reported filename and destination, and complete recovery from the saved file. Record live-provider results separately from controlled browser coverage.

## Out of Scope

- Additional cloud providers are tracked separately in [Dropbox #55](https://github.com/Submoon/ttrpg-cluster-control/issues/55) and [OneDrive #56](https://github.com/Submoon/ttrpg-cluster-control/issues/56).
- Automatic cloud backups or synchronization, collaboration, and an application-operated storage service.
- A separate long-term library of displaced local workspaces. Retention is via the existing rolling recovery slot, the offered local download, and Warden-managed backup files.
- Changes to the player document format, player publication workflows, or the portable Jump Cluster file format.

## Further Notes

Local restore and Drive backup affect persistence and private data. Follow the project's Sensitive development route. A live provider check needs a configured Google Cloud project, authorized browser origins, and an allowlisted test account. Public rollout requires the applicable OAuth production and brand configuration. [OAuth production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview) · [Brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)

## Implementation tickets

1. [Replace the active Jump Cluster from a local backup](tickets/01-replace-active-jump-cluster.md)
2. [Restore a local Jump Cluster backup from welcome and recovery](tickets/02-restore-local-backup-from-welcome-and-recovery.md)
3. [Back up a Jump Cluster to Google Drive](tickets/03-back-up-jump-cluster-to-google-drive.md)
4. [Restore a Jump Cluster backup from Google Drive](tickets/04-restore-jump-cluster-from-google-drive.md)
