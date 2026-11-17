# Dropbox setup

Dropbox backup and restore use the Dropbox application's dedicated **App Folder**. The browser transfers Jump Cluster JSON directly to Dropbox. The Dropbox account owner manages any sharing they configure in Dropbox.

## Configure a Dropbox app

1. In the [Dropbox App Console](https://www.dropbox.com/developers/apps), create a **Scoped access** app with **App folder** access.
2. Add the exact redirect URI for each deployed origin using `https://<application-origin>/dropbox/oauth/callback`. Local development uses `http://localhost:3051/dropbox/oauth/callback`.
3. Enable the following user scopes in the app's **Permissions** tab and save them with **Submit**.
   - `files.metadata.read` to list backups and check a path after an interrupted write.
   - `files.content.read` to compare uncertain writes and restore a selected backup.
   - `files.content.write` to create and delete backups in the App Folder.
4. Set the public Dropbox app key for the Nuxt runtime.

   ```text
   NUXT_PUBLIC_DROPBOX_APP_KEY=<app-key>
   ```

   For local development, put it in the ignored `.env` file at the repository root. Start the app with `npm run dev -- --host localhost --port 3051` and open `http://localhost:3051`. The browser uses the public app key and authorization code with PKCE S256.

The redirect path is case-sensitive and must match exactly. OAuth requests an online short-lived grant. Access tokens and the returned Dropbox `account_id` stay in page memory and are cleared on expiry or page disposal. The OAuth callback removes its query parameters from browser history before forwarding the result to the initiating page. [Dropbox authorization reference](https://docs.dropboxapi.com/dropbox-api/docs/get-started/authorization)

## Enable Dropbox on the production site

1. In the production Dropbox app, open **Settings → OAuth 2 → Redirect URIs** and add `https://ttrpg-cluster-control.vercel.app/dropbox/oauth/callback`. Confirm the **App folder** access type and save the three scopes listed above in **Permissions**.
2. In the Vercel project's **Settings → Environment Variables**, set `NUXT_PUBLIC_DROPBOX_APP_KEY` to the public **App key** from that Dropbox app for **Production**. Deploy with the variable set. The browser uses PKCE and the app key. [Vercel environment variables](https://vercel.com/docs/environment-variables)
3. To test with a Dropbox account other than the app owner's while the app has development status, select **Enable additional users**. Use **Apply for production** for broader rollout. Refer to the [production privacy policy](https://ttrpg-cluster-control.vercel.app/privacy) when describing the app's data handling. Dropbox generally reviews production requests after 50 linked accounts. [Dropbox production approval](https://www.dropbox.com/developers/reference/developer-guide#production-approval)

## Save and manage backups

In **Map files**, choose **Back up Jump Cluster to Dropbox**. The backup is a complete Jump Cluster JSON file and can include GM notes. Dropbox opens its authorization window when the page needs a new grant.

The app keeps the ten most recent dated backups per Dropbox account across all Jump Clusters. After Dropbox confirms a new backup, the app removes older dated backups above that limit. Other files in the App Folder stay outside this limit. Download a local JSON copy before backing up if you want to keep a version beyond the limit.

To remove a dated backup yourself, open **Restore Jump Cluster from Dropbox**, choose **Delete** next to the backup, and confirm. You can also manage the files in your Dropbox App Folder. Dropbox applies its account-specific recovery period to deleted files. [Dropbox deleted-file recovery](https://help.dropbox.com/delete-restore/deleted-files)

## Account support verification

The initial save and restore workflow passed a manual Firefox test on Dropbox Personal. Use these steps to qualify each account type.

1. Configure the public app key, the exact origin callback, App Folder access, and the three file scopes above.
2. In one isolated browser profile, back up a synthetic Jump Cluster containing GM notes, Fields, player publication settings, relationships, and saved layout. Confirm the actual filename and App Folder destination shown after Dropbox acknowledges the write.
3. In a fresh isolated profile, authorize the same Dropbox account, locate the dated backup, restore it, compare the full portable data with the fixture, then reload and verify the restored map remains active.
4. Record the account type, app access mode, exact origin, saved name and destination, restore comparison, and reload result. Use that evidence to document which account types are supported.

Tests with controlled provider responses cover OAuth state and PKCE, App Folder create behavior, exact-byte reconciliation, conflicts, retries, cancellation, retention, and deletion. Record the real-account results separately. To verify retention on a real test account, use only synthetic backups, confirm that an eleventh save removes the oldest dated backup, then delete a remaining dated backup through the app and check the App Folder.
