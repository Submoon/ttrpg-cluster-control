# mothership-tools

Local-first Mothership campaign cartography app. Campaign workspaces are stored in the browser's IndexedDB; no account or remote workspace service is used.

## Development

```sh
npm install
npm run dev
```

Run `npm run typecheck` and `npm run build` to check the application.

The browser acceptance test uses Playwright. Install its Chromium browser once with
`npx playwright install chromium`, then run `npm test`.
