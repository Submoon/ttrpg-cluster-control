# Ticket 20 implementation results

## Baseline and scope

Implementation used `e014a549e405bb283acb4368d45bdf484ca68d0a` as its baseline (ticket 19 closed and pushed); `629d2a98715c3a16b954e0f77c639b1f0c31212c` was an ancestor. The frozen ticket 20 contract and its approved delete-preview clarification were followed.

Chart names are held in a parent-owned session tied to the captured Jump Cluster and star-system IDs. Escape and modal dismissal hide the form while preserving the draft and validation error; explicit Discard ends the session. A guarded transition offers Apply, Discard, or Stay for chart names, while independent map operations keep the chart draft available. Apply ends the chart session after synchronous validation and memory publication; durability continues separately and any failure stays visible in workspace feedback. Other legacy inspector editors retain their existing Discard/Stay behavior.

The Nuxt UI modal uses its supported open/close focus lifecycle: it focuses the invalid field or clean first field on entry, returns focus to the captured external opener on close, and falls back to the main landmark when that opener is no longer available. `UFormField` associates validation with only the affected input. Live Chromium measurement found the default field-error color at 3.77:1 against the modal's actual `rgb(255, 254, 250)` background. Mapping `--ui-error` to the app's semantic `--error` token changed the rendered color to `rgb(152, 47, 35)` and the measured ratio to 7.52:1.

The chart modal keeps Nuxt UI for its structure and controls. A narrow content-class style adapter gives its keyboard focus ring the semantic `--focus` color and disables the button's focus-color transition: Chromium initially rendered the default transitioning ring at about 25% alpha, while the adapter produces an immediate opaque `rgb(155, 63, 0)` ring with 6.70:1 contrast against the rendered modal panel. The adapter is limited to focused buttons inside this modal.

`applyWorkspace` synchronously validates, detaches, and publishes once, then returns the queued durable acknowledgement. Retry enqueues a detached snapshot of the latest applied memory without publishing it again or replaying a domain command. Revision checks keep older save notifications from changing newer status, and a prior failure remains visible until the newest successful write. Export feedback remains separate and chart drafts stay out of exported JSON.

System deletion presents its initial review before resolving a chart draft that targets the system. Canceling that review retains the exact draft and performs no workspace write. After Apply, the current workspace is reacquired and the refreshed deletion plan is confirmed before commit. Changed workflow documentation now describes the accepted guard choices, draft scope, and separate memory/durability outcomes.

No schema, codec, database adapter, map layout/dock/camera, or domain model changes were included.

## Verification

| Check | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed (exit code 0) after the final selection, import, focus, and test updates. |
| `tests/workspace-chart-drafts.spec.ts` + `tests/workspace-theme.spec.ts` | 23 passed together against the real app: 19 chart-draft cases and 4 theme cases. |
| Recovery: “the last valid workspace can be restored after the current snapshot fails to load” | 1 passed earlier in this implementation session, before the final selection, import-navigation, focus, and palette updates. |
| Data import: “the Warden can validate and import an independent JSON copy” | 1 passed earlier in this implementation session, before the final selection, import-navigation, focus, and palette updates. |
| Live field-error contrast | 3.77:1 before the semantic token mapping; 7.52:1 after it, measured against the rendered modal background. |
| Live keyboard focus contrast | Opaque semantic ring measured at 6.70:1 against the actual modal panel with the immediate focus-color transition disabled. |

The chart suite covers hide/resume, Escape and close-button focus return, actual Chromium `beforeunload` dismissal, Apply/Discard/Stay, clean and invalid transitions, latest-workspace reacquisition after Add system, independent object placement, target-specific deletion preview and cancellation, failed writes, latest-snapshot Retry, stale success and failure callbacks, export-error separation, actual JSON export/reload, and delayed import acknowledgements racing with pending object/Orbit/route guards. Import completion also verifies Stay preservation and explicit Apply/Discard navigation for a newly created chart draft. IndexedDB interception is test-owned and restored in `finally` blocks.

Playwright used the temporary no-webServer config in this directory and the existing development server on `127.0.0.1:3100`. The contrast probe is `contrast-probe.mjs`. Checks cover desktop Chromium with viewport emulation. No physical Android device/browser, touch gesture, or keyboard hardware was tested. The production build and full repository suite remain with the assigned QA/integration pass. The owned server and its child were stopped after the checks; port 3100 was confirmed free.

