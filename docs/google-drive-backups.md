# Verify Google Drive backups

Google Drive backup and restore use the app's Google Cloud project for OAuth. Each Warden authorizes the app's private data space in their own Drive account. Use a test account and synthetic Jump Cluster data for qualification.

## Configure the test project

1. Create or select a test project in Google Cloud and enable the Google Drive API. [Enable Google Workspace APIs](https://developers.google.com/workspace/guides/enable-apis)
2. In Google Auth Platform, configure the consent screen and add `https://www.googleapis.com/auth/drive.appdata`. For an external app in Testing, add the Google account that will run the test under **Audience → Test users**. [App data scope](https://developers.google.com/workspace/drive/api/guides/appdata) · [OAuth production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
3. Create an OAuth client of type **Web application**. Add `http://localhost` and `http://localhost:3051` as authorized JavaScript origins. List each additional test port as its own origin. Leave redirect URIs empty and copy the client ID for the browser token flow. [Web client setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)
Set `NUXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID` in the local process environment or an ignored `.env` file. Start the app with `npm run dev -- --host localhost --port 3051`, and open `http://localhost:3051`. For deployment, use the client ID and origins of the production Google Cloud project, with the applicable consent and brand configuration. Test and production projects have separate app data. [Google OAuth brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)

For a Vercel preview you intend to test, set the test client ID in `NUXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID` for the Preview environment and redeploy. Add the exact HTTPS origin of that trusted branch to the test client's authorized JavaScript origins. Use Vercel's stable branch URL so subsequent deployments of the same branch keep using the registered origin. [Vercel Preview variables](https://vercel.com/docs/environment-variables#preview-environment-variables) · [Vercel branch URLs](https://vercel.com/docs/deployments/generated-urls#generated-from-git) · [Google authorized origins](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)

## Set the production privacy policy URL

After deploying the page to production, open `/privacy` and follow the **Privacy policy** link from the app's welcome screen in a fresh browser profile. In the production Google Cloud project's **Google Auth Platform → Branding**, enter the public home page URL and the full privacy policy URL on the same origin. For the default production domain, use `https://ttrpg-cluster-control.vercel.app/privacy`. Use the same path on the production domain you configured for OAuth. [Google's privacy policy link requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification#application-privacy-policy-link-requirements)

## Run the live test

Follow the [shared live verification procedure](cloud-backup-verification.md). Check that saving shows the **Backed up to Google Drive** toast. Create a second backup from the same page while the access token is valid and check that both dated copies appear without another account prompt. In the fresh profile, open the Drive backup from the welcome screen, check that the downloadable JSON matches the reference, and confirm the restore. Verify the **Restored from Google Drive** toast and the reloaded workspace.

Use **Forget Google Drive account** to clear the page's current access token and choose an account on the next Drive action. The Google session and saved backups remain in the account. Reloading the page also clears its in-memory token.

Google Drive hides this data space from its file interface. Removing the integration or its application data can remove its remote backups. Download a JSON backup from the app when you need an independently retained copy. [Application data lifecycle](https://developers.google.com/workspace/drive/api/guides/appdata)

## Verify deletion and retention

Use a dedicated Google test account or a separate app data space with disposable backups. In the backup list, confirm deletion of a named dated backup and reopen the list to verify it is gone. A deletion is permanent and leaves the open local workspace available. To check retention, create eleven distinct backups and verify that only the newest ten remain after the last operation. Check the count across Jump Clusters for the same account. Download any backup that you want to keep independently. If cleanup fails after an upload is confirmed, use **Retry cleanup** to enforce the limit without creating a second backup.
