# Fields prototype final-fixture QA

This folder records the browser QA after three seeded Orbit order values were corrected to `1`. The change restored the existing per-host ordering invariant; it did not change Orbit identities, hosts, centers, radii, settings, or saved values. The domain validators and import rules remain unchanged.

## Frozen source and runtime

The QA harness verified that every prototype source file in the disposable preview runtime matched the checkout and that all preservation-boundary files matched the baseline. The relevant source SHA-256 values are:

| File | SHA-256 |
| --- | --- |
| `components/PrototypeWorkbench.vue` | `5381B59E8DB1529B741DE03FBFC50391FE4FE7335DB445362E1B107B6285A686` |
| `components/PrototypeFieldDefinitionsDialog.vue` | `0C2FB832A373AE28B3E94DE24EE048E3417B410A2ACE1305BF306E09CC2D5148` |
| `components/PrototypeInspector.vue` | `9F4655A59D58267FDCE020B7443BD9EB73FFC802FB025CFAEEDC2692304C7A17` |
| `components/prototype-fields-fixture.ts` | `4C9D549935AA1E7786AF50BEE96D8EC4A771D464C79B72BE57CE735BF35B00A1` |

The source baseline is `c9ba3f3f41eb54c63ba2645e1c06b569ab485157`. The reports identify the preview runtime as `.scratch/interface-revamp/preview-build` and the local prototype URL as `http://127.0.0.1:3139/?variant=B&controls=dock`.

## Pure seed and import proof

[`seed-import-validation.json`](seed-import-validation.json) records a direct domain proof. The one-off script extracts the actual `seedWorkspace` declaration from the Vue setup script, transpiles it with the installed TypeScript compiler, and supplies the actual `toNormalizedMapPoint` helper. It then uses the installed `jiti` loader for the unchanged `isLocalWorkspace`, `minimumOrbitRadius`, `createDenseFieldsFixture`, and `prepareJsonImport` implementations.

Both normal and dense seeds passed `isLocalWorkspace`, every saved Orbit radius met the validator's host-dependent minimum, and the exact replacement-map fixture produced a valid combined workspace with four systems. The dense seed contains 13 objects and 424 custom-value assignments. The proof records the source and fixture hashes. Its `importFixtureSha256` hashes canonicalized JSON; the browser harness records the fixture file's raw-byte hash, so those two fixture hashes use different encodings.

Reproduce from the repository root:

```powershell
node .scratch/interface-revamp/device-preservation-lab/artifacts/fields-flow-2026-10-16/final-fixture/validate-seed-import.mjs
```

## Browser evidence

[`ui-import-check/qa-fields-flow.json`](ui-import-check/qa-fields-flow.json) is the standalone check of the hidden-draft import guard after the seed correction. It passed: the harness hid the visible Inspector through its accessible Hide control, selected a valid replacement map through the real file picker, and attempted to confirm it. The guard rejected replacement, reopened Fields at the dirty creation draft, and preserved the entered name; no replacement was applied. The source manifest shows the checkout and preview runtime hashes agree. The report records Chrome 155.0.8059.41 via Playwright and Node v24.18.1.

[`full-matrix/qa-fields-flow.json`](full-matrix/qa-fields-flow.json) is the unchanged 26-case matrix on the same frozen source and runtime. **Final result: 26/26 passed, with zero browser page errors.** The report includes the runtime and source manifest, per-case viewport and outcome, the raw fixture hash `8C3F9ACF20F148B185D773A2E5567E6E6925C21E1241054247BA8CC693FB1B94`, and the evidence paths. The run produced 44 screenshots. It records Chrome 155.0.8059.41 via Playwright and Node v24.18.1.

The matrix covers desktop, portrait, short-landscape, and short-portrait browser viewports, including dense-field layouts, list/detail navigation and focus, draft retention and guarded transitions, invalid Apply behavior, create/edit/delete, exact saved-value impact review, scope changes that retain stored assignments, object conflicts, the blocked replacement attempt, keyboard focus, Escape behavior, and active map Add retention. It exercises Chrome through Playwright with fresh browser contexts and UI actions; DOM reads are used only for evidence. These viewport checks do not establish acceptance on a physical phone or tablet, physical keyboard behavior, or safe-area hardware behavior.

Reproduce only the hidden-draft import guard case against the same running local server:

```powershell
$env:FIELDS_RUNTIME_ROOT = '.scratch/interface-revamp/preview-build'
$env:FIELDS_QA_OUTPUT = '.scratch/interface-revamp/device-preservation-lab/artifacts/fields-flow-2026-10-16/final-fixture/ui-import-check'
$env:FIELDS_CANDIDATE_ID = 'Frozen final fixture repair 5381B59E'
$env:FIELDS_CASES = 'hidden-draft-blocks-workspace-import'
node .scratch/interface-revamp/device-preservation-lab/qa-fields-flow.mjs
```

Reproduce the final matrix against the already-running local server from the repository root:

```powershell
$env:FIELDS_RUNTIME_ROOT = '.scratch/interface-revamp/preview-build'
$env:FIELDS_QA_OUTPUT = '.scratch/interface-revamp/device-preservation-lab/artifacts/fields-flow-2026-10-16/final-fixture/full-matrix'
$env:FIELDS_CANDIDATE_ID = 'Frozen final fixture repair 5381B59E'
Remove-Item Env:FIELDS_CASES -ErrorAction SilentlyContinue
node .scratch/interface-revamp/device-preservation-lab/qa-fields-flow.mjs
```

The browser runner requires access to the local loopback server at port 3139. Its source manifest, generated fixture, screenshots, per-case results, and browser metadata are stored in the selected output folder.

## Preserved earlier attempts and limits

Earlier results remain unchanged in sibling folders. `after/qa-fields-flow.json` is the initial 26-case run on the pre-seed-fix source snapshot (Workbench SHA-256 `BD6B28F0BA3C7DC4509AB6E519BC502D0B8A439870947FEFDFBF4A428A3EE802`, dialog `0C2FB832A373AE28B3E94DE24EE048E3417B410A2ACE1305BF306E09CC2D5148`): 22 passed, 4 failed. Three failures were harness assumptions: a deletion focus text comparison, an applicability screen lookup, and an attempt to edit an Inspector input underneath an open modal. The import attempt in that first run did not reach the guard because the visible Inspector intercepted the Map files click. A later attempt used the Inspector's visible Hide control and reached import preparation; it exposed invalid seeded Orbit order values that caused unchanged final workspace validation to reject the otherwise valid fixture. The harness now checks actual focus identity, reads the root's screen attribute, respects the modal boundary, and hides the visible Inspector before opening Map files.

The four-case corrected rerun, its import-only attempts, and the interrupted partial run are retained in their original folders. They are historical evidence from earlier snapshots and are not combined with the final run's count. The visible Dock/menu overlap and Map-files/Inspector overlap are tracked separately in the existing device-preservation review; this matrix uses the real Hide control for import and does not claim that overlap as resolved. The seed proof verifies only the current seeded Orbit orders and radii; future Add Orbit ordering across host scopes and broader Orbit order limits were not part of this Fields matrix.
