# Ticket 18 compiled-production QA result

Final candidate `339a106261f206dcf87f2c310915f92bfa9c3e9b`, against ticket baseline `3c660a6a2df6c37f392c998c36d72cec1ddbf938`, passes the scoped compiled-production gate on 2026-10-16. Full source/build/fixture SHA-256 identity and individual observations are in [results.json](results.json).

| Final identity | SHA-256 |
| --- | --- |
| `components/WorkspaceWelcome.vue` | `c6bb0ca07460fa3bb57a3fe8feb8d2422bea8af5c781d0cc777f7a246eacd21e` |
| `tests/workspace-launch.spec.ts` | `46583520032ce0c649af868179cffa0f7244c0828cbb9e5fac6fc2cdcddc51c6` |
| `pages/index.vue` | `f918e80a5fd3e3c79eca7c6f5319461bd006a2361a12444518f9c9399bf9de5c` |
| Compiled Nitro metadata | `9e29db8d9e10015b8661f320377aa4524e9721cc78c74ff2089d66857cb7dbd8` |

`npm.cmd run build` passed in 1m45s using normal filesystem access: Nuxt 4.6.0, Nitro 2.13.4/node-server, Vite 8.3.4, Vue 3.5.43. Existing bundle-size, plugin-timing and upstream DEP0155 warnings remain. An earlier sandbox-only build failed on `realpath(node_modules/vue/index.mjs)` with EPERM; its narrow reproduction also failed, and the authorized normal-access builds succeeded. No source workaround was made.

Runtime was the actual `.output/server/index.mjs` on `http://127.0.0.1:3118`, Playwright Chromium 156.0.8078.4 headless, scale factor 1, dark scheme. Every case used fresh isolated temporary contexts, preserving personal storage. Mobile cases used Chromium touch emulation.

All **41 standalone observations passed**: HTTP 200 SSR loading shell without creation form, hydration, create/save/reload, invalid-current recovery with no editable partial map, Try again, actual backup restoration and durable reload, no horizontal overflow, name preservation across viewport resize, and keyboard focus with the complete computed outline inside the viewport plus center hit testing. Viewports: 1440×900, 390×844, 844×390 and 390×500. Desktop creation used Enter; mobile creation/restoration used touch taps, and recovery retry used Enter. The real-created fixtures were `QA <viewport> Reach` / `QA <viewport> Star`; backup was the validated current record copied to `last-valid` before deliberately damaging `current`. No page errors, console warnings or hydration warnings occurred.

The portable `workspace-launch.spec.ts` ran against compiled 3118 with the owned no-webServer configuration: **2/2 passed in 4.7s**. This includes root create/resume and full-ring creation/recovery keyboard focus. Typecheck was supplied green by implementation; it and the full development suite were not duplicated here.

Actual rendered-background contrast samples pass: minimum text **7.174:1**, name-input boundaries **5.908:1**, recovery action boundaries **5.868/5.889:1**, and creation boundary **8.259:1**. Computed focus colors also exceed 3:1. Sampling combines computed foreground/border colors with screenshot pixels after foreground-only hiding, retaining gradients and transparency. This covers changed welcome/recovery surfaces, not product-wide accessibility.

Same-candidate, server-warm, fresh-context route-only readiness samples at 1440×900 used identical selectors and real creation:

| Route | Response end (navigation ms) | Observed DOMContentLoaded (ms) | Welcome ready (ms) | Saved map ready (ms) |
| --- | ---: | ---: | ---: | ---: |
| `/?variant=baseline` | 24.9 | 174.9 | 293.2 | 522.3 |
| `/` | 12.4 | 147.2 | 240.5 | 425.5 |

Readiness durations start immediately before navigation; response timing uses browser navigation entries. These single integrated samples are neither a source-before/after comparison nor a library-cost claim or performance budget.

Positive viewport-only focus proof: [creation](844x390-creation-button-viewport.png) and [restore](844x390-restore-button-viewport.png). Both complete 5px outline extents fit the 390px viewport: creation bottom 377.609px, recovery bottom 378.266px. Additional welcome/recovery screenshots cover all four sizes. Prior failing candidates remain under `before-fix/` and `after-first-fix/`; injected-CSS exploration is explicitly labeled and supplies no final acceptance claim.

Light-theme validation belongs to ticket 19. Physical Android Chrome, real OS keyboard, safe areas and physical gesture checks remain unavailable; emulation is not physical proof. Compiled QA did not execute the development-only storage-module import case or duplicate the implementation-owned transaction regressions. Runtime is stopped after this result; no QA server remains assigned to the next ticket.
