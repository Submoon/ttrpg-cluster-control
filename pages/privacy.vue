<template>
  <main class="privacy-page">
    <article class="privacy-article" aria-labelledby="privacy-title">
      <NuxtLink class="privacy-back-link" to="/">← Back to TTRPG Cluster Control</NuxtLink>

      <header class="privacy-header">
        <p class="privacy-kicker">TTRPG CLUSTER CONTROL</p>
        <h1 id="privacy-title">Privacy policy</h1>
        <p class="privacy-updated">Last updated November 14, 2026</p>
        <p>
          This policy explains how this browser-based campaign mapping app handles workspace data,
          optional Google Drive backups, and player-facing exports.
        </p>
      </header>

      <section aria-labelledby="local-data-title">
        <h2 id="local-data-title">Workspace data on this device</h2>
        <p>
          TTRPG Cluster Control saves your current workspace in this browser's IndexedDB for this site.
          It also keeps a last-valid workspace snapshot for recovery. The workspace can include your
          complete Jump Cluster, including private GM notes, map content, player publication settings,
          and Fields. The app does not require an account or send this workspace to an application
          server for ordinary editing.
        </p>
        <p>
          Browser site data can be cleared through your browser settings. Clearing this site's data may
          erase both local workspace copies. The browser also stores the selected light or dark theme
          preference locally.
        </p>
      </section>

      <section aria-labelledby="drive-title">
        <h2 id="drive-title">Optional Google Drive backups</h2>
        <p>
          If you choose a Google Drive backup or restore action, the browser connects directly to Google
          Drive using Google's <code>drive.appdata</code> scope. This scope is used for this app's private
          application data folder. The app uses it to create dated Jump Cluster backups and to list,
          read, restore, or download those backups that you choose. It does not use this feature to
          browse your regular Drive files.
        </p>
        <p>
          A backup is a complete Jump Cluster JSON file and can include private GM notes and other
          workspace content. Its filename is based on the cluster name and backup time. When you open
          the restore list, the app displays backup names and dates from Google Drive.
        </p>
        <p>
          When Google Drive is configured, the browser loads Google's Identity Services library to
          prepare Drive actions. This does not open an OAuth window or request Drive access. OAuth
          starts only when you choose a Drive backup or restore action. The short-lived Google access
          token is kept in page memory; it is not saved in the workspace or browser storage, and
          reloading the page clears it. At the start of each backup, the app reads Google's opaque
          account permission ID and holds it in page memory with that pending attempt. If an upload's
          result is uncertain and you retry it, the app compares the current ID with the original one
          to confirm the same Google account. If an upload result is ambiguous, the app may also read
          the metadata and contents of the exact file created for that attempt to check whether Google
          saved the expected backup.
        </p>
        <p>
          TTRPG Cluster Control accesses, uses, and transfers Google user data only to create a backup
          you request, list available backup files and their names and dates, read a backup you select to restore or download,
          reconcile an ambiguous upload by checking its expected file, and verify the same account
          before retrying that upload. It does not use this data for unrelated purposes. Google's
          <a href="https://developers.google.com/terms/api-services-user-data-policy#limited_use">API Services User Data Policy, including Limited Use</a>,
          governs these uses. See also Google's
          <a href="https://developers.google.com/workspace/drive/api/guides/appdata">Drive app data documentation</a>.
        </p>
      </section>

      <section aria-labelledby="player-sharing-title">
        <h2 id="player-sharing-title">Player exports and links</h2>
        <p>
          Player JSON and image exports are prepared in your browser and downloaded when you request
          them. A generated player link contains a compressed snapshot of the content you have chosen
          to publish, placed in the URL fragment. Anyone who receives the complete link can open and
          copy that snapshot. Share it only with people you intend to receive it; later workspace edits
          do not change an already-created link.
        </p>
      </section>

      <section aria-labelledby="hosting-title">
        <h2 id="hosting-title">Website hosting</h2>
        <p>
          The public site is hosted by Vercel. Vercel delivers the site and may process request or
          diagnostic information under its
          <a href="https://vercel.com/legal/privacy-notice">Privacy Notice</a>. The app's workspace
          editing and Google Drive backup operations run in your browser; workspace content is not
          uploaded to a TTRPG Cluster Control application server.
        </p>
      </section>

      <section aria-labelledby="retention-title">
        <h2 id="retention-title">Retention and deletion</h2>
        <p>
          The local current workspace remains in this browser until replaced or deleted with browser
          site data. The last-valid snapshot is updated as the workspace is saved and remains available
          for local recovery until it is replaced or the site's browser data is cleared.
        </p>
        <p>
          Google Drive backups remain in your Google account until you remove them. In the app's
          restore list you can download a JSON copy. Choosing <strong>Forget Google Drive account</strong>
          clears the current page's access token so a later Drive action can choose an account; it does
          not sign you out of Google, revoke Google access, or delete backups. Reloading the page also
          clears that token.
        </p>
        <p>
          You can revoke the app's Google access in your
          <a href="https://myaccount.google.com/connections">Google Account connections</a>. Revoking
          access is separate from deleting Drive app data. To remove the app's hidden Drive data, open
          <a href="https://drive.google.com/drive/settings">Google Drive settings and Manage apps</a>
          and uninstall or remove the app if Google provides that option. Google's
          <a href="https://developers.google.com/workspace/drive/api/guides/appdata">Drive app data documentation</a>
          explains this app-data lifecycle.
        </p>
      </section>

      <section aria-labelledby="contact-title">
        <h2 id="contact-title">Contact</h2>
        <p>
          For a privacy question or to report an issue, use the project's
          <a href="https://github.com/Submoon/ttrpg-cluster-control/issues">public GitHub issue tracker</a>.
          Issues are public, so do not include private campaign content, access tokens, or account details.
        </p>
      </section>
    </article>
  </main>
