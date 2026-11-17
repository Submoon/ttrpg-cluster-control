# Qualify Dropbox App Folder on a personal account

The live run verified synthetic file creation and API access. The external sharing cases were unverified. See the [live results](#live-results) and [agreed scope](#agreed-scope).

## Source issue

[Back up and restore a Jump Cluster with Dropbox](https://github.com/Submoon/ttrpg-cluster-control/issues/55) originally required the application to refuse shared and indeterminate destinations. That criterion motivated the exploratory checks below. The issue was updated on 2026-11-17 to use App Folder and leave sharing decisions to the Dropbox account owner.

Baseline after fetching `origin` is `88d84f1749c7615b6dc5179f2bd4f24040d79f6a`. Local `main` matches `origin/main`. The detached worktree at `dc5edb282087458c1bc6dd26287c96a974662c3b` is six commits behind. The probe runs independently of application code.

## Set up the test app

1. Sign into the [Dropbox App Console](https://www.dropbox.com/developers/apps) with a personal test account. Create a fresh **Scoped access** app with **App folder** content access. Use the dedicated folder that Dropbox provisions for the app. [Dropbox OAuth guide](https://docs.dropboxapi.com/dropbox-api/docs/oauth#content-access)
2. Open **Permissions**, select `files.metadata.read`, `files.content.write`, and `sharing.read`, then choose **Submit**. These scopes are for the calls in this probe. [Get Metadata](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/get-metadata) · [Create Folder v2](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/create-folder-v-2) · [Upload](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/upload) · [List Shared Links](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/sharing/list-shared-links)
3. In **Settings**, open **OAuth 2** and generate an access token just before the run. Use the hidden prompt in the local PowerShell terminal. Keep the token out of chat, files, and command arguments. The generated token is sufficient for the developer's account. [Testing with a generated token](https://docs.dropboxapi.com/dropbox-api/docs/oauth#testing-with-a-generated-token)

Optional for the invitation cases: have a second personal test account available in a separate browser profile. Keep both accounts and every folder involved limited to synthetic content for this exercise.

## Run the probe

From the repository, run `powershell.exe -NoProfile -File .\.scratch\dropbox-app-folder\probe.ps1` or the same command with `pwsh`. The script uploads one synthetic JSON file under a new `issue55-probe-*` folder. Find the fixture inside the new app's folder in Dropbox on the web. Use only the new app and this fixture for the cases below. The script records the initial private state and then prompts for each case.

| Case | Action in Dropbox on the web | Expected signal to check |
| --- | --- | --- |
| Direct file link | Create a link to `synthetic-backup.json`. Confirm access in a separate browser session. | The file query returns a link when restricted to direct links. The folder query may stay empty because child links do not flow up. |
| Folder link inherited by file | Create a link to `issue55-probe-*`. Confirm the separate browser session can open the synthetic file through the folder link. | The file query including parent links returns the link. A query restricted to direct links can stay empty. |
| App Folder root link | Try creating a viewing link to the app folder itself. If Dropbox permits it, check that it reaches the fixture from a separate session. | Calls on the known child paths must detect the link, or the access is invisible to the probe. |
| Apps ancestor link | If the `Apps` parent contains only synthetic data in the isolated test account, try creating a viewing link there and accessing the fixture. Otherwise skip the case. | A link outside the app's content boundary may be invisible to the token. A confirmed access with empty results is a false private result. |
| Direct file invitation | Invite the second test account to `synthetic-backup.json` with direct access and check whether it can open the file. | Check whether `has_explicit_shared_members` changes. |
| Invitee-created file link | If the previous invitation succeeded, reapply the direct invitation and check whether the invitee can create a working link. Open it from a signed-out session if the link mode allows it. | Check whether the owner's token sees the invitee's link. Remove both the link and the invitation after recording. |
| Direct folder invitation | Try inviting the second account directly to `issue55-probe-*`. Check its ability to browse or download the file if Dropbox permits the invitation. | Record whether the UI prevents the invitation. If access succeeds, check the folder and file sharing metadata. |
| App Folder root invitation | Try inviting the second account directly to the app folder itself. Check whether the fixture is accessible if Dropbox permits the invitation. | Check whether Dropbox blocks the invitation or exposes the inherited access on the known child paths. |
| Inherited folder membership | With only synthetic content present, try putting the dedicated app folder in a folder that already grants access to the second test account. Check whether Dropbox blocks the move before proceeding. If it succeeds, verify second-account access. | Look for inherited sharing metadata or a failed lookup through the original App Folder token. |

Record **A** if access was independently confirmed, **B** for an explicit Dropbox refusal, **U** if the UI accepted the action but recipient access is unverified, and **S** for skipped cases. Measure while access is still in effect. Revoke each link or invitation after its measurement and before setting up the next case. If a move succeeds, return the app folder to its original location. See the [Dropbox sharing guide](https://docs.dropboxapi.com/dropbox-api/docs/sharing#reading-shared-links) and the [Dropbox folder sharing FAQ](https://help.dropbox.com/share/shared-folder-faq) for the expected link behavior and provider restrictions.

The probe prints the path of its JSON report in the temporary directory after every recorded case. Share the path and a short description of any UI refusal or successful independent access. The report contains statuses, sharing indicators, link counts, and pagination signals. It excludes the token, link URLs, and recipient identities. After collecting the evidence, clean up the synthetic file and shares through the test account.

## Interpret results

A successful write and an empty list of links in the private fixture establish a baseline. To qualify a destination, every relevant type of access must either be prevented by Dropbox for that destination and account type or be distinguishable with the restricted token. Review link visibility and pagination, including any `hasMore` response, and the scope of the documented guarantees before relying on a negative result. Treat skipped cases, recipient tests that remain unverified, API failures, and access the token cannot see as indeterminate until resolved. An API probe is separate from the later production browser save-and-restore check in two isolated profiles.

## Live results

On 2026-11-16, the probe ran against the personal test account with the restricted App Folder token. The report for `issue55-probe-fb87375d261e` contains the private control. The probe reached the control after Dropbox confirmed folder creation and synthetic JSON upload. Metadata lookups returned HTTP 200 for the folder and file, with no shared-folder or shared-parent indicators. The explicit file membership flag was `false`. Both direct-only and ancestor-inclusive link queries returned HTTP 200 with zero links and `hasMore: false` for both targets.

The subsequent path and item-ID lookups also returned HTTP 200 with zero links. The inventory's first page returned zero links and `hasMore: true`. On 2026-11-17, the operator clarified that they had not performed the independent access check for the folder link. The prompt selections in both reports are insufficient evidence that a working share was in place. Mark the direct and inherited sharing cases as unverified. Withdraw the earlier interpretation that those measurements demonstrated false negatives.

The upload and metadata results establish write and metadata access to the App Folder fixture on a personal account. A live download and restoration in a fresh browser profile still need verification.

## Agreed scope

Use Dropbox App Folder as the fixed destination. Request the file content and metadata scopes required to create, list, and restore backups. Dropbox account owners manage any sharing they perform in Dropbox. The real backup and restore acceptance test in two isolated browser profiles starts with a personal Dropbox account. [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/55) · [Dropbox content access](https://docs.dropboxapi.com/dropbox-api/docs/oauth#content-access)

### Recheck the active folder link

Keep or recreate the owner-created view link to the fixture folder. Open the synthetic JSON through that link in a signed-out browser or from the authorized recipient session. Keep it active during the measurement. Run this command from the repository, supplying the existing probe report:

```powershell
powershell.exe -NoProfile -File .\.scratch\dropbox-app-folder\probe.ps1 -RecheckReport <report-path>
```

Use the same App Folder grant. The recheck uses only reads and writes its observations to a separate local report. It compares results by path and item ID, plus the authenticated user's inventory first page. The inventory count alone cannot identify the shared target. `hasMore: true` means the inventory evidence is incomplete. Treat an empty result as a visibility gap when independently confirmed access is still active. [Dropbox link lookup reference](https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/sharing/list-shared-links)
