# Wayfinder production measurement facts

This report records browser measurements and observed behavior for the accepted interface candidate. It contains no adoption recommendation and applies no performance budget.

## Build and fixture identity

- Baseline production source: `629d2a98715c3a16b954e0f77c639b1f0c31212c` in `source-baseline/`.
- Accepted prototype source: `7ea41e0a9b0e585e23812eb9165e95420d72dc89`.
- The measured B build is the accepted source plus exactly three lab-only orbit-order literal changes so that B's in-memory `seedWorkspace()` and the baseline IndexedDB seed describe the same restorable fixture. The accepted B build is preserved at `source-b-original-output/`; the patch and source/hash provenance are in `b-fixture-normalization.patch` and `fixture-normalization-provenance.json`. The accepted prototype worktree was not changed; only the isolated `source-b/` copy received the patch.
- The raw accepted fixture has 3 systems, 4 routes, 13 objects, and 6 orbits. Baseline source remained exact. Baseline uses `fixture-baseline.json`; B uses the matching three-order-adjusted fixture. The rejected raw restore and validation output are preserved in `fixture-validation.txt`.
- Isolated production builds ran from `source-baseline/` and `source-b/`; logs are `baseline-build-escalated.log` and `b-build-normalized.log`. Production servers used only ports 3121 and 3122. After the measurements, elevated `netstat`/process inspection confirmed port 3121 belonged to PID 43024 and port 3122 to PID 26912; only those two lab processes were stopped, and both lab ports were then clear. Port 3113 was excluded and untouched.
- Browser environment: Chrome 154.0.8037.98, Node v24.18.1, Windows 10.0.26200 x64, Intel i7-1185G7, 8 logical CPUs. CPU and network throttles are relative to this host, not a phone.

## Reproduction

The source tarballs are restorable into separate copies. From the repository root, the following recreates the source copies, applies the measured B seed adjustment in the isolated copy, normalizes the common fixture, and validates both schema restorers:

```powershell
New-Item -ItemType Directory -Force .scratch/interface-revamp/measurement-lab/source-baseline | Out-Null
New-Item -ItemType Directory -Force .scratch/interface-revamp/measurement-lab/source-b | Out-Null
tar -xf .\.scratch\interface-revamp\measurement-lab\baseline-source.tar -C .\.scratch\interface-revamp\measurement-lab\source-baseline
tar -xf .\.scratch\interface-revamp\measurement-lab\b-source.tar -C .\.scratch\interface-revamp\measurement-lab\source-b
node .\.scratch\interface-revamp\measurement-lab\apply-b-fixture-adaptation.mjs
node .\.scratch\interface-revamp\measurement-lab\normalize-fixture.mjs
node --experimental-strip-types --import ./.scratch/interface-revamp/measurement-lab/resolve-ts-imports.mjs ./.scratch/interface-revamp/measurement-lab/validate-fixture.mts *> .scratch/interface-revamp/measurement-lab/artifacts/fixture-validation.txt
```

`apply-b-fixture-adaptation.mjs` is idempotent and changes only the three documented `seedWorkspace()` order values. `normalize-fixture.mjs` preserves the original JSON and hashes, then writes the normalized fixture to both `fixture.json` and `fixture-baseline.json`. The small `resolve-ts-imports.mjs` hook resolves the schema's extensionless relative `.ts` imports for Node's type stripper. Validation reports both raw restorers false and both normalized restorers true.

The original B output used by offline probes is already preserved at `source-b-original-output/`, with `server/` and `public/` directly inside it. It came from the isolated original B production build before fixture adaptation, not the live prototype output. If recreating that output from source, first install from the original B archive's lockfile and build the unmodified extraction; copy its `.output` contents into a fresh preserved-output directory **before** running `apply-b-fixture-adaptation.mjs` and rebuilding. The normal performance reproduction below uses the adapted B source; it cannot reconstruct the original output afterward. Do not copy or build the live prototype for this reproduction.

The source tarballs do not contain dependencies. Each measured source copy has a separate physical `node_modules` tree (not a junction); `npm ls --depth=0` succeeded for both. Baseline resolves `nuxt@4.6.0`, `@playwright/test@1.64.0`, `d3@7.9.0`, Tailwind 4.3.3 and TypeScript 6.0.3; B resolves the same core versions and also `@nuxt/ui@4.11.3`. For a clean archive extraction, install dependencies independently from `source-baseline/package-lock.json` and `source-b/package-lock.json`; do not share one tree between them:

```powershell
Push-Location .\.scratch\interface-revamp\measurement-lab\source-baseline
npm ci
Pop-Location
Push-Location .\.scratch\interface-revamp\measurement-lab\source-b
npm ci
Pop-Location
```

Build the isolated copies, then start their production servers on localhost ports 3121 and 3122 with the provided script:

