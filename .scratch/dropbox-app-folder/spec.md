---
title: Back up and restore a Jump Cluster with Dropbox
status: open
triage_labels:
  - enhancement
  - ready-for-agent
---

# Back up and restore a Jump Cluster with Dropbox

## Source issue

[Back up and restore a Jump Cluster with Dropbox](https://github.com/Submoon/ttrpg-cluster-control/issues/55), fetched on 2026-11-17. The issue is open with the `enhancement` label and no comments. The updated criterion uses the application's dedicated Dropbox App Folder and leaves any Dropbox sharing decisions to the account owner. The issue requires an independent dated file for each backup, a receipt after Dropbox confirms the write, and a complete restore on a real account across two isolated browser profiles for each supported account type. Local editing, autosave, and file restore remain available offline. Portable JSON admission and replacement confirmation come from [the original cloud backup delivery](https://github.com/Submoon/ttrpg-cluster-control/issues/51).

After fetching `origin`, `main` and `origin/main` both point to `88d84f1749c7615b6dc5179f2bd4f24040d79f6a`. That revision is the planning baseline. The detached planning worktree at `dc5edb282087458c1bc6dd26287c96a974662c3b` is six commits behind. Implementation should use the fetched main baseline or record a more recent revision after refreshing it.

For the backup-management follow-up, `origin/main` was refreshed and remained at the same revision. The integrated Dropbox baseline for this follow-up is `02fc55b678af34609eb835c24dc04719b01a8a1f`. After reporting a successful Firefox test, the user requested a direct backup action and the Google Drive backup limit and deletion controls for Dropbox.

The pull request is prepared against `origin/main` at `6b15a9e5`, which includes the map object marker color work from issue #54.

## Problem Statement

A Warden who uses Dropbox wants an off-device copy of their Jump Cluster and a way to recover it after losing local browser data or moving to another browser profile. The portable JSON and the local replacement flow already preserve the complete Jump Cluster. The missing workflow is saving that file to Dropbox and opening a saved copy directly through the application.

## Solution

Add a Dropbox backup action alongside the existing actions in **Map files**. Each action writes a separate dated Jump Cluster JSON file to the application's Dropbox App Folder. A Warden can authorize Dropbox, list those files, and open one from the welcome screen, local recovery screen, or editor. Dropbox provides the file bytes and the existing workspace restore owner handles admission, replacement review, and local persistence. The first real account verification uses Dropbox Personal.

## User Stories

1. As a Warden, I want to back up my Jump Cluster to Dropbox from **Map files** so that I can keep an off-device copy in the account I already use.
2. As a Warden, I want to see the destination and the kind of data the backup contains so that I can decide whether to authorize the transfer of my preparation, including GM notes.
3. As a Warden, I want Dropbox authorization limited to the application's dedicated folder so that the app accesses the backups within that folder.
4. As a Warden, I want an explicit backup action to capture the applied Jump Cluster when I select it so that edits I make while authorizing or uploading belong to my next backup.
5. As a Warden, I want a separate dated file for each backup so that I can recover an earlier copy.
6. As a Warden, I want to see the actual filename and destination once Dropbox has confirmed it so that I know what was saved.
7. As a Warden, I want to cancel authorization or retry an interrupted backup while keeping my local work and earlier Dropbox copies.
8. As a Warden, I want a retry of the same upload to resolve against its intended file so that a lost response does not cause an overwrite or duplicate copy.
9. As a Warden, I want to connect my Dropbox account from a fresh browser profile and see my backup files so that I can recover after losing site data.
10. As a Warden, I want to access Dropbox backups from the recovery screen so that a damaged local record does not prevent recovery.
11. As a Warden, I want to open a Dropbox backup from the editor and review the replacement so that I can decide whether to replace the active Jump Cluster.
12. As a Warden, I want a chance to download the active Jump Cluster and decide what to do with unapplied edits before confirming a replacement.
13. As a Warden, I want a complete restore to preserve identity, GM notes, player publication settings, relationships, Fields, and saved layout so that I can resume my preparation.
14. As a Warden, I want a damaged, unsupported, or incomplete backup to leave my local data intact so that I can select another file.
15. As a Warden, I want a completed restore to remain active after reload so that I know the replacement was saved locally.
16. As a Warden, I want local editing, autosave, JSON download, and file restore available while Dropbox is disconnected or unavailable so that I can work offline.
17. As a Warden, I want to continue managing any sharing of these files in Dropbox so that I control access to my own copies.
18. As a Warden, I want the Dropbox backup command to begin immediately and retain the ten newest dated backups for my account across all Jump Clusters.
19. As a Warden, I want to select and confirm deletion of a dated Dropbox backup from the backup list.

## Implementation Decisions

### Destination and authorization

- Use one configured Dropbox app with App Folder content access. Backups go to that dedicated folder for the authorized account. Show the destination and explain that a complete Jump Cluster may contain GM notes. Dropbox account owners manage any sharing they configure in Dropbox. [Dropbox App Folder](https://docs.dropboxapi.com/dropbox-api/docs/oauth#content-access)
- Request `files.metadata.read`, `files.content.write`, and `files.content.read` for listing and reconciling files, creating and deleting backups, and reading selected backups. Document supported account types. Start support verification with Dropbox Personal and declare further account types once their real round trips are verified. [List folder](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/list-folder) · [Upload](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/upload) · [Download](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/download)
- Start Dropbox authorization from an explicit action. Use the public app key, an exact registered redirect URI, and authorization code with PKCE S256. Validate the returned OAuth state against the initiating attempt and discard expired, canceled, or replayed callbacks. Keep short-lived access credentials in memory and obtain fresh consent or authorization when needed. Keep the initiating workspace and its drafts intact over authorization. Use the Dropbox account identifier returned by authorization to bind any in-flight operation to its account. [Dropbox authorization reference](https://docs.dropboxapi.com/dropbox-api/docs/get-started/authorization)
- Transfer JSON directly between the browser and Dropbox. Keep Dropbox configuration, connectivity, and authorization independent of local workflows. Use the existing **Map files**, welcome, and local recovery entry points and the established patterns for busy states, feedback, and focus. [Dropbox browser requests](https://docs.dropboxapi.com/dropbox-api/docs/technical-reference/request-response-formats#browser-based-javascript-and-cors-pre-flight-requests)

### Back up a Jump Cluster

- Reuse the canonical complete Jump Cluster export used for local JSON. Capture a detached snapshot of the applied workspace at the initial backup action, before authorization and transfer. Subsequent edits and unapplied drafts remain under the editor's ownership. A Dropbox file uses the same portable versioned format as local JSON and contains the Warden's complete data.
- Create a dated `.json` file at a unique path per backup action. Use Dropbox add mode with automatic renaming disabled. For a retry, retain the captured bytes, path, and account of that action. Prevent overwrites when requests race or a path already exists. [Dropbox upload modes](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/upload)
- Show success after Dropbox confirms the file. Display its returned filename and its destination within the application's App Folder. If a response is lost after dispatch, report that the outcome is uncertain and inspect the intended path in the same account. Confirm the expected copy only when Dropbox metadata or downloaded bytes establish a match. Retry the same create only when the destination is confirmed absent. A collision or unavailable verification leaves earlier copies intact and surfaces an unresolved result. [Dropbox file metadata](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/get-metadata)
- Authorization cancellation and a failed or canceled transfer preserve the active workspace and earlier backups. If a request was already sent, reflect that Dropbox may have completed the write. Keep autosave and editing independent while the backup is pending.
- Start the backup from the **Map files** command. Disclose the complete JSON contents and retention next to that action. Reuse a valid Dropbox grant when available and let Dropbox prompt for authorization when a new grant is needed.
- After a new backup is confirmed, keep the ten newest files with this app's dated backup naming pattern in the App Folder root. Apply the limit per account across all Jump Clusters. Use Dropbox modification time and a deterministic tie-break. Verify the complete listing and the confirmed backup before pruning. If cleanup fails, report that the upload was saved and allow the same account to retry cleanup without uploading another file.

### Open a Dropbox backup

- List the available backups in the authorized account's App Folder. Follow continuation pages and display filenames and dates so a Warden can select a copy. Identify the selection within the same account through download. Refresh the list when authorization changes accounts. [Dropbox listing continuation](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/list-folder-continue)
- Offer Dropbox restore on welcome, in local recovery, and in the editor. Send the selected file through the existing portable Jump Cluster admission and restore owner. Keep supported older versions within that contract. Reject incompatible, damaged, player-only, or standalone star-system documents before modifying the workspace. The existing standalone star-system import owns its separate workflow.
- Reuse the current replacement review when a Jump Cluster is active. Show the incoming and active names, offer a local download before replacement, require consent for replacement and any draft discard, and require a fresh review when that consent is stale. The workspace owner commits the replacement before publishing it to the editor. Preserve the rolling recovery policy, the fresh local workspace identity and undo baseline, and stale-tab write protection. Announce a successful restore after local persistence confirms it. [ADR 0003](../../docs/adr/0003-restore-complete-jump-cluster-backups.md)
- Cancel a pending list or download cleanly. A canceled review, invalid file, interrupted download, authorization failure, or local commit failure preserves the active workspace and recovery state under the same restore contract.
- Offer file-specific deletion with confirmation for dated backups in the Dropbox list. Bind deletion to the listed account, root path, and revision. Keep other root JSON available to restore and outside automated retention. [Dropbox delete API](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/delete-v-2)

## Testing Decisions

- Exercise the real Dropbox backup and restore orchestration with controlled authorization, Dropbox responses, and local persistence at the existing controller boundaries. Assert receipts, resolved account and path, retained files and snapshots, and visible operation outcomes. Cover denial or cancellation, invalid or replayed authorization callbacks, account changes, pagination, snapshot capture, path collisions, a committed upload whose response was lost, and a retry that preserves earlier copies. Start from the analogous Drive controller tests and use the existing portable validation and workspace replacement coverage for shared invariants.
- Use one representative browser journey with controlled Dropbox responses and real IndexedDB storage to exercise the new UI wiring. Start from **Map files** in one context, restore from welcome in an isolated context, and reopen after reload. Use existing workspace restore browser coverage for local confirmation and recovery behavior and target the Dropbox integration boundary for provider-specific failures. Follow the project's [test guidance](../../docs/agents/testing.md) for narrower checks and browser coverage.
- Before delivery, run the browser flow with a real Dropbox Personal account and two isolated browser profiles on a configured origin. In the first profile, save a synthetic Jump Cluster with GM notes, Fields, player publication settings, relationships, and saved layout. Verify the actual filename and destination shown after Dropbox confirms the write. In a fresh profile, authorize the same account, locate the saved file, restore it, verify the full portable data against the source fixture, and reload to confirm the restored Jump Cluster persists. Repeat the live acceptance test for each additional supported account type. Record real-account evidence separately from simulated coverage.
- The follow-up Chromium test with controlled Dropbox responses verified direct saves with one grant, automatic removal of the oldest dated copies, confirmed deletion from the list, and exact restoration after reload. The user reported a successful Firefox save and restore and confirmed that manual deletion works on the test account. Live verification of automatic retention remains pending.

## Out of Scope

- Dropbox sharing management and audits, Full Dropbox access, arbitrary destination browsing, and team-space administration.
- Automatic backups, synchronization between profiles, and application-operated backup storage.
- Changes to the portable Jump Cluster JSON format, player document format, or publication rules.

## Further Notes

The [App Folder test record](qualification.md) confirms creation and metadata access with a console-generated token on a personal account. The user reported a successful manual Firefox save and restore. See the [restore ticket](tickets/02-restore-jump-cluster-from-dropbox.md) for the scope of the result. The [provider research](provider-research.md) records the earlier exploration of API behavior. Use the project's Sensitive development route for authorization and persistence review.

## Implementation tickets

1. [Back up a Jump Cluster to Dropbox](tickets/01-back-up-jump-cluster-to-dropbox.md)
2. [Restore a Jump Cluster from Dropbox](tickets/02-restore-jump-cluster-from-dropbox.md)
