# Interface copy review

## Source and baseline

- Source: [Review and simplify interface copy across the app, issue #63](https://github.com/Submoon/ttrpg-cluster-control/issues/63), fetched on 2026-11-24. The issue was open with no comments.
- Implementation baseline: `1b92b53aa4335f194dd1055a6361c974b6bf049c`, fetched `origin/main` and local `main`; branch `codex/issue-63-interface-copy`.
- The worktree initially pointed at `48873799dac97b84856db676176b5c6b869b5620`. Implementation starts from the newer baseline, which includes the continuous Warden map.
- The pull request branch was rebased onto `64fb539d1be2f82b9f4b194a522c13fa8d642b3f`. The intervening changes concern repository documentation and development tooling. The application and test source match the locally verified candidate.
- [Map files, issue #59](https://github.com/Submoon/ttrpg-cluster-control/issues/59) is complete. Review the current grouped file actions rather than the earlier panel.

## Decisions

Keep labels, map and entity identity, current state, validation, recovery, and action consequences at the point of use. Move optional walkthroughs to the existing Help dialog, which has desktop and compact entry points. Required information must remain available without hovering. Preserve the vocabulary in `CONTEXT.md` and existing guarded commands.

| Reviewed surface | Finding and decision |
| --- | --- |
| Idle Warden map | Remove the persistent “KNOWN SYSTEMS / ROUTES / EXTERNAL EXITS” and select/zoom instructions. Navigation and inspection are already covered by Help. Keep instructions visible during Add and system placement. |
| Hierarchy | Move the persistent Add Orbit/hosting/empty-Orbit walkthrough to Help. Keep hierarchy identity, selection, publication state, and empty states. |
| Orbit inspection | Keep the schematic-scale clarification. Move routine center-movement instructions to Help. |
| Object and Jump Route inspection/editing | Keep publication state, endpoint context, draft state, and validation alerts. “Review the marked fields” is conditional validation feedback, not routine session-start prose. |
| Field definitions | Remove the duplicate visible introduction and shorten the modal description. Keep native/custom scope, applicability, saved values, player sharing, impact reviews, and pending-draft choices. |
| Search and filters | Keep labels, active criteria, and contextual empty states: these describe the current view or next action. |
| Add palette, creation and placement controls | Keep next-step guidance, previews, candidate choices, keyboard placement, errors, and confirmation actions. These messages appear while the associated task is active. |
| Header, map chrome and chart details | Keep map identity, meaningful panel headings, current publication state, and draft actions. |
| Save feedback, history and deletion reviews | Keep failure/retry/download recovery, unapplied-work notices, bounded-history context, dependency counts, and deletion consequences. These are conditional or intentionally opened for review. |
| Workspace setup and loading/recovery | Keep the welcome headline and one browser-storage/optional-backup explanation. Remove the single-step counter, repeated local-storage footer, and duplicate loading/error kickers. Keep errors and all recovery actions; render the setup footer only for a save error. |
| Complete backup review | Remove the repeated body heading and question. Keep the incoming and active names and the replacement consequence in the scrollable body so long names can wrap. Keep the source file, recovery-copy explanation, download-current action, stale-review warning, and explicit draft-discard consent. |
| Star System import review | State once that the import adds an independent copy to the active Jump Cluster. Remove repeated body headings; retain existing action labels, counts, collisions, possible matches, Field conflicts, and ID/applicability consequences. |
| Google Drive backup and restore | Shorten the retention wording while keeping the app as policy owner, the account-wide limit, permanent deletion only after a successful new save, and local JSON advice. Keep failures, progress, retry and deletion confirmation. |
| Dropbox backup and restore | Keep the existing retention, replacement, deletion and error messages; they explain an active operation and its consequences. |
| Player preview and reader | Remove the repeated preview kicker and duplicate idle Inspector headings. Keep the chart title, publication/disclosure distinctions, conditional selection guidance, empty states and navigation controls. |
| Map files and player links | Retain the grouped actions from #59, formats, private/public labels, image scope, and all progress/errors. Shorten supplemental hints. Make the whole-Jump-Cluster sharing scope and anyone-with-link access warning visible in the Share submenu as well as the generated-link dialog. |

## Verification

Chrome on the first production build covered desktop and compact setup, the Warden editor, active Add guidance, Fields, keyboard and touch access to Help, player preview, and the visible link-access notice. Compact restore screenshots revealed clipped 80-character names in the dialog header. The final candidate keeps those names in the scrollable body and permits a break within an unbroken name.

The pure suite reported 705 passes and one Windows junction creation error (`EPERM`). The unchanged junction test passed when run outside the sandbox. The first browser run passed setup, compact menu/Help/Fields, and recovery. Player reader, reviewed system import, and touch takeover reached their existing test deadlines. The run and traces are retained in `test-results/playwright-1795597269088-49144-73e66e6b/`.

The final candidate passed lint, type checking, the production build, and independent source review. All three timed-out browser journeys passed on the final build when run after the visual pass, with a 90-second default timeout. The player reader's explicit 60-second timeout was unchanged. The final visual pass verified 80-character names at 844 × 390 and 390 × 640, the scrollable download action, and opening a Warden-exported JSON in the player reader on desktop and compact screens. Screenshots and browser reports are in `test-results/issue-63-audit/`.

Viewport emulation covers desktop and compact layout as well as browser keyboard and touch interactions. No physical device or screen reader was used.
