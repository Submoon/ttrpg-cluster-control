# Playwright helper and locator contracts

Planning baseline: `971e91c0ad2fc78e4f92c1e625091a577960b41b`, matching the fetched `origin/main` on 2026-10-30. These notes describe the ticket 05 implementation contract for tickets 06-08; they do not replace contributor testing guidance or count as evidence that browser execution was reduced.

## Locators

- Use role and accessible name for ordinary controls. Keep assertions about the visible name and role when they are part of the behavior.
- `workspaceMapContextType(page)` scopes to the named Map context navigation and uses `data-testid="workspace-map-context-kind"` for its short type label. The adjacent chart heading remains a user-facing heading and can contain the same text as the type label.
- `openWorkspaceHierarchy(page)` returns the currently visible desktop complementary panel or compact dialog and intentionally dismisses the Add chooser. Use that returned scope before locating entity rows; do not call it again after preparing a visible palette drag source, and do not search both responsive representations globally.
- `activeWorkspaceFeedback(page)` selects the non-inert page feedback or the compact recovery region. `workspaceZoomControls(page)` uses its named toolbar.
- Chart statistic values have statistic-specific test IDs. Scope them to the named Jump Cluster or Star System statistics region, and keep the corresponding visible label assertions where they matter.
- The hierarchy exposes `data-object-id`, `data-orbit-id`, and `data-host-object-id` from the current domain records. SVG map entities retain their existing `data-object-id`, `data-orbit-id`, and `data-system-id` attributes. These identify rendered records across a rename; they do not replace assertions about the current accessible name.

## Creation helpers

- `createSingleSystemWorkspace(page)` keeps the public workspace-creation path and returns names plus the observed system and primary-object IDs.
- `addClusterSystem(page)` waits for the visible cluster map and an existing system mark before snapshotting its rendered system IDs; the prepared map must contain at least one system. It returns the ID of the newly observed system. With `{ open: true }`, it opens that same rendered mark by ID and checks the resulting system map identity.
- `addCatalogueObject(page, subtype, options)` and `clickDockAction(page, 'Add orbit', options)` return the generated object or Orbit ID observed in the rendered map. Use those IDs to target later operations.
- Prefer explicit placement targets: `{ kind: 'free', x, y }`, `{ kind: 'orbit', orbitId, angleDegrees }`, `{ kind: 'center', x, y }`, or `{ kind: 'host', objectId }`. The current type also retains the older explicit `label` and `name` variants so unmigrated callers keep working; new cases should use domain IDs.
- `selectInspectorOption` can select a USelect option by its descendant domain identity attribute. The creation pickers expose IDs on option content while preserving the user-facing option text. Existing accessible-name checks remain useful for the picker contract.
- When no target is supplied, catalogue placement uses the selected hierarchy Orbit's ID when available, otherwise a free point. Orbit creation uses a selected object or hosted Orbit's object ID when available, otherwise the center. If placement or relationship is part of a scenario's precondition, pass it explicitly instead of relying on these convenience defaults.

## Isolated state and owned probes

- Browser `page` fixtures have independent contexts. `campaignTest` can prepare one immutable IndexedDB snapshot through the public import journey, then clone that snapshot with `structuredClone` into each fresh test context. Its origin and storage state must stay aligned. Import, creation, hydration, and recovery scenarios keep their public paths when those workflows are under test.
- `openImportedCampaignWorkspace(page)` waits up to 15 seconds for the named Map context to appear after navigation before using its ordinary 5-second locator assertions. In the 2026-10-30 trace, the first Vue bootstrap message appeared about 5.1 seconds after page creation (trace timestamps 6.28 to 11.39 seconds), while the ordinary readiness assertion expired during archive opening. The bootstrap message does not itself establish readiness. This dedicated preparation phase keeps the 30-second test budget intact and does not change general assertion or test timeouts; it does not resolve the historical F6 diagnosis.
- `abortNextWorkspaceWrite(page, operation)` observes and aborts exactly one real `current` workspace `put` in a read-write IndexedDB transaction, delegates to the original method, asserts that the abort occurred, and restores the original prototype descriptor in `finally`. It does not replace the workspace writer.
- `captureMapExportBlobs(page)` observes real `URL.createObjectURL` calls while delegating to the original browser method. `downloadJson` and `downloadImage` consume the captured blobs. The shared page fixture releases the observer during teardown on both passing and failing tests. Tests that create a separate browser context must release its observer before closing that context.
- Never share a live page, browser context, or mutable workspace between tests. A snapshot may be cloned; its source should remain immutable for the worker lifetime.

- The local launcher owns a separate readiness browser context for each verification epoch. Wait until the previous child and cleanup finish before pressing Enter. A fresh epoch verifies the owned server and current inputs after a compatible idle edit. Keep per-test contexts independent, even when the server remains alive. See the [supported runner guidance](../../docs/agents/testing.md#current-runner-and-commands) for incompatible edits and retained evidence.

## Limits

- Stable selectors and reusable preparation are support for reliable tests, not evidence of fewer browser scenarios. Coverage dispositions and measured execution changes belong in the implementation inventory.
- Domain IDs show which rendered record a locator targets. Use an export or the relevant public workflow when persistence or serialized data is the contract.
- Explicit test IDs are reserved for incidental presentation targets. Do not add them to ordinary actions that already have a meaningful role and accessible name.
