---
title: Cloud backup and recovery scope
status: closed
---

# Cloud backup and recovery scope

## Source issue

[Back up and recover maps using cloud storage — GitHub #51](https://github.com/Submoon/ttrpg-cluster-control/issues/51), fetched on 2026-11-13. The issue is open, labeled `enhancement`, and has no comments.

The first delivery adds explicit backup and open actions for one provider while retaining local editing, autosave, JSON download, and import. A fresh browser must be able to recover the full Jump Cluster, including GM notes and player publication settings. The Warden chooses the destination and retains control of its sharing permissions. Invalid files, failed or canceled cloud operations, and disconnected providers must preserve local data and previous successful backups. Report a successful backup only after provider acknowledgement.

## Repository baseline

After `git fetch origin`, this detached worktree's HEAD, local `main`, and `origin/main` all resolve to `efd9b094634cf60d6c466f612df11cf9573b6b33`. There is no intentional divergence.

## Established behavior

- The [current JSON export](../../domain/workspace-codec.ts) contains the complete applied Jump Cluster, its Field settings, player publication, and saved layout. The local workspace identity, unapplied drafts, and undo history are outside the portable format. The [player publication decision](../../docs/adr/0002-player-publication-boundary.md) defines the separate player document.
- [Copy import](../../composables/useWorkspaceFiles.ts) reviews and adds independent copies with remapped IDs to an active workspace. It retains the destination cluster name and player share title. The [welcome screen](../../components/WorkspaceWelcome.vue) has no file entry point for a fresh profile. Its existing local recovery action reads the browser's last valid IndexedDB snapshot.
- The [existing export preflight](../../composables/useEditorWorkflows.ts) can complete a pending Orbit adjustment. Cancellation semantics for the provider operation need to distinguish such editor actions from writing or restoring a cloud file.
- The [local workspace owner](../../composables/useLocalWorkspace.ts) normally publishes memory before its queued IndexedDB write, and its queue belongs to a single tab. [Storage](../../utils/workspace-storage.ts) shares the current and rolling last-valid snapshots across tabs for the same origin. Replacement needs a durable-before-publication path through the same owner and must fence stale writes from tabs still holding the displaced cluster. A routine local save rolls the backup forward.

## Provider evidence

- Google Drive offers per-file authorization through `drive.file` and Google Picker. Google Identity Services can obtain a short-lived token in the browser. Picker can select a folder or file, Drive can create a file in a specified parent, and `files.get` with `alt=media` reads its content. Verify the complete Picker-to-Drive flow with a real account before treating it as proven. [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) · [Browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model) · [Web Picker](https://developers.google.com/workspace/drive/picker/guides/web-picker) · [Folder uploads](https://developers.google.com/workspace/drive/api/guides/folder) · [File downloads](https://developers.google.com/workspace/drive/api/guides/manage-downloads)
- Dropbox OAuth offers App Folder or Full Dropbox content access, within the scopes granted. Its Saver destination picker consumes a remotely reachable URL, while the Chooser can return a temporary direct download link for a user-selected file. [Dropbox OAuth](https://docs.dropboxapi.com/dropbox-api/docs/oauth) · [Dropbox Saver](https://docs.dropboxapi.com/dropbox-api/docs/pre-built-components/saver) · [Dropbox Chooser](https://docs.dropboxapi.com/dropbox-api/docs/pre-built-components/chooser)
- Google Drive files inherit parent folder permissions. The Drive permissions API lists permissions with `drive.file` for an authorized resource. [Drive sharing](https://developers.google.com/workspace/drive/api/guides/manage-sharing) · [Permissions list](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list)
- Verify ownership, write capability, and the complete effective permission list of a selected My Drive folder immediately before creating a file. Drive exposes an `ignoreDefaultVisibility` option to bypass a Workspace domain's default sharing policy while keeping inherited permissions. Drive does not document an atomic check-and-create condition tied to the folder's access list. The Warden can change sharing independently of the app. [File metadata](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) · [File creation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create) · [Drive sharing](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
- A lost response after dispatch can leave the file present in Drive. A pre-generated ID supports reconciling or retrying the same create without adding a duplicate. Success still requires confirmation of the completed write. [Drive upload guidance](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- Verify the real browser flow with an allowlisted Google test account. A public rollout needs the external production OAuth configuration and the applicable brand verification. [OAuth production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview) · [Brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)

## Round 1 decisions

Accepted by the user on 2026-11-13:

1. Start with Google Drive. Use per-file authorization and direct browser-to-provider transfer.
2. Restrict new backups to destinations that the application can verify as private at the time of writing. The Warden retains control of sharing in Drive.
3. Create a new dated file for each backup. Preserve earlier files and show the actual file name and destination after Drive confirms creation.
4. Restore the full Jump Cluster from the welcome screen in a fresh profile. When a Jump Cluster is already open, replace it only after confirmation. The user identified the current append behavior of local Jump Cluster JSON import as a bug and requested replacement there too. This changes the append-import behavior documented in [ADR 0002](../../docs/adr/0002-player-publication-boundary.md) for full Jump Cluster files.

The [domain context](../../CONTEXT.md) defines **Jump Cluster backup**. Disk and Drive are sources for the same backup format.

## Round 2 decisions

Accepted by the user on 2026-11-13:

5. Keep standalone star-system JSON import as an explicit **Add a star system** action for the active Jump Cluster.
6. Expose both local file and Google Drive restore on the welcome screen of a fresh profile. Both open the complete Jump Cluster through the same restore contract.
7. For replacement, name the active and incoming Jump Clusters, offer a local download of the active cluster, and require explicit confirmation.
8. Keep the active cluster until the replacement commits in IndexedDB. Start with empty undo and redo history after a successful restore.
9. Capture the applied Jump Cluster at the initial **Back up to cloud storage** click. Later edits do not change that file, even if Google consent or destination selection is still pending. The cloud operation reads applied data and does not complete or discard a draft or gesture.

## Replacement safety

- Validate the entire incoming backup before offering to replace or mutating local storage. Preserve the Jump Cluster's identity and content. Give the restored copy a fresh browser-local workspace identity, since the portable file contains no local workspace ID.
- Recheck that the active cluster and applied revision still match the review at commit. If they changed, refresh the review and obtain confirmation again. Reject stale-tab writes against the replaced local workspace generation.
- Keep provider selection and download outside the local write queue. Serialize the final local replacement through the existing persistence owner. On cancellation or failure, keep the current cluster, history, and local recovery records.

## Round 3 decisions

Accepted by the user on 2026-11-13:

10. If there are unapplied changes, offer to return to editing or confirm their discard on successful replacement. Keep drafts until the replacement commits. Cancellation and failure preserve them.
11. Offer local file and Drive restore when the local workspace is damaged, alongside **Restore last valid backup**. Preserve an existing valid recovery snapshot when replacing a damaged current record.
12. Preserve the displaced cluster in the existing rolling last-valid slot when replacing a healthy workspace. An ordinary save can roll that slot forward. The offered pre-replacement JSON download lets the Warden keep the old cluster for longer.

## Verification to carry into the specification

- At the portable format boundary, round-trip a complete Jump Cluster with private GM notes, player title and publication settings, Fields, relationships, and saved layout. Exercise supported legacy backups and reject an invalid file, a player document, or a standalone system in the full restore path.
- At the operation boundary, check the click-time snapshot, denied or canceled provider actions, confirmed and uncertain uploads, a stale replacement review, and a failed local commit. Exercise existing standalone system addition through its separate action.
- Use a representative browser journey for file restore and replacement with actual IndexedDB. Verify that a tab holding the displaced workspace cannot overwrite the restored cluster. Use two isolated browser profiles and a real test Drive account for the provider round trip, including a private destination and rejection of a shared destination.

## Final scope review

The user approved the combined scope on 2026-11-13 and requested the specification. During ticket review, the user reopened provider selection and requested an analysis of supported cloud providers before closing the scope.

After reviewing the [cloud provider comparison](provider-research.md), the user confirmed Google Drive as the first provider on 2026-11-13 and required live verification before delivery. The user approved the four local implementation tickets listed in the [specification](spec.md). Dropbox and OneDrive are separate follow-up issues with native dependencies on #51.

## Drive destination revision

After testing the Google consent and folder picker, the user chose the hidden Drive application data space. This supersedes the original My Drive folder choice and sharing checks. The app requests `drive.appdata`, creates dated backups in `appDataFolder`, and lists them in its own restore UI. The Warden can download a portable JSON from that list. Local replacement and the live two-profile requirement still apply. [Application data folder](https://developers.google.com/workspace/drive/api/guides/appdata)
