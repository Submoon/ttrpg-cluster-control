# Nuxt UI integration, offline resources, and comparative performance

Investigation date: 2026-10-14. Owner: SOL6.1High analysis; Luna XHIGH measurement harness. Decision task: [Measure Nuxt UI integration, offline resources, and comparative performance](../tickets/09-measure-nuxt-ui-integration.md). This artifact supplies evidence for [Confirm Nuxt UI adoption from prototype evidence](../tickets/08-confirm-nuxt-ui-adoption.md); it does not decide library adoption or implement the product.

## Baselines and boundaries

Fresh `git fetch origin` succeeded on 2026-10-14 and was repeated before finalizing the report. Parent `HEAD == origin/main == 629d2a98715c3a16b954e0f77c639b1f0c31212c`, zero commits ahead/behind. The refreshed [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3) remains open, `enhancement`, `priority:P1`, with no comments or scope changes. Existing local AGENTS/planning changes and unrelated `.codex/` files were preserved.

The deliberately different candidate is accepted B at `7ea41e0a9b0e585e23812eb9165e95420d72dc89`, branch `codex/interface-revamp-prototype`. It is a disposable interface trial, not a production refactor. Independent archived source trees and build outputs live under `../measurement-lab/`; the live prototype on port 3113 was neither rebuilt nor stopped. Browser storage used for fixtures belongs only to new throwaway Chrome contexts.

### Shared-fixture gate discovered before benchmarking

The exact B `seedWorkspace()` sample is rejected by `restoreLocalWorkspace` in both archived source trees. Three Orbits have non-contiguous orders within their individual host groups: `orbit-vela-two` is order 2 as its planet's only Orbit; `orbit-vela-three` is order 3 as the sole unhosted Orbit in Vela; `orbit-kestrel-two` is order 2 as the sole unhosted Orbit in Kestrel. [Workspace validation](../../../domain/workspace-schema.ts) requires each host group's orders to be 1 through its Orbit count. This is an invalid demonstration seed, not evidence of a Nuxt UI error. The baseline's refusal to restore it is expected domain protection.

To compare the same valid scene, the laboratory preserves the original fixture/build and changes exactly those three order values to 1 in the shared fixture and the isolated B `seedWorkspace()` copy. The measured candidate is therefore **accepted B plus a disclosed three-value fixture adaptation**; the accepted live checkout is not corrected by this task. IDs, names, placements, radii, rotations, objects, routes and field values remain the same. The fixture contains 3 systems, 4 routes, 13 objects and 6 Orbits; Vela has 6 objects and 3 Orbits. See the [normalization provenance](../measurement-lab/artifacts/fixture-normalization-provenance.json), [source change](../measurement-lab/artifacts/b-fixture-normalization.patch), [original fixture](../measurement-lab/fixture-original.json) and [shared normalized fixture](../measurement-lab/fixture.json). The original and normalized fixture SHA-256 values are respectively `5eaae7d58a73e5fe7a881375714af74f1a62db9816abb29c425f87bb722051f5` and `ddaed1023f81e6060291c45fb9106fdb683216f69c8fe23eb130a7e216d05874`. Executed validator traces accompany the completed measurements below. Original-seed runtime results are distinguished from adapted-fixture results.

Native startup also has different default scenes: baseline `useEditorState` starts in the first system, while B starts in the Jump Cluster. Native first-map observations are reported separately; timed transitions into a common scene supply the comparable interaction measurements. The initial harness timeout while waiting for a baseline cluster is a laboratory expectation error, not an application failure.

The executed [fixture validation output](../measurement-lab/artifacts/fixture-validation.txt) confirms original restoration `false` in both sources and normalized restoration `true` in both. The three systems, all routes and field settings validate after the adaptation. Reproduction uses [the validator probe](../measurement-lab/validate-fixture.mts) and [normalization script](../measurement-lab/normalize-fixture.mjs), without connecting the trial to the user's saved workspace.

## Source integration and responsibility inventory

These are inspected source facts, distinct from executed browser measurements below.

