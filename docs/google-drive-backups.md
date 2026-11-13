# Verify Google Drive backups

Google Drive backup and restore use the app's Google Cloud project for OAuth. Each Warden authorizes the app's private data space in their own Drive account. Use a test account and synthetic Jump Cluster data for qualification.

## Configure the test project

1. Create or select a test project in Google Cloud and enable the Google Drive API. [Enable Google Workspace APIs](https://developers.google.com/workspace/guides/enable-apis)
2. In Google Auth Platform, configure the consent screen and add `https://www.googleapis.com/auth/drive.appdata`. For an external app in Testing, add the Google account that will run the test under **Audience → Test users**. [App data scope](https://developers.google.com/workspace/drive/api/guides/appdata) · [OAuth production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
3. Create an OAuth client of type **Web application**. Add `http://localhost` and `http://localhost:3051` as authorized JavaScript origins. List each additional test port as its own origin. Leave redirect URIs empty and copy the client ID for the browser token flow. [Web client setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)
Set `NUXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID` in the local process environment or an ignored `.env` file. Start the app with `npm run dev -- --host localhost --port 3051`, and open `http://localhost:3051`. For deployment, use the client ID and origins of the production Google Cloud project, with the applicable consent and brand configuration. Test and production projects have separate app data. [Google OAuth brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)

For a Vercel preview, set the test client ID in `NUXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID` for the Preview environment and redeploy. A project-wide Preview variable can serve every non-production branch. Add the exact HTTPS origin of each branch you test to the OAuth client's authorized JavaScript origins. Use Vercel's stable branch URL so subsequent deployments of the same branch keep using the registered origin. [Vercel Preview variables](https://vercel.com/docs/environment-variables#preview-environment-variables) · [Vercel branch URLs](https://vercel.com/docs/deployments/generated-urls#generated-from-git) · [Google authorized origins](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)

## Run the live test

1. In the first browser profile, create or restore a synthetic Jump Cluster with GM notes, player publication settings, Fields, relationships, and a saved layout. Download the full JSON as the reference.
2. In **Map files**, start a Drive backup and authorize the test Google account. Check that the **Backed up to Google Drive** toast appears. In the same open page, create a second backup while the access token is valid. Verify that Google does not prompt again and that both dated copies appear in the app's Drive backup list. Record their filenames from the list.
3. Open the app in a separate browser profile with no saved workspace. On the welcome screen, choose to open a Drive backup, authorize the same account, and select the saved file from the app's list. Verify that downloading the listed JSON preserves the original contents. Confirm the restore, check that the **Restored from Google Drive** toast appears, and reload to verify that the restored map opens. Compare its cluster and layout with the reference.
4. Record the app revision, origin, browser, account type, verified outcomes, and any unavailable cases. Store evidence without access tokens, API keys, or personal map data.

Use **Forget Google Drive account** to clear the page's current access token and choose an account on the next Drive action. The Google session and saved backups remain in the account. Reloading the page also clears its in-memory token.

Google Drive hides this data space from its file interface. Removing the integration or its application data can remove its remote backups. Download a JSON backup from the app when you need an independently retained copy. [Application data lifecycle](https://developers.google.com/workspace/drive/api/guides/appdata)
