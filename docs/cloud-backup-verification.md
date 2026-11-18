# Verify a cloud backup on a real account

Use this procedure to verify a provider's behavior with its real OAuth grant and storage API. Follow the provider setup in [Google Drive](google-drive-backups.md) or [Dropbox](dropbox-setup.md). Treat automated tests with controlled provider responses as separate evidence.

## Prepare the test

1. Name the behavior to prove and the product decision it informs. Confirm the account type, administrative project or tenant, required scopes, exact test origin, and callback or origin registration before asking someone to sign in. Use a dedicated test account and provider test application with synthetic data.
2. Prepare a synthetic Jump Cluster that covers notes, Fields, player publication, relationships, and layout. Download the complete JSON as the reference. Keep only disposable backups in the test destination for deletion and retention checks.
3. When a person needs to act, give them the exact screen or action, the result they should look for, and what to report. Record their observed outcome separately from API responses. Mark a result unverified when the necessary observation is missing.

## Verify and record the result

1. Back up the fixture from an isolated browser profile. Record the acknowledgement and where the backup was saved.
2. Authorize the same test account in a fresh isolated profile. Restore the dated backup, compare the complete portable data with the reference, and reload to check that the restored workspace stays available.
3. Record the application revision, browser, exact origin, account type, access mode, verified outcomes, and unverified cases. Use synthetic names or redacted summaries in GitHub issues, reports, screenshots, and traces.

Reserve `NUXT_PUBLIC_*` for the public OAuth client identifier or app key. Keep client secrets, tokens, authorization codes, bypass credentials, actual campaign files, and personal account details out of Git and shared evidence. Inspect browser diagnostics before publishing them.