- [Candidate Nuxt configuration](../../../nuxt.config.ts) retains SSR, registers `@nuxt/ui`, disables module font management, and removes the manual Tailwind Vite registration. [CSS entry](../../../assets/css/main.css) imports Tailwind and Nuxt UI once each. The installed Nuxt UI module registers `@tailwindcss/vite` itself (`node_modules/@nuxt/ui/dist/module.mjs`, lines 112–115). This is coordinated registration, not a claim that combined global field styling is already correct.
- [Application provider](../../../app.vue) wraps `NuxtPage` in `UApp`. Installed `App.vue` provides Reka configuration, tooltip/overlay providers and a default `body` portal. [PrototypeMapCanvas](../../../components/PrototypeMapCanvas.vue) keeps both existing D3/SVG maps inside `ClientOnly`, with an SSR fallback and `KeepAlive` keyed by context. The complete shell is not client-only.
- [Workbench](../../../components/PrototypeWorkbench.vue) owns workspace, selection, tool, context and draft state. Its theme starts from `ref('dark')`, and its toggle changes that ref; it writes `html.dataset.prototypeTheme` after mount. It does not connect this preference to durable storage or the Color Mode preference. `.proto-shell[data-theme]` bridges application/map and `--ui-*` tokens inside the shell. Teleported surfaces require a separate observation because they sit outside that token scope.
- Both maps remain application-owned. The candidate changes map gesture filters to respect `moveEnabled`, exposes fit/zoom controls, and adds a system identity attribute. Consequently the comparison measures the complete accepted candidate, not isolated Nuxt UI overhead.

| Surface | Composition / adaptation rationale actually present | Retained Nuxt UI | Evidence boundary |
| --- | --- | --- | --- |
| Inspector envelope | Custom persistent desktop composition; full-height exclusive mobile Inspect. Parent-owned drafts survive presentation mounting. A default modal panel would prevent desktop map interaction, so persistent composition implements the agreed contract. | `UButton`, `UFormField`, `UInput`, `UTextarea`, `USelect`, badges. | Actual map and theme checks below; durable saving is simulated. No claim that every library alternative was benchmarked. |
| Main rail, nested hierarchy, catalogue | Application-specific map commands, nested Orbit/object relationships, explicit subtype selection and glyph catalogue. Native buttons and custom layout are the demonstrated trial. | Nuxt buttons remain in surrounding command/status surfaces; catalogue/hierarchy themselves are native buttons. | This is a broad control trial with material bespoke surfaces, not proof of library use everywhere. Adaptation of a library rail/tree/catalogue has not been demonstrated. |
| Navigation/delete/import confirmations | Controlled `UModal` owned by application state; library does not apply/discard domain data by itself. | `UModal`, `UButton`. | Targeted portal palette/focus observations below; nested native conflict guards remain unmeasured. |
| Native/custom field definitions | Reuses the established native teleported `<dialog>` and native field editor. The added object-draft conflict review lives inside the native top layer, avoiding a separate body-portal modal behind it. | The external Fields launcher is `UButton`; the definition editor is native. | A targeted preservation exception, not a completed broad library migration. Return to the connected Fields launcher is observed in the targeted cases; nested conflict guards remain unmeasured and the palette remains fixed dark. |
| Domain, persistence, interchange and export | Existing domain commands/validation, D3/SVG geometry and JSON/image code retained; prototype save/error/retry is an in-memory simulation. | Library controls present feedback. | No durability, data migration, export accessibility or full preservation guarantee follows from the measurements. |

## Executed measurements

The investigation is complete. The retained SSR shell and client-mounted maps run in the production trial, but the trial does not supply remembered theme behavior, coherent portal palettes or cold offline control glyphs. Desktop costs are measured; mobile interaction comparisons remain partial after real target occlusions. These are reviewable results, not passed adoption gates.

### Conditions and reproduction

The [aggregate with definitions and raw paths](../measurement-lab/artifacts/summary.json), [comparison figure](../measurement-lab/artifacts/comparison.svg), [reproduction commands and laboratory facts](../measurement-lab/artifacts/measurement-facts.md), [harness](../measurement-lab/measure.mjs), [theme probe](../measurement-lab/theme-probe.mjs), and [offline facts and executed commands](../measurement-lab/artifacts/offline-facts.md) retain the traces. Desktop raw records are `artifacts/baseline-desktop-run-1.json` through `-5.json` and `artifacts/B-desktop-run-1.json` through `-5.json`. The two mobile attempt folders preserve checkpoints and failures rather than deleting incomplete runs. Rerun only in isolated source/output directories with fresh throwaway profiles; stop and restart the owned laboratory server after rebuilding so it cannot retain an older manifest. The [TypeScript import resolver](../measurement-lab/resolve-ts-imports.mjs) is required by the executed fixture validator command; bare Node type stripping cannot resolve the domain's extensionless imports.

