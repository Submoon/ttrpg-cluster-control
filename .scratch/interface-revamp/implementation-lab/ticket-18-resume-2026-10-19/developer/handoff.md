# Ticket 18 implementation handoff

## Scope and source identity

Implemented the bounded launch and recovery presentation correction in `components/WorkspaceWelcome.vue`, with two behavioral regression assertions in `tests/workspace-launch.spec.ts` and `tests/workspace-recovery.spec.ts`. The ready form now uses Nuxt UI card, field, input, alert, and button primitives while retaining the native form, labels, required fields, 80-character limits, names, events, validation flow, busy state, and single persistence owner. Loading and recovery use the same shared card and action primitives. Compact responsive spacing keeps the primary action visible in short landscape and recovery viewports. One confirmed unused style selector was removed.

No header, storage, domain, map, package, or global theme files were changed. The six unrelated pre-existing modified test files were outside this implementation's ownership and were not edited. Prototype B is a seeded loaded-workspace reference and has no matching welcome or recovery form. Dock, overlay, and loaded-header behavior remain ticket 21 scope; this handoff does not certify whole-map fidelity.

- Repository baseline: `28278d90c462fcc0542088513ebd8cf07c7eeaa4` (intentionally based on the ticket feature line, 33 feature-only commits ahead of `origin/main` `629d2a98715c3a16b954e0f77c639b1f0c31212c`).
- Before component SHA-256: `c6bb0ca07460fa3bb57a3fe8feb8d2422bea8af5c781d0cc777f7a246eacd21e`.
- Frozen component SHA-256: `34c92a8d2bdd47c04bdb6b38aadd099d37330d39474b9fbd459e3e890393a385`.
- Frozen launch test SHA-256: `ed02e5cc9f2c23d474b904a04a30d27af2decaf42c7d9b590a7b28c0cdefba61`.
- Frozen recovery test SHA-256: `ff152eadc750b3e13ef9526626388e815d09eb9c54c507492b8649cb126e9f19`.

## Test evidence

The two regression checks demonstrated the original user-visible gap before correction: the Create button occupied only `0.6933` of the short-landscape viewport, and Try again occupied `0.7659` of the reduced-height recovery viewport. Both checks now require the complete action to be in view. The existing functional launch and recovery coverage was retained.

Exact commands and results:

```text
Baseline RED, launch:
npm.cmd run test -- --config .scratch/interface-revamp/implementation-lab/ticket-18-resume-2026-10-19/developer/playwright.ticket18.local.config.ts tests/workspace-launch.spec.ts --grep "short landscape viewport"
Failed as expected: Create local workspace was only 0.6933 in viewport.

Baseline RED, recovery:
npm.cmd run test -- --config .scratch/interface-revamp/implementation-lab/ticket-18-resume-2026-10-19/developer/playwright.ticket18.local.config.ts tests/workspace-recovery.spec.ts --grep "recovery screen explains"
Failed as expected: Try again was only 0.7659 in viewport.

Focused GREEN:
npm.cmd run test -- --config .scratch/interface-revamp/implementation-lab/ticket-18-resume-2026-10-19/developer/playwright.ticket18.local.config.ts tests/workspace-launch.spec.ts tests/workspace-recovery.spec.ts
9 passed (1.0m).

Typecheck:
npm.cmd run typecheck
Exit code 0.
```

The focused run passed after the final component correction. The only subsequent source edit removed the verified unused `.workspace-launch-control` style rule; after that cleanup, all four after screenshots were recaptured from the frozen source. Full-suite, production build, compiled SSR, and independent contrast/focus checks are left for the coordinator's final QA pass.

## Screenshot evidence

Captured with Playwright and installed Chrome `155.0.8059.80`, using isolated contexts and disposable IndexedDB records. Each after route returned HTTP 200; no page errors were recorded. All after layouts had no horizontal overflow. The full Create action was in view at all three ready viewports, and both recovery actions were in view at `390x500`.

Before images used the actual baseline alias `/?variant=baseline`; after images used `/`:

| State | SHA-256 |
| --- | --- |
| `evidence/before/desktop-light-before.png` | `b47cd1ea8debf92ed3325fae9291d7442d3d0d55c3614faa426fadb9884a9b14` |
| `evidence/before/portrait-dark-before.png` | `893d438a6984bb110774caa9a0e995204fb651c30781e27c6c577435a738a0b2` |
| `evidence/before/short-landscape-light-before.png` | `3ab4dca165d04f06ed3f00014ffc177dcfe0ff9c5a33636c39c076aaf1d3cf2e` |
| `evidence/before/reduced-height-dark-recovery-before.png` | `4075dce0fee99ae35eeb3a5c67d1ba6f8d4fb0bd91bd823de0dd767808cb702e` |
| `evidence/after/desktop-light-after.png` | `7b58efc787626f5c8c5b48c3bf5c23dcbafe8b2f686b5a7f59bcc037ebbb225b` |
| `evidence/after/portrait-dark-after.png` | `39644ca74bc749c6f70602326e9d32d21991a0370ada03d9c73571e1d4218712` |
| `evidence/after/short-landscape-light-after.png` | `b07654817381df433ae289cbdfa15061a0b328a34d9217fc5a2e4d41c187cb4c` |
| `evidence/after/reduced-height-dark-recovery-after.png` | `f5bd1f423e141dc1510a652ef73d3c25e35c8c50a7df55941bf0382e48a24746` |

The before and after `capture-report.json` files contain viewport geometry, semantic controls, field metadata, source hashes, response codes, browser version, and error results. The B reference capture is present at `evidence/prototype-B-desktop-light-reference.png` (SHA-256 `f737ec7afee247771db842ec97d420c65ade39ae62e038b6e4676206bf4b7e39`). Its prototype map was still displaying “Preparing the chart…” when captured, so it is only contextual shell evidence and must not be treated as a rendered-map reference.

## Runtime handoff

The healthy, idle Nuxt development server is still running for the coordinator's final suite:

- URL: `http://127.0.0.1:3100`
- Owning exec session: `97647`
- Verified listener: PID `36912`, command `nuxi.mjs dev --host 127.0.0.1 --port 3100`
- Child Nuxt process: PID `53364`, command `@nuxt/cli/dist/dev/index.mjs --host 127.0.0.1 --port 3100`
- Verification: `Get-NetTCPConnection -LocalPort 3100 -State Listen` showed PID `36912` bound to `127.0.0.1`.

The capture script closes each context in its `finally` cleanup and closes its browser. No user browser profile or storage was accessed. Keep this single server as the runtime owner through final tests; stop it after coordinator QA. The first sandbox-only server attempt encountered host `EPERM`; the current elevated server started and served all captures and tests successfully.

## Compiled focus-color correction

Independent compiled QA found that Nuxt UI Button variants and Input base styles apply a 25%-alpha outline token to `:focus-visible`, overriding the Welcome input's earlier utility class. QA measured `1.4566:1` contrast for that outline on the light surface. The component-local scoped rule now sets only the focus outline color to the existing opaque `--focus` token for Welcome buttons and inputs, including recovery buttons. The installed Nuxt UI slots support local overrides, and this scoped selector avoids changing shared component or global palette behavior.

- Updated source SHA-256: `c9d9209bbaea340b2080e9f2441afd19adf87d37e99749667bcf163ca2a05707` (coordinator corrected the handoff transcription against the actual file).
- The rule preserves the existing focus-visible outline geometry and native focus behavior.
- No runtime, tests, or build were run for this correction because independent QA owns the compiled server and is coordinating the required rebuild and re-review.
