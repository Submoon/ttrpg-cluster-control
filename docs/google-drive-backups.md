# Verify Google Drive backups

Google Drive backup and restore use the app's Google Cloud project for OAuth and Picker. Each Warden authorizes their own Drive account. Use a test account and synthetic Jump Cluster data for qualification.

## Configure the test project

1. Create or select a test project in Google Cloud. Enable the Google Drive API and Google Picker API. Copy the numeric project number from the project dashboard. [Picker setup](https://developers.google.com/workspace/drive/picker/guides/web-picker)
2. In Google Auth Platform, configure the consent screen and add `https://www.googleapis.com/auth/drive.file`. For an external app in Testing, add the Google account that will run the test under **Audience → Test users**. [OAuth production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
3. Create an OAuth client of type **Web application**. Add `http://localhost` and `http://localhost:3051` as authorized JavaScript origins. Copy the client ID. The browser token flow uses no client secret. [Web client setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)
4. Create a browser API key. Restrict it to the Picker and Drive APIs, and to `http://localhost:3051/*` and `https://docs.google.com/*` for this test. Google Picker renders in a `docs.google.com` iframe. [Picker API key restrictions](https://developers.google.com/workspace/drive/picker/guides/web-picker#enable_the_api)

Set `NUXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID`, `NUXT_PUBLIC_GOOGLE_DRIVE_PROJECT_NUMBER`, and `NUXT_PUBLIC_GOOGLE_DRIVE_API_KEY` in the local process environment or an untracked `.env` file. Start the app with `npm run dev -- --host localhost --port 3051`, and open `http://localhost:3051`. For deployment, configure the same public settings with the applicable Google Cloud project, origins, API key restrictions, consent configuration, and brand verification. [Google OAuth brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)

## Run the live test

1. In the first browser profile, create or restore a synthetic Jump Cluster with GM notes, player publication settings, Fields, relationships, and a saved layout. Download the full JSON as the reference.
2. In **Map files**, start a Drive backup, authorize the test Google account, and select a private writable folder in My Drive. Record the reported filename and destination and confirm the file exists there. Repeat with a shared folder and verify that the app refuses the upload and leaves the earlier backup intact.
3. Open the app in a separate browser profile with no saved workspace. On the welcome screen, choose to open a Drive backup, authorize the same account, and select the saved file. Verify that the restored map survives reload. Download its full JSON and compare the cluster and layout with the reference.
4. Record the app revision, origin, browser, account type, verified outcomes, and any unavailable cases. Store evidence without access tokens, API keys, or personal map data.