Chrome `154.0.8037.98` ran headless through Playwright `1.64.0` on Windows `10.0.26200`, Intel i7-1185G7 (8 logical CPUs). Desktop: 1440×900, DPR 1, CPU throttle 1, latency 20 ms, 10 Mbps down / 5 Mbps up. Mobile emulation: 390×844, DPR 1, touch enabled, CPU throttle 4, latency 150 ms, 1.6 Mbps down / 0.75 Mbps up. Both used OS light and reduced motion for the performance series. Five desktop repetitions alternate arm order. Mobile collected two fresh contexts per arm in each of two attempts (four partial records per arm), rather than five completed scenarios.

The baseline restores the shared validated fixture through IndexedDB (`ttrpg-cluster-control`, `workspace`, `current` and `last-valid`) in ephemeral contexts; B initializes its memory seed. Browser cache is cleared after the unmeasured baseline seeding visit. These different data owners are part of native startup and prevent attributing end-to-end startup differences to Nuxt UI alone. The candidate also contains prototype A/C and switching scaffolding; the measured bundle is not a final revamp bundle or an isolated library benchmark. This modest scene is not a dense-content stress test.

### SSR, hydration and first map

The saved [baseline SSR HTML](../measurement-lab/artifacts/baseline-desktop-ssr.html) and [B SSR HTML](../measurement-lab/artifacts/B-desktop-ssr.html) contain **zero actual map SVG elements**. B contains the workbench shell, Fields control and “Preparing the chart…” fallback; baseline has its empty-workspace welcome/header until browser storage hydration. The maps then appear in the client DOM. Successful interactions and zero recorded console/request errors in each completed desktop run establish functioning hydrated controls; an exact hydration-completion time was not instrumented.

Raw `containsClusterSvg`/`containsSystemSvg` substring flags can match CSS class names, so they are not SSR element evidence. The raw `firstSystemSvgServerRendered` name also describes a later client snapshot. The aggregate explicitly corrects this interpretation. Timings below use the first effective SVG mutation, and, where indicated, two animation-frame callbacks afterward; they are readiness proxies, not physical display-paint timestamps.

| Native startup (different initial contexts) | Baseline Vela system | Adapted B Jump Cluster |
| --- | ---: | ---: |
| Desktop first effective SVG mutation, ms; n=5 | 719.3 [679.4–746.3] | 1926.1 [1241.2–2313.7] |
| Desktop mutation + two RAF, ms; n=5 | 741.7 [710.8–801.2] | 1961.2 [1264.8–2413.6] |
| Mobile first effective SVG mutation, ms; n=4 partial | 4407.2 [4105.9–5064.8] | 7840.4 [7203.1–8429.8] |

Values throughout are conventional median [minimum–maximum], with the middle pair averaged for even n. These native times do not compare the same scene. Baseline opens Vela with 6 objects/3 Orbits; B opens the cluster with 3 systems/4 routes and its default selection. Comparable scene actions follow.

### Shared desktop scenes and resource cost

| Action → effective map/dialog + two RAF; ms, n=5 each | Baseline | Adapted B |
| --- | ---: | ---: |
| First measured cluster → Vela | 64.2 [52.4–87.3] | 200.4 [140.5–216.0] |
| First measured Vela → cluster | 59.6 [44.5–73.9] | 56.5 [42.5–66.0] |
| Second, warm cluster → Vela | 59.1 [55.9–66.2] | 73.9 [60.0–91.8] |
| Second, warm Vela → cluster | 55.7 [42.5–59.6] | 43.0 [28.6–67.2] |
| Fields launcher → retained native dialog | 78.5 [63.2–141.0] | 92.5 [73.7–152.4] |

Baseline has already visited Vela at native startup, whereas B's first measured Vela activation is its first visit. The second cycle gives both the same prior map history. Fields measures the reused native dialogue, not UModal. Portal integration is checked separately below.

| CDP received bytes; identical values in all five completed desktop runs | Baseline | Adapted B |
| --- | ---: | ---: |
| Initial JavaScript | 424,152 | 830,902 |
| Initial CSS | 62,957 | 284,514 |
| Initial document | 42,469 | 99,726 |
| Later JavaScript / CSS | 0 / 0 | 0 / 0 |
| Total through scenario/Fields cutoff | 530,188 | 1,216,441 |
| Completed requests at that cutoff | 12 | 16 |