```powershell
Push-Location .\.scratch\interface-revamp\measurement-lab\source-baseline
npm run build
Pop-Location
Push-Location .\.scratch\interface-revamp\measurement-lab\source-b
npm run build
Pop-Location
Push-Location .\.scratch\interface-revamp\measurement-lab
.\start-servers.ps1
Pop-Location
```

With those servers running, run the five-sample desktop matrix and regenerate the aggregate and standalone SVG:

```powershell
$env:SAMPLES = '5'
$env:CONDITIONS = 'desktop'
node .\.scratch\interface-revamp\measurement-lab\measure.mjs
node .\.scratch\interface-revamp\measurement-lab\summarize-evidence.mjs
node .\.scratch\interface-revamp\measurement-lab\render-comparison.mjs
node .\.scratch\interface-revamp\measurement-lab\theme-probe.mjs
```

The four-context mobile attempt used the same command with `SAMPLES='2'` and `CONDITIONS='mobile-emulation'` in each of the initial and focused harness passes; the resulting partial/failure files were copied to the two named attempt folders. The harness did not complete five comparable mobile samples. The equivalent reproduction command is:

```powershell
$env:SAMPLES = '2'
$env:CONDITIONS = 'mobile-emulation'
node .\.scratch\interface-revamp\measurement-lab\measure.mjs
```

The offline sibling's exact commands are in `offline-facts.md`:

```powershell
node .\.scratch\interface-revamp\measurement-lab\offline-probe.mjs --mode cold --target both
node .\.scratch\interface-revamp\measurement-lab\offline-probe.mjs --mode cold --target b --b-build-dir .\.scratch\interface-revamp\measurement-lab\source-b-original-output
node .\.scratch\interface-revamp\measurement-lab\offline-probe.mjs --mode warm --target b --b-build-dir .\.scratch\interface-revamp\measurement-lab\source-b-original-output
```

Desktop settings: 1440×900, device scale 1, CPU throttle ×1, 20 ms latency, 10 Mbps down / 5 Mbps up, reduced motion, five fresh-profile samples per arm, interleaved baseline/B. Baseline is seeded into fresh origin-scoped IndexedDB; B starts from its accepted in-memory demo workspace. The lab normalization makes those fixture values equivalent. Every run saved raw JSON, HTML, screenshots, request traces, and partial checkpoints in `artifacts/`.

Mobile settings requested 390×844, touch, CPU throttle ×4, 150 ms latency, 1.6 Mbps down / 0.75 Mbps up, reduced motion, five samples per arm. The run did not complete the comparable interaction path. The two initial and two focused attempts per arm remain in `initial-mobile-attempt/` and `focused-mobile-attempt/`; summary statistics treat these as partial fresh contexts, not a completed five-sample benchmark.

## Desktop observations

The native initial map differs: baseline starts in Vela system; B starts on the cluster with Gannet selected and the desktop Inspect panel open. Keep these startup figures separate. First cluster→Vela activation also has different map history: baseline had already visited Vela as its native initial scene; B's first Vela visit is from cluster. The warm cluster→Vela→cluster cycle follows a shared cluster/Vela visit in both arms.

| Measure | Baseline, n=5 | B, n=5 |
| --- | ---: | ---: |
| Native first-map DOM mutation + 2 RAF | Vela system: 742 ms [711–801] | Cluster: 1,961 ms [1,265–2,414] |
| First cluster→Vela click to visible SVG + 2 RAF | 64 ms [52–87] | 200 ms [141–216] |
| First Vela→cluster click to visible SVG + 2 RAF | 60 ms [45–74] | 57 ms [43–66] |
| Warm cluster→Vela click to visible SVG + 2 RAF | 59 ms [56–66] | 74 ms [60–92] |
| Warm Vela→cluster click to visible SVG + 2 RAF | 56 ms [43–60] | 43 ms [29–67] |
| Native Fields dialog click to 2 RAF | 79 ms [63–141] | 93 ms [74–152] |
| JavaScript received by Fields checkpoint | 424,152 B | 830,902 B |
| CSS received by Fields checkpoint | 62,957 B | 284,514 B |
| All CDP received bytes by Fields checkpoint | 530,188 B | 1,216,441 B |

Map readiness is the first effective visible map SVG DOM mutation plus two animation frames, a paint proxy rather than a compositor paint timestamp. The Fields measure is the reused native Field Definitions dialog, not the UModal. CDP `loadingFinished.encodedDataLength` is consistently labelled received bytes; it is not upload volume or an exact wire-byte count.

All JavaScript and CSS requests had completed by the first native map mutation in every desktop sample. No JavaScript or CSS request started after that boundary. After map mutation, baseline started one request per run; B started three or four, with median 1,070 B of `other` and 229 B image received in the median sample. The later Vela activation therefore does not establish deferred JavaScript download. No requests were pending at the pre-reload cutoff.

