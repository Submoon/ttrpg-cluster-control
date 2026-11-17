# Dropbox setup

Dropbox backup and restore use the Dropbox application's dedicated **App Folder**. The browser transfers Jump Cluster JSON directly to Dropbox. The Dropbox account owner manages any sharing they configure in Dropbox.

## Configure a Dropbox app

1. In the [Dropbox App Console](https://www.dropbox.com/developers/apps), create a **Scoped access** app with **App folder** access.
2. Add the exact redirect URI for each deployed origin using `https://<application-origin>/dropbox/oauth/callback`. Local development uses `http://localhost:3051/dropbox/oauth/callback`.
3. Enable the following user scopes in the app's **Permissions** tab and save them with **Submit**.
   - `files.metadata.read` to list backups and check a path after an interrupted write.
   - `files.content.read` to compare uncertain writes and restore a selected backup.
   - `files.content.write` to create a backup in the App Folder.
4. Set the public Dropbox app key for the Nuxt runtime.

   ```text
   NUXT_PUBLIC_DROPBOX_APP_KEY=<app-key>
   ```

   For local development, put it in the ignored `.env` file at the repository root. Start the app with `npm run dev -- --host localhost --port 3051` and open `http://localhost:3051`. The browser uses the public app key and authorization code with PKCE S256.

The redirect path is case-sensitive and must match exactly. OAuth requests an online short-lived grant. Access tokens and the returned Dropbox `account_id` stay in page memory and are cleared on expiry or page disposal. The OAuth callback removes its query parameters from browser history before forwarding the result to the initiating page. [Dropbox authorization reference](https://docs.dropboxapi.com/dropbox-api/docs/get-started/authorization)

## Account support verification

Dropbox Personal is the first account type to verify with a real browser round trip. Use these steps for each account type declared supported.

1. Configure the public app key, the exact origin callback, App Folder access, and the three file scopes above.
2. In one isolated browser profile, back up a synthetic Jump Cluster containing GM notes, Fields, player publication settings, relationships, and saved layout. Confirm the actual filename and App Folder destination shown after Dropbox acknowledges the write.
3. In a fresh isolated profile, authorize the same Dropbox account, locate the dated backup, restore it, compare the full portable data with the fixture, then reload and verify the restored map remains active.
4. Record the account type, app access mode, exact origin, saved name and destination, restore comparison, and reload result. Use that evidence to document which account types are supported.

Tests with controlled provider responses cover OAuth state and PKCE, App Folder create behavior, exact-byte reconciliation, conflicts, retries, and cancellation. Record the real-account results separately.