All JavaScript/CSS requests start before the native map mutation and complete by it. B adds 406,750 received JavaScript bytes (1.96× baseline) and 221,557 CSS bytes (4.52×); combined delta 628,307 bytes. Activation of Vela is deferred, but no deferred JavaScript download was observed. Later baseline traffic is 381 other bytes; B is 1,070 other bytes plus a 229-byte image after mount in four of five runs (before mount in the fifth). Initial requests number 11 for baseline and 12–13 for B. No requests remain pending at the cutoff. The differently composed prototypes and source scaffolding preclude attributing all additional bytes to the library or prescribing a universal budget.

### Successful gestures and incomplete comparisons

B desktop pan and wheel zoom change the SVG transform in 5/5 runs on each map. Cluster scripted pan → two RAF is 301.0 [266.3–423.4] ms; system 273.8 [264.3–351.5] ms. This includes six deliberate 18 ms dispatch intervals, so it is a whole scripted gesture duration, not per-input latency. Wheel input → changed transform is 42.3 [40.9–52.2] ms for cluster and 41.4 [38.3–56.2] ms for system. Gesture-window RAF intervals have median 16.7 ms, with zero sampled intervals above 32 ms in each run; this is not a frame-rate guarantee.

Baseline's selected probe point (12% width / 82% height) hits hierarchy/inspector UI rather than SVG on both maps in all five repetitions. No baseline gesture latency is valid (n=0); this point-occlusion result does not establish that the entire map cannot pan. The experiment does not manufacture a comparative pan advantage from missing baseline events.

Mobile B reaches Vela in four partial contexts: 901.3 [778.4–1288.1] ms from the actual context action to map + two RAF. Baseline comparable transition n=0: its visible hierarchy-collapse control is intercepted by the inspector reopen control, then the Vela node target is under a hierarchy heading. B's Aster target remains outside the emulated viewport after the real Fit command, preventing the later inspector/Fields route. No forced DOM click substitutes for a user hit. Mobile warm-return, overlay and gesture comparison n=0. See [initial attempts](../measurement-lab/artifacts/initial-mobile-attempt/) and [focused attempts](../measurement-lab/artifacts/focused-mobile-attempt/) for exact checkpoints. These failures constrain the tested path; they are neither missing numerical zeros nor proven general interface failure.

### Themes, portals and focus

The [targeted theme trace](../measurement-lab/artifacts/theme-probe.json) exercises OS light and OS dark, each with application dark and application light, using fresh contexts. No console/request errors were recorded. Both OS defaults start the application's hard-coded dark theme. Color Mode changes `html.light`/`html.dark` with the OS, while global CSS retains a dark color scheme; it is not coordinated with the shell's own theme. Choosing application light and reloading returns to dark and the memory demo's default cluster/Gannet selection. A remembered choice across reload or a new browser session is unsupported, rather than passed by this disposable state. Frame-by-frame first-styled-display/theme-flash duration was not measured; SSR markup and the loaded theme are distinct observations.

Typed Session notes remain visible across dark → light, with Vela/Aster selection and map transform stable; Escape from the dirty-navigation guard retains the draft and context. The internal serialized workspace probe returns null, so complete applied-data equality or durability is not established by this observation.

| Actual surface, in four OS/application theme cases | Palette observation | Focus/return observation |
| --- | --- | --- |
| Atmosphere USelect menu, outside shell under body | OS light: white background with pale `rgb(232,238,231)` text in both application themes. OS dark: dark `oklch(0.208 0.042 265.755)` background persists even in application light. Shell `--proto-ink`/`--proto-surface` absent. | Focus inside at opening, Breathable option active; real Escape returns to the invoking combobox. |
| Dirty-navigation UModal, body portal | Observed modal body is transparent with pale text and missing shell tokens in both application themes. Outer modal background was not quantified. | Focus inside at opening (Apply and continue); real Escape closes it and returns to the invoking JUMP CLUSTER button, preserving draft/context. |
| Native Fields `<dialog>`, teleported to body | Fixed dark `rgb(18,28,30)` background / pale text in both OS/application themes; application light does not recolor it. | Focus inside at opening; real Escape closes it and returns to the connected Fields launcher in all cases. |