The populated map had 3 cluster nodes and 4 routes, and the Vela system had 6 objects and 3 orbits. The broader fixture has 13 objects and 6 orbits, a modest test dataset.

## Gestures and mobile limitations

B's fixed SVG pan and wheel-zoom points changed the actual map transform in 5/5 cluster and 5/5 system samples. Scripted pan duration (six 18 ms moves plus two RAFs) was 301 ms [266–423] in cluster and 274 ms [264–352] in system. Wheel input to observed transform change was 42 ms [41–52] and 41 ms [38–56], respectively. Median RAF interval was 16.7 ms, with no intervals above 32 ms in these samples.

Baseline desktop gesture samples were 0/5 at both fixed probe points because the selected test points were covered by panels (`elementFromPoint` landed outside the SVG). This describes those probe points; it does not establish that the whole baseline map is unnavigable. A comparable baseline gesture result remains an evidence follow-up.

The four partial mobile fresh contexts per arm produced these startup-to-map-mutation summaries (even-n median is the midpoint of the two central samples): baseline's native Vela map 4,407 ms [4,106–5,065]; B's native cluster 7,840 ms [7,203–8,430]. B cluster→Vela measured 901 ms [778–1,288] across four partial contexts; baseline had no comparable transition measurement. These figures are partial emulation observations, not a complete n=5 mobile comparison.

The mobile interaction path stopped on real UI geometry. Baseline's hierarchy panel intercepted pointer input at the selected Vela node/control. In B, the Aster object remained outside the viewport even after using the visible Fit control; the real locator click did not succeed. Mobile gesture and Fields-dialog comparisons are n=0. The raw failure and partial JSON records preserve the click target and stage; no forced DOM click was used.

## Theme, portal, and focus observations

Four fresh B contexts covered OS light/dark crossed with app dark/light. In each context, the USelect option received focus when opened and Escape returned focus to its combobox. The UModal received focus and Escape returned focus outside to `JUMP CLUSTER`; the draft note and Vela context stayed intact. The native Fields dialog received focus and returned it to the connected Fields launcher after Escape/close. These focus outcomes held in all four theme combinations.

The USelect menu is teleported under `body` and its sampled background follows OS color scheme, not the app shell: `rgb(255, 255, 255)` under OS light and `oklch(0.208 0.042 265.755)` under OS dark, including when app theme differs. Its sampled text remains pale `rgb(232, 238, 231)` and the portal has no local `--proto-ink` token. The teleported UModal body also has no local `--proto-ink`/surface token; its computed background is transparent and its text is pale. The wrapper surface was not included in that body-color sample, so no full modal contrast claim is made. The native Fields dialog measured `rgb(18, 28, 30)` background and `rgb(232, 238, 231)` text in both app themes.

Switching app theme dark→light preserved the visible draft note, Vela context, Aster selection, and map transform in the probe. The Vue internal workspace snapshot was unavailable (`null`), so full workspace equality was not measured. On reload the app returned to its default dark theme; a persistent app-theme preference was not observed. In these captures `html` color scheme remained dark while the app-owned shell switched theme.

## SSR and error accounting

The saved pre-hydration HTML files contain zero actual `<svg>` elements, including zero map SVG elements, in both arms. The raw `containsClusterSvg`/`containsSystemSvg` booleans are substring checks that match class names in the SSR markup, not evidence of a server-rendered SVG. Map timing rows are post-hydration client DOM observations.

Across all 10 desktop production runs, the harness recorded zero console/page/request errors and no hydration warnings. Baseline favicon requests returned HTTP 200 in all five runs. B favicon and the Nuxt Iconify endpoint for `check`/`chevron-down` returned HTTP 200 in all five performance runs. Theme probes also recorded no failures. The separate controlled egress tests are documented in `offline-facts.md`: a fresh B server without outbound Iconify access fails to supply the two USelect icon glyphs, while warm runtime cache scenarios succeeded. That finding is separate from the normal online performance traces.

## Artifacts

- `summary.json`: aggregate metrics and conditions, including corrected even-n mobile medians and the SSR markup caveat.
- `comparison.svg`: standalone chart built from `summary.json` and observed medians/ranges; it shows common desktop transitions and JS/CSS bytes, while visually separating dissimilar native initial scenes.
- `baseline-desktop-run-*.json`, `B-desktop-run-*.json`: raw n=5 results, including CDP request traces and errors.
- `baseline-desktop-ssr.html`, `B-desktop-ssr.html`, startup/system/Fields screenshots: rendered evidence.
- `theme-probe.json`, `theme-light-light.png`, `theme-dark-light.png`: theme/portal/focus traces and screenshots.
- `initial-mobile-attempt/`, `focused-mobile-attempt/`: preserved mobile partial and failure records.
- `offline-facts.md`: sibling probe's separate cold/warm icon-resource observations.
- `server-cleanup.json`: elevated listener/PID confirmation and final owned-server shutdown state.
