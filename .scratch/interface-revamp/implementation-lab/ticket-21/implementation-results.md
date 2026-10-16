# Ticket 21 implementation results

## Baseline and TDD evidence

Implementation started from ticket 20 commit `338cc138200da11e3e50cfd8eea071bacb17474a`. The first healthy pre-change browser case failed because the real application root did not expose the required `Workspace navigation` toolbar. The same user-facing navigation case passed after the implementation slice landed. The initial failure was recorded in the implementation ledger; no exact command is restated here because its original log is not retained in this report.

Follow-up red/green checks found and fixed three concrete integration issues:

- Compact fullscreen panels inherited desktop left/right offsets and only occupied the row below the header. At 844×390, the inspector/hierarchy did not cover the available viewport. Compact layout now hides the inert header row, gives the panel the full compact grid track, and clears the desktop side offsets. The panel bounds and focus-return tests then passed.
- A selected SVG map entity is replaced when D3 redraws the selected scene, so saving its DOM node did not restore focus after closing Inspect. The layout now remembers a stable entity ID selector and resolves the replacement SVG target on return.
- The page-level save/recovery footer was inert and behind the compact modal. A shared stateless `WorkspaceFeedback` presentation now renders in the active compact panel while the page footer remains the desktop presentation. A real IndexedDB write-abort test verifies that the error, Retry, and current-JSON export are available and that Retry succeeds without closing the panel.

## Validation

All Playwright checks used the prewarmed local development server on port 3100 and the temporary no-server config under this directory. No full suite or compiled build was run; QA owns the single compiled full-suite run after review.

| Command / scope | Result |
| --- | ---: |
| `npm run typecheck` (final run) | Passed, exit 0 |
| `npx playwright test --config=.scratch/interface-revamp/implementation-lab/ticket-21/playwright.config.ts tests/workspace-navigation.spec.ts` | 13 passed |
| Same config, `tests/workspace-panels.spec.ts` | 4 passed |
| Same config, `tests/workspace-touch-takeover.spec.ts` | 2 passed |
| Same config, `tests/workspace-chart-drafts.spec.ts --grep "failed chart writes keep applied memory"` | 1 passed |
| Same config, `tests/workspace-chart-drafts.spec.ts --grep "delayed import navigation that meets an invalid new draft|import completion with a new chart draft"` | 3 passed |

The focused cases cover navigation versus selection, pan gestures on entities, native stationary context menus and right-drag pan, A→B→A camera/selection memory, deletion pruning, Select-mode rename of system B while system A remains active, Move selection, keyboard pan without stealing Orbit geometry keys, retained catalogue drops, compact panel focus and draft retention, nested chart-dialog focus, two-contact takeover and delayed-click suppression, and delayed import guards. Touch events ran through Chromium emulation; they are not physical-device results.

Existing Playwright assertions for the exact “Saved on this device” state were preserved and scoped to the currently active feedback owner with `activeWorkspaceFeedback(page)`. Ticket 21-specific locator updates preserve behavior assertions while replacing controls/layout assumptions that no longer apply, such as the removed persistent Pan tool and old absolute panel/menu positions.

## Limits and handoff

Physical Android Chrome, operating-system keyboard behavior, and device safe-area rendering were not available. The QA handoff should validate the compiled candidate, the eight presentation/theme/viewport cases, and the full suite once. At source freeze, the owner verified that launcher 22276 and its owned subtree (including listener 54204) were absent and port 3100 had no listener; only the stale ticket-21 PID marker was removed. Runtime ownership is released to the compiled QA owner. No product build or full-suite pass is inferred from this handoff.

## Frozen source SHA-256

These hashes identify the principal implementation, state-boundary, and focused-test files at handoff:

| File | SHA-256 |
| --- | --- |
| `components/BaselinePage.vue` | `839D0A90564169B8E6FA0CFC50400ECBBDB23D5E76250661F7DD69A8793DE8BB` |
| `components/MapEditorLayout.vue` | `A2EBBFD480CE7C882AD0604B5A04CEE7EE43C7AA23A96ADEB3F14C209284830A` |
| `components/WorkspaceFeedback.vue` | `386FF7BCA7B74383A60A6DBDFFA5DF5960ABDADA1FCBFB31103B017A93A90C62` |
| `components/WorkspaceHeader.vue` | `6E7ABB726BE768F3B79EE361E4862FBA299B2625B7595CF31A7BF0C6D368E850` |
| `components/WorkspaceDock.vue` | `1738DC5D178FB27B08F416EFF0AA9249DE48A78335A4596B36AC8879D21A526B` |
| `components/WorkspaceMapCanvas.vue` | `7EE5D98704B62091022C898B5FAF7630975D3A4BBDE96BF0FF75228989A6C18F` |
| `components/ClusterMap.vue` | `330BEAC78097C78E9C57BD836B05AB6191BFE6692FEC0D14DAE33180BD24C8EB` |
| `components/SystemMap.vue` | `0241889CD0006D4D6D515F193361A10105EA6F2F609A0648CA555C4C512292C1` |
| `components/maps/system-map-renderer.ts` | `E0A752F05C72A8E628A1DBCF2D841A1BA811756E4124ECD5A43C182E3284D254` |
| `utils/map-zoom.ts` | `99BACEEB7C3056E632218F119CC9BF94992A764346615B4B31CF366536CA0FFF` |
| `composables/editor-workflows/useEditorState.ts` | `039E047DF79FAB8F55E1885F5DADCD4F98E6D80C31AB677BBBCC958FE8173BBF` |
| `composables/editor-workflows/useClusterWorkflows.ts` | `985BE90139165EF20309E37E8BE2088BCB2A490B66A0190A8C9120D3D6252107` |
| `composables/useWorkspaceFiles.ts` | `B947BC588E8580BCEC2039AAF5D7EB4AAAB6F76A57DA3200EACE75965029E376` |
| `tests/workspace-navigation.spec.ts` | `DDF47A3F010533D64EC9B9573B9542C2A0C683070652F92A733F803B30B85B12` |
| `tests/workspace-panels.spec.ts` | `9A6B521D1C9EC89FE1F2D43395D9DACD6612C5477EF42794B69E503DD0583C99` |
| `tests/workspace-touch-takeover.spec.ts` | `7018DA6D5C48E2889679F021C1287AB9033457A785CC280AECD4C5B55F283569` |
| `tests/workspace-chart-drafts.spec.ts` | `59574114745F4D9C43B2AF334B0ADDEDF2B131A23E74375AE2892888A88E008C` |
| `tests/helpers.ts` | `FCC5F9883C8506E82AF95F716C601B9F138B6AE76A8F93BB8ECED29731D43702` |
| `assets/css/map-workspace.css` | `EB777A17DE825B496C9BC14B98BCE00A08105CA25C9696F13E90723C13181C3E` |
| `assets/css/main.css` | `12B2226BED626904C253621C9FD9B5C0AC9E97507B5940DF864D9BBFD47BF093` |