These show a concrete palette bridge gap on library portals and the native exception. They do not constitute a contrast audit, exhaustive Tab trapping, screen-reader validation, or the native field editor's nested conflict-guard test. The earlier native top-layer rationale is retained; no general portal/focus regression is inferred from the tested successful returns.

### Cold and warm Internet loss

Offline resource probes use the **unchanged accepted B production output**, not the normalized performance build. Baseline uses the valid fixture; this separate experiment concerns resources rather than timing equivalence. Fresh headless Chrome contexts use 1280×900, DPR 1. [Offline facts](../measurement-lab/artifacts/offline-facts.md) link exact launch commands, [egress hook](../measurement-lab/deny-egress.mjs), JSON traces and screenshots. Browser routing denies non-loopback requests; the Node hook denies/logs non-loopback `globalThis.fetch` while local application servers remain reachable. This covers the actual icon fetch path, not every possible Node socket API.

| Run | Functional observations | Actual resources |
| --- | --- | --- |
| [Baseline cold](../measurement-lab/artifacts/offline-baseline-cold.json) | Local page remains usable in the tested flow. | 21 requests, 0 failures, 0 server egress. |
| [B cold, fresh server/context](../measurement-lab/artifacts/offline-b-cold.json) | 10/10 tested controls/openings complete across first load and reload: map, native catalogue, Atmosphere/Signal strength selects and delete modal. | 29 requests; one blocked browser request and one denied server egress. Real select chevron/check masks are absent. |
| [B warm, same server](../measurement-lab/artifacts/offline-b-warm.json) | 15/15 openings complete across online warm-up, Internet loss and reload. | 28 requests, no failures. One initial allowed icon fetch, none afterward; real masks retain inline SVG data. |

Cold B's actual `check` and `chevron-down` USelect glyphs trigger the local `/api/_nuxt_icon/lucide.json?icons=check%2Cchevron-down`, which proxies `https://api.iconify.design/lucide.json?icons=check%2Cchevron-down`. The denied fetch produces local HTTP 500, followed on reload by HTTP 200 containing cached `{ "message": "Failed to fetch fallback icon", "statusCode": 500 }`; status 200 alone therefore does not prove success. Browser fallback also fails. The elements have `maskImage`/`backgroundImage: none`. These are controls actually used by B, not diagnostic sentinel dependencies. Menu options remain functionally available, but the missing visual cues are an integration defect.

The installed/generated icon server bundle has no local Lucide collection and enables API fallback. Warm success proves the tested two names survive client/runtime and same-server cache; routing disables browser HTTP cache, so it does not establish disk-cache resilience, a fresh offline server, or every unseen dynamic name. Native Unicode catalogue glyphs and inline map SVG remain. No font requests occur in any run; loaded font families are system/local Trebuchet/Segoe UI and Palatino/Book Antiqua/Georgia stacks. This does not establish identical fonts on a phone. Request totals describe different flows and are not bandwidth/latency comparisons.

A separate `BrowserContext.setOffline(true)` negative control blocks localhost too (`ERR_INTERNET_DISCONNECTED`). It demonstrates transport denial, not a requirement that this non-PWA app cold-load without an application server. Internet unavailable with local server reachable is the relevant external-resource experiment above.

### Production construction

Both isolated production builds completed with exit code 0. Baseline: [successful escalated build](../measurement-lab/artifacts/baseline-build-escalated.log). Candidate B: [production build](../measurement-lab/artifacts/b-build.log). The [first baseline attempt](../measurement-lab/artifacts/baseline-build.log) failed with Windows sandbox `EPERM` resolving `node_modules/vue/index.mjs`; repeating the same build with elevated sandbox permissions succeeded, without changing product source. The logged 48.3 s and 73 s construction durations are environment observations, not user startup metrics. Nitro's total server output size is likewise not browser transfer size.

The [normalized-fixture B rebuild](../measurement-lab/artifacts/b-build-normalized.log) also completed. An old owned laboratory process remained bound to port 3122 across rebuilding and served its cached previous manifest; the corresponding smoke stayed on the SSR fallback with two script HTTP 500 responses. Diagnostic HTML/JSON/PNG are retained. Restarting only that laboratory listener against the matching adapted output resolved the mismatch: [fresh asset health](../measurement-lab/artifacts/asset-health.json) verifies all script/style URLs referenced by both arms' fresh SSR HTML return HTTP 200. The mismatch is excluded from application-performance samples and is not a Nuxt UI compatibility finding. The accepted live server was not involved. After collection, [elevated ownership verification and cleanup](../measurement-lab/artifacts/server-cleanup.json) stopped only the verified laboratory listeners on 3121/3122; the live 3113 server was excluded.