</template>

<script setup lang="ts">
defineOptions({ name: 'PrivacyPolicyPage' })

useSeoMeta({
  title: 'Privacy policy | TTRPG Cluster Control',
  description: 'How TTRPG Cluster Control handles local workspace data, Google Drive backups, and player exports.',
})
</script>

<style scoped>
.privacy-page {
  min-height: 100vh;
  padding: clamp(1rem, 4vw, 3rem) 1rem;
  background: var(--app-bg);
  color: var(--text-primary);
}

.privacy-article {
  width: min(100%, 54rem);
  margin: 0 auto;
  border: 1px solid var(--line-soft);
  border-radius: 3px;
  padding: clamp(1.1rem, 4vw, 3rem);
  background: var(--panel-bg);
}

.privacy-back-link,
.privacy-article a {
  color: var(--accent-hover);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.16em;
}

.privacy-back-link {
  display: inline-block;
  margin-bottom: clamp(1.5rem, 5vw, 3rem);
}

.privacy-header {
  margin-bottom: 2.5rem;
}

.privacy-kicker {
  margin: 0 0 0.5rem;
  color: var(--text-muted);
  font: 0.68rem Consolas, monospace;
  letter-spacing: 0.1em;
}

.privacy-header h1 {
  margin: 0;
  font-family: Georgia, serif;
  font-size: clamp(2rem, 6vw, 3.25rem);
  font-weight: 400;
  line-height: 1.08;
  letter-spacing: -0.025em;
}

.privacy-header .privacy-updated {
  margin-top: 0.8rem;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.privacy-article section + section {
  margin-top: 2rem;
}

.privacy-article h2 {
  margin: 0 0 0.65rem;
  font-family: Georgia, serif;
  font-size: clamp(1.2rem, 3vw, 1.5rem);
  font-weight: 500;
  line-height: 1.25;
}

.privacy-article p {
  margin: 0.75rem 0 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.7;
}

.privacy-article code {
  border: 1px solid var(--line-soft);
  border-radius: 2px;
  padding: 0.08em 0.28em;
  background: var(--panel-raised);
  color: var(--text-primary);
  font-size: 0.88em;
}

.privacy-article a:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 3px;
}

@media (max-width: 480px) {
  .privacy-page {
    padding-inline: 0.6rem;
  }

  .privacy-article {
    padding: 1rem;
  }
}
</style>