## Frozen source and test hashes

SHA-256 values identify the implementation snapshot handed to integration review.

| File | SHA-256 |
| --- | --- |
| `composables/useLocalWorkspace.ts` | `8FC3BD9969DFCF72E846F937D13D243248597A36750839B15CBCCCFDB95679CF` |
| `composables/useEditorWorkflows.ts` | `063A52C5617806209ED7FEDE7FDDD558094E80F49E494D5E59286B4A5B75EDD2` |
| `composables/editor-workflows/useEditorState.ts` | `D5F3B472754A7367F072E491C02739A28D67ECE5EDCE2297029560A4C2F8AEF8` |
| `composables/editor-workflows/types.ts` | `EB607AF81E7A69E3770316AEF32C6EAB3459A4A8D72B71E505B6A39F86E9C4A1` |
| `composables/editor-workflows/useClusterWorkflows.ts` | `ABCFDEB7E37112B05752CDA306859B1ABD331B18E807EA2E601D33DB2D44DA42` |
| `composables/editor-workflows/useMapWorkflows.ts` | `CB670E51E3DEADDC7241DED1FB6B91018966CF600B5D1901A0F48DD03382E9E3` |
| `composables/editor-workflows/useFieldDefinitionWorkflows.ts` | `23398171805C290880E3B517061BAEA27EB627DCF57C57AD5C7A437E5385F28D` |
| `composables/useWorkspaceFiles.ts` | `32F94CB14523335ABC33BC5FC089A30838C49A117F1BF4B1C98522E743B8D578` |
| `components/BaselinePage.vue` | `30C3DBECDC5935669B055FCD3E859A2909D4B804DC0B569B4006976064AE75C7` |
| `components/ChartNamesDialog.vue` | `F7A00D52FEDCF98F8E6E73379F7E10C10DDA4CC3A92F54E886A3DE6233E58236` |
| `components/MapInspector.vue` | `775300115E4133E1E82BE9B35212A87C684DE1153A3599074B35F4267B935461` |
| `components/MapHierarchy.vue` | `2D046E728AED64DFDE18971ECB251C0B017EB82FA5873D4D52F35BD16E7869FD` |
| `components/inspector/ChartDetailsPanel.vue` | `A3147D38E8B440DA1448F7412A64D5E6FAD37515C2D53AF7685DCC632E441173` |
| `components/inspector/JumpRouteInspector.vue` | `82ABDFF2B13D43C829FFF9DF1D005D652B79FF7965641FB0CCCA6BDFBADB58A8` |
| `assets/css/main.css` | `12B2226BED626904C253621C9FD9B5C0AC9E97507B5940DF864D9BBFD47BF093` |
| `assets/css/map-workspace.css` | `91E1629E0AE2DFAFCE7B2BDAF04412CE03E2E18F8DC9BBFFF5B340124B354EAB` |
| `tests/workspace-chart-drafts.spec.ts` | `35A0FF73A1D34E7E7A62847F6F760516DAFFBE296729F8F00F0EE0A21D55E938` |
| `tests/workspace-theme.spec.ts` | `93FE9AA8F98926CD61C7E4F068485282971BF142A23D994FED760DDE704741E6` |
| `tests/workspace-data.spec.ts` | `756B8F5E09F1A15FF32665BA86D393BF2991378A4420043D54EEE9C4BDA3FD74` |
| `tests/workspace-recovery.spec.ts` | `892F9B06ABBF23B81CFDD56A5036FBA7689A8E6E617F8DE97B92A52EDBE26FCF` |
| `tests/helpers.ts` | `B8AE760CC44611EF5C2C333DCDEEDA7B0966431628A5C32C9058564288F2C32A` |
| `.scratch/interface-revamp/implementation-lab/ticket-20/playwright.config.ts` | `3060BA5540C626BE87FC29EBB0B3BB6EAD5DB37F4EEA9F17154E1CCDE280685A` |
| `.scratch/interface-revamp/implementation-lab/ticket-20/contrast-probe.mjs` | `31990CE9052CF6422E346494ADF13063C74CC00D4027A3D2A544D6D866348AE9` |
