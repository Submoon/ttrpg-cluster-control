# Production Fields modal probe

This folder records a focused production-browser check of the Fields dialog placement correction and its field-action controls. The application source baseline is `9d7de58e347169fa9744dfefe502d77d83769935`; the frozen candidate changes only these files:

- `PrototypeFieldDefinitionsDialog.vue` — SHA-256 `17F34EA3F2B9D4020A8C0BAE5690B7564F9091D3C69F510A17C8B45E41900F4A`
- `PrototypeWorkbench.vue` — SHA-256 `0DC9F3C4D887384EEF0ECA39BB5FD2CC8954641895947454EBB794402BB03FA9`

The reported production baseline at 1137×1244 measured x=-519.5, y=-73.703125, width=1088, height=695.703125, with `translate: -50% -50%` plus a computed transform matrix translating by (-544, -347.852). It failed both the viewport-bounds and 2 px centering checks. The coordinator's production measurement and baseline build limitation are recorded in the [interface-revamp research note](../../research/fields-modal-position-2026-10-16.md); no local baseline screenshot or successful local baseline build is claimed.

The corrected local production build passed with `npm run build` (exit 0, about 2m15s), and `npm run typecheck` passed (exit 0). The first sandboxed baseline build attempt failed during Nitro output with `EPERM` while resolving `node_modules/vue-router/vue-router.node.mjs`. The candidate build and loopback browser probe then ran with the required elevated local execution; no dependency or application permissions were changed.

The [probe script](probe-production-modal.mjs) produced a [passing JSON report](artifacts/production-modal-qa.json): four cases, zero page errors, and no failed assertions. The exact repro route `/?variant=B&controls=dock&fieldsActions=footer` now measures x=25.4737, y=294.1270, width=1086.0527, height=655.7461 at 1137×1244, with a center delta below 0.001 px on both axes. The dialog is fully inside the viewport.

The no-query route defaults to one footer action region with no header region. It exposes the list's Add command once and the detail's New custom field command once. The production Fields button reopens a modified creation draft after Close; Back returns to the definition list. At 390×844 and 844×390, the dialog fills the viewport and the Add and Edit actions remain visible within its bounds.

The first interaction attempt targeted “Return to Fields draft,” which belongs to the development-only prototype switcher and is absent from production. That harness attempt stopped at the unsupported control; its JSON was overwritten by the corrected passing run, so there is no raw first-attempt artifact. The script was corrected to reopen through the normal production Fields button, and no application change was needed for that flow.

Screenshots:

- [1137×1244 reported route](artifacts/production-repro-1137x1244.png)
- [1137×1244 default footer](artifacts/production-default-footer-1137x1244.png)
- [390×844 portrait](artifacts/production-390x844.png)
- [844×390 landscape](artifacts/production-844x390.png)

Run the probe from the repository root while the candidate production server is listening on `127.0.0.1:3142`:

```powershell
& 'C:\Users\fbal-fontaine\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.scratch/interface-revamp/device-preservation-lab/modal-position-probe-2026-10-16/probe-production-modal.mjs'
```

This is a focused geometry and action-reachability check. It does not rerun the earlier 26-case development-server matrix or establish keyboard acceptance.
