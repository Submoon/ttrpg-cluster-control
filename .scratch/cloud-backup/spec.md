---
title: Back up and restore a Jump Cluster
status: open
triage_labels:
  - enhancement
  - ready-for-agent
---

# Back up and restore a Jump Cluster

The user confirmed Google Drive for the first delivery after the [cloud provider comparison](provider-research.md). During live testing, the user chose the hidden Drive space reserved for TTRPG Cluster Control. A live Drive round trip is required before delivery.

## Source issue

[Back up and recover maps using cloud storage — GitHub #51](https://github.com/Submoon/ttrpg-cluster-control/issues/51), fetched on 2026-11-13. The issue is open with the `enhancement` label and no comments. Its first delivery calls for explicit backup and restore through one provider, the existing portable format, a complete round trip in a fresh browser, confirmation from the provider before reporting success, and continued offline local workflows. The [approved scope](analysis.md) changes destination selection to the application's private Drive space and corrects the append behavior for complete local Jump Cluster JSON files.

Baseline after fetching `origin` is `efd9b094634cf60d6c466f612df11cf9573b6b33`. Detached HEAD, `main`, and `origin/main` agree.

Implementation starts at `dfe07f7d9a7cd0a8f8e300b68c9467b7262dc59d` after fetching `origin` and fast-forwarding `main`. The integration branch is `codex/issue-51-cloud-backup`.

The first integrated review used `origin/main` at `a369e60943a062b24e4404af8ce9610b4bdbb393`. The integration branch now includes `origin/main` at `9ab9cd78` after the map context menu change landed.

## Problem Statement

Wardens can lose the local copy of a Jump Cluster when they clear site data or switch browser profiles. They can download a complete JSON file today, but the import action adds systems and routes to an existing cluster. A Warden who wants to resume work from a backup needs to open the saved Jump Cluster with its GM notes, player publication settings, relationships, and layout intact.

## Solution

**Map files** offers a manual Google Drive backup of the applied Jump Cluster alongside the local JSON download. Each backup creates a dated file in the hidden Drive space reserved for the application. A Warden can list, download, and restore those backups from the application after authorizing their Google account. Disk and Drive restore are available on the welcome screen, on the local recovery screen, and from the editor. Opening a backup in the editor previews the replacement and requires confirmation. Adding a standalone star system remains a separate action.

## User Stories

1. As a Warden, I want to start a Google Drive backup from Map files so that I can keep an off-device copy of my work.
2. As a Warden, I want my backups in a private space reserved for this app so that I can save them without managing Drive folders or sharing settings.
3. As a Warden, I want to authorize access only to the application's data space so that my other Drive files stay outside its access.
4. As a Warden, I want the file to reflect the applied state when I click **Back up to cloud storage** so that later edits and pending drafts do not change that backup.
5. As a Warden, I want each backup to create a new dated file so that I can keep earlier copies.
6. As a Warden, I want the confirmed filename and a dated list inside the app so that I can identify the backup to restore or download.
7. As a Warden, I want clear feedback if I deny consent or encounter an upload whose outcome is uncertain so that I can retry safely.
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
- Capture one detached snapshot at the initial backup click. Keep draft and gesture state under the editor's ownership. Authorization, upload, and feedback operate on the captured file while editing and local autosave continue independently.
- Use Google Identity Services with short-lived browser access and `drive.appdata`. Transfer JSON directly between the browser and Drive. Load the provider on demand so local actions work independently of its configuration, connectivity, and authorization.
- Create and list backups in `appDataFolder`. Google restricts this space to the application and prevents sharing. The app shows dated backups and offers portable JSON downloads for independent retention. Removing the integration or its application data in Drive can remove the remote copies. A different Google Cloud project has a separate application data space. [Application data folder](https://developers.google.com/workspace/drive/api/guides/appdata)
- Create a new dated file for each backup. Show the actual filename and application space after Drive confirms the completed create. Preserve previous files on cancellation, failure, or retry. A lost response after dispatch can leave the outcome uncertain. Reconcile against the same provider file identity when possible so retrying one operation does not create duplicates. [Drive upload guidance](https://developers.google.com/workspace/drive/api/guides/manage-uploads)

### Opening and replacing a Jump Cluster

- Both local file and Drive choices pass through one admission and restoration contract. Admit supported complete Jump Cluster backups, including supported older versions, and reject damaged or unsupported files before modifying local state. A player document or standalone star-system file is ineligible for complete restore. The separate **Add a star system** action uses the existing reviewed system import semantics and associated compatibility checks.
- Offer disk and Drive restore from the welcome screen of a fresh profile, the damaged-workspace recovery screen, and the editor. The damaged-workspace screen retains **Restore last valid backup** alongside those choices.
- For an active cluster, show both names, offer a local download of the active cluster, and require explicit confirmation. If there are drafts, offer to return to editing or confirm their discard once the replacement commits. Keep the active cluster, drafts, and history available on cancellation or failure. Revalidate the review against the active workspace and revision before committing. Require a fresh review if the data or the draft consent changes.
- Serialize the final replacement through the existing local persistence owner. Install the validated cluster in IndexedDB before publishing it to the editor. Preserve the displaced healthy cluster in the rolling last-valid slot, or keep the valid recovery snapshot when replacing a damaged record. If the write fails, preserve the previous durable records and editor state. Start the restored cluster with a fresh browser-local workspace identity and empty undo and redo history. Reject writes from stale tabs holding a displaced workspace.

## Testing Decisions

- At the portable format boundary, verify complete round trips for current and supported older Jump Cluster backups, exact retention of private and publication data, and rejection of incompatible input. Continue covering standalone star-system compatibility separately. Reuse the established workspace codec and publication-data coverage.
- At the operation boundary, exercise the real backup and restore orchestration with controlled provider and storage responses. Cover capture at the initial click, denied or canceled provider actions, app-space-only writes and listing, confirmed versus uncertain writes, stale review, and unsuccessful local commit. Assert outcomes through operation results, retained files and snapshots, and visible state.
- Use representative browser journeys and real IndexedDB to verify the local file entry points, replacement confirmation and pre-replacement download, draft and history lifetimes, rolling recovery, and stale-tab write protection. Build on the current reviewed-import and local recovery journeys and keep deterministic cases at their narrower boundaries.
- Before delivery, verify a real Drive round trip across two isolated browser profiles with an allowlisted account and a configured browser origin. Confirm the first profile reports the completed backup, the second profile lists the dated file in the application space, and restore and JSON download preserve the complete backup. Record live-provider results separately from controlled browser coverage.

### Live verification

On 2026-11-13, the production build at `c51b92dc` ran on `http://localhost:3051` in the Codex integrated Chromium browser. With an allowlisted Google test account, the app confirmed two distinct dated copies of a synthetic Jump Cluster in its private Drive space and listed both together. The first copy downloaded as JSON and matched the reference exactly as parsed data, including GM notes, player publication, Fields, the Jump Route, and layout. Restoring that copy through the editor replacement review succeeded and the map reopened after reload. The tester separately confirmed that they could open the same Jump Cluster from the welcome screen in a private browsing window using the same Google account and that it remained open after reloading.

In a fresh Playwright context with controlled Google OAuth and Drive responses, the welcome flow also restored the exact Cluster, Field settings, and layout into IndexedDB and reopened them after reload. The exact JSON comparison above used the real Drive download.

After the cancellation and focus corrections and the final main integration, the production build at `971c0774` listed the same real Drive backups, restored the first file through the editor review, and reopened it after reload.

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
