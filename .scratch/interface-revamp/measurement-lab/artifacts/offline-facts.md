# Wayfinder task09 offline resource facts

This is a controlled resource-behavior probe of the baseline and accepted B build. It records observed browser and server behavior; it does not make an adoption recommendation.

## Identity and sample

- Baseline: `629d2a98715c3a16b954e0f77c639b1f0c31212c`.
- Accepted B: `7ea41e0a9b0e585e23812eb9165e95420d72dc89`, launched from the preserved original production output at `source-b-original-output/`.
- Browser: installed Chrome `154.0.8037.98`, Playwright `1.64.0`, Node `v24.18.1`, headless at 1280×900 with device scale factor 1.
- The sample has 3 systems, 4 routes, 13 objects, and 6 orbits. B used its unchanged in-memory `seedWorkspace()` from the original output. Baseline used an origin-scoped IndexedDB seed.
- `fixture-original.json` SHA-256: `5eaae7d58a73e5fe7a881375714af74f1a62db9816abb29c425f87bb722051f5`. Baseline used `fixture-baseline.json`, SHA-256 `ddaed1023f81e6060291c45fb9106fdb683216f69c8fe23eb130a7e216d05874`. The baseline-only copy changes three invalid per-host single-member orbit order values to `1`; object identities, positions, and relationships are retained. Treat this as a baseline seed compatibility adjustment.

## Method

The probe launched fresh production server processes only on localhost ports 3123 (baseline) and 3124 (B). Its disposable Node hook wraps global `fetch`, allows loopback, and logs or denies server-side off-host fetches. Playwright routing separately permits loopback while blocking off-host HTTP(S) requests in cold/offline phases.

The real B UI sequence opened Vela Reach, selected Aster, opened the Add mark catalogue, opened Atmosphere and Signal strength USelects, and opened the map-mark deletion UModal. Cold mode performed this sequence after internet denial and again after reload. Warm mode performed it online, again on the already-loaded page after internet denial, and after reload while the same server process remained alive.

Playwright request routing intercepts the browser requests and disables Chromium's HTTP cache. The warm run therefore measures the page's in-memory UI and the server's Nitro runtime cache; it is not a browser disk-cache offline test. A separate `BrowserContext.setOffline(true)` negative control blocked both localhost and the external Iconify URL with `net::ERR_INTERNET_DISCONNECTED`. That control is transport evidence only and does not imply a PWA requirement.

The commands used were:

```powershell
node .scratch/interface-revamp/measurement-lab/offline-probe.mjs --mode cold --target both
node .scratch/interface-revamp/measurement-lab/offline-probe.mjs --mode cold --target b --b-build-dir .scratch/interface-revamp/measurement-lab/source-b-original-output
node .scratch/interface-revamp/measurement-lab/offline-probe.mjs --mode warm --target b --b-build-dir .scratch/interface-revamp/measurement-lab/source-b-original-output
```

The first command produced the successful baseline cold result and an early B locator attempt. The final B cold result is from the second command. Earlier locator failures are preserved as `offline-b-cold-attempt1-failed-locator.json` and `offline-b-cold-attempt2-failed-hierarchy-close.json`; they are excluded from the result counts below.

## Observations

| Run | Browser requests | Failed requests | Server off-host fetches | UI exercise |
| --- | ---: | ---: | ---: | --- |
| Baseline cold | 21 | 0 | 0 | Seeded surface rendered |
| B cold, plus reload | 29 | 1 | 1 denied | 10 of 10 scenarios completed; both cold and reloaded UI remained usable |
| B warm, loaded-page offline, then reload | 28 | 0 | 1 allowed during initial online load | 15 of 15 scenarios completed across all three phases |

In the B cold run, actual USelect controls requested `check` and `chevron-down` from Iconify: browser URL `https://api.iconify.design/lucide.json?icons=check%2Cchevron-down`, with the corresponding same-origin Nuxt endpoint `http://127.0.0.1:3124/api/_nuxt_icon/lucide.json?icons=check%2Cchevron-down`. The external fetch was denied. The first same-origin response was HTTP 500 with `Failed to fetch fallback icon`; the reload response was HTTP 200 but contained the cached error body `{"message":"Failed to fetch fallback icon","statusCode":500}`. This is a real dependency of the Atmosphere and Signal strength USelect chevron and selected-option check glyphs, not an unused sentinel. The menus and catalogue still opened, and the catalogue's Unicode glyphs remained visible. In cold mode, the USelect icon elements had neither a CSS mask image nor a background image, so those glyphs were blank.

In the warm run, the same endpoint returned HTTP 200 with the `lucide` JSON paths for `check` and `chevron-down`. After switching off-host fetches off, both the already-loaded page and a reload against that still-running server retained working controls. The controls' computed styles contained `data:image/svg+xml` CSS masks for both icon paths, sized 20×20 pixels. The warm server log records one allowed Iconify fetch at initial online load and no later off-host fetch; reload was served from that process's runtime cache. The app map itself contained one inline SVG in all sampled B states.

There were no font network requests in any run. The sampled B page reported `document.fonts.status = "loaded"`; computed stacks were `Trebuchet MS`, `Segoe UI`, sans-serif for body text and `Palatino Linotype`, `Book Antiqua`, Georgia, serif for headings. This is consistent with local/system font stacks and does not show a remote font dependency.

The deletion UModal opened in every B phase with heading `Remove this map mark?`. It exposed no button with an accessible name matching “close” in the sampled dialog; the scenario did not require such a button to open or inspect the modal.

No direct unused-icon sentinel was requested as part of the UI test. The separate native-offline transport control navigated to an Iconify check URL only to verify that `setOffline(true)` also blocks external transport.

## Evidence files and limits

- Full traces and response bodies: `offline-baseline-cold.json`, `offline-b-cold.json`, and `offline-b-warm.json`.
- Server off-host fetch logs: `offline-b-cold-egress.jsonl` and `offline-b-warm-egress.jsonl`.
- Real-control screenshots include `offline-b-cold-cold-offline-atmosphere-menu.png`, `offline-b-cold-cold-offline-catalogue-menu.png`, `offline-b-cold-cold-offline-modal.png`, plus corresponding warm-online, warm-offline-loaded-page, and warm-offline-reload screenshots.
- Probe implementation: `../offline-probe.mjs`; disposable egress hook: `../deny-egress.mjs`.

This sample covers the shown desktop Vela Reach/Aster controls, not every icon or workflow, mobile layout, accessibility, or a fresh-server offline reload. No service-worker or PWA behavior was tested. The warm result depends on a server process that had already fetched the icon JSON; the cold result shows that a new process cannot obtain those two USelect icons without its outbound Iconify fetch.