Inspected installed versions: Node 24.18.1, npm 11.16.0, Nuxt 4.6.0, Vue 3.5.43; candidate Nuxt UI 4.11.3, Nuxt Icon 2.5.1, Color Mode 4.0.1, Reka UI 2.10.5. Exact lockfiles accompany each archived source tree. No dependency was added to the product or accepted live checkout during this task.

## Measurement interpretation

The [primary-source methods note](measurement-method-sources.md) records the official definitions used for interpretation. CDP `Network.loadingFinished.encodedDataLength` is received bytes for a request, not an exact response-body size or uploaded request bytes. Resource Timing `encodedBodySize`, decoded size and `transferSize` are different quantities, and cached transfers need separate interpretation. The experiment uses identical collection methods for both candidates.

CPU throttle rate 4 means slowdown relative to this workstation; viewport/touch emulation does not reproduce a phone's CPU architecture, GPU, memory, thermals or virtual keyboard. Network throughput settings are bytes per second, and latency imposes a minimum delay between a request and response headers. Local-server results are controlled comparisons, not public-hosting measurements. SVG presence plus animation-frame waits is a mount/readiness proxy, not directly observed physical display paint. Input dispatch time or an unchanged SVG transform cannot be presented as a successful gesture latency.

## Known production acceptance scenarios

The following requirements are not supplied by the disposable state model. They remain binding under the closed theme and preservation decisions, rather than being silently waived for the library:

1. With no saved preference, launch under OS light and OS dark. Compare server HTML, the earliest styled display, hydrated controls, map tokens and body-portaled overlays. There must be one resolved application palette and an explicit theme control, without a disruptive opposite-theme first display.
2. Save an explicit light preference under OS dark; reload and launch a new browser session. Repeat explicit dark under OS light. Shell, both map levels, menus and native/library dialogues must use the saved choice. The trial's hard-coded initial ref and in-memory toggle cannot pass this requirement.
3. With an edited object/route/field draft and an applied map placement, toggle theme and hide/reopen the editor. Compare draft identity/content, selection, context, tool, viewport and serialized applied data before/after. Apply must remain distinct from durable saving; a real save failure/Retry/reload/backup scenario requires the production adapter.
4. Exercise fresh library overlay and select-menu portals in both themes, including inside the native field dialog or its eventual adapted replacement. Preserve top-layer stacking, keyboard containment and return to the actual invoking control; shell-local tokens alone do not establish this.
5. Package the icons actually used by controls, including dynamically selected names, and make the resource policy explicit. Test a fresh server/browser while Internet access is unavailable but the local app remains reachable, plus warm use of newly opened controls. Browser-only blocking cannot prove that a local icon endpoint avoids server-side Internet fetches.

[Validate the selected B direction on representative devices and preservation flows](../tickets/10-validate-b-device-preservation.md) remains the dependency for physical-device, complete accessibility, long/dense editing, export and preservation evidence. It was not claimed or resolved by this investigation. Its named device/preservation artifact must also answer the precise incomplete interaction questions here: find and verify an unobstructed baseline SVG target for both desktop maps; demonstrate a reachable common Vela/Aster mobile path, with Inspect hidden before gestures and a visible Fields or Inspect Manage launcher; then collect actual successful pan/zoom, return and overlay observations, without bypassing hit-testing. The partial records above supply starting contexts and failure checkpoints.

The final adoption review must distinguish those remaining device/usability unknowns from known implementation gaps: invalid original demo seed, cold icon packaging, global theme/portal coordination, and preference persistence. Fixing these gaps belongs to later product integration and its acceptance scenarios, rather than an extra expansion of this disposable trial. Full serialized data equality, save/error/Retry/recovery, export and nested native-field focus/guard flows remain explicit requirements of the existing preservation dependency. No independent new research prerequisite is required to describe the failures established here; the human adoption decision stays blocked on the open device/preservation investigation and cannot treat this evidence-task closure as a technical pass.
