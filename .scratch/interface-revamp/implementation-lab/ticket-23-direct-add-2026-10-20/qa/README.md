# Direct Add final QA report

The final complete canonical invocation passed **124/124**, with no failed, skipped or flaky cases. It used one worker, zero retries, the original 30-second deadlines, 123 compiled cases and the one exact development-only IndexedDB case. Every canonical case executed exactly once. All 107 frozen application, utility, test, fixture, configuration and capture inputs remained unchanged.

Baseline: `87aae398b35c0f15363c12af49d638c66cb90216`. Candidate: `direct-final-v4`. The [source identity](selected-evidence/source-identity.json) has SHA-256 `a2472deddd9faa37734dadf9c13c44b72eca05e507e584b59ed267660ba3a821`.

| Final gate | Exact result |
| --- | --- |
| Typecheck | Exit 0 in 19,365 ms. |
| Production build | Exit 0 in 103,887 ms; one production build for this follow-up. Both servers stopped before shared Nuxt preparation. |
| Canonical partition | 124 unique = 123 compiled + 1 exact development-storage case; no missing, extra or duplicate identities. |
| Bounded presentation | Two actual compiled views, 16/16 checks, zero page errors; Chrome 155.0.8059.80. Coordinator inspected and accepted both PNGs. |
| First complete invocation | **117 passed / 7 failed / 0 skipped or flaky**, 727,311.121 ms, two workers, zero retries. All seven were original 30-second timeouts; 107 hashes unchanged. |
| Same-source serial diagnostic | **7/7 passed**, 126,733.357 ms, one worker, zero retries, unchanged deadlines. Individual durations 13.239–19.534 seconds; 107 hashes unchanged. |
| Final complete invocation | **124/124 passed**, 712,548.892 ms, one worker, zero retries, maxFailures 0 and original 30-second deadlines. Each canonical case executed exactly once; 107 hashes unchanged. |
| Runtime handoff | Verified compiled PID 20080 and dev PID 28880/launcher 33440 stopped. Ports 3100/3180 free; zero remaining owned processes. |

The two-worker failures are retained, not relabeled as passes. The nested-map trace reached successful publication and reload before timing out while reopening Hierarchy; the ellipse trace reached native drag setup. All seven unchanged cases passed serially and then passed again inside the final complete invocation. This supports runtime concurrency as the cause of the budget failures. Recorded timed-out result durations include teardown and exceed the unchanged 30-second test budget. No source, configuration, deadline, precision or assertion changes occurred between these runtime gates.

The final complete result includes direct map Add, numeric Add/current inputs, named ambiguity, invalid/error correction, rotated/nested geometry, native object/Orbit drag, Inspector and draft ownership, interruption, actual JSON/download/reload, save failure/retry, and compact/short landscape hit/focus behavior. The development project executed only `a failed IndexedDB save preserves current and backup snapshots`; all other 123 cases used the compiled runtime.

Both independent reviews cleared the final visible Other-label correction; the coordinator reported no remaining blocker. The two selected positive images retain the accepted B/Dock composition: [desktop repeated Add](selected-images/direct-desktop-light.png) and [compact numeric Add](selected-images/numeric-mobile-dark.png). They record ordinary hits, natural visible focus, current inputs, one Add action, no Preview/Confirm and no compact form overflow. The unchanged map viewport can crop labels; no automatic fit is promised.

Physical Android Chrome, OS keyboard, safe-area and physical gesture checks were unavailable. Browser emulation does not certify those capabilities.

## Historical pre-final checkpoints

- Meaningful baseline direct-Add RED: one failed case in 21,909.848 ms. The first reachable ordinary map click exposed one Confirm control. Planet choice preserved the original array; repeat/export/reload assertions were unreached.
- Meaningful Other-label RED: one failed case in 17,103.868 ms. Actual blank-label map Add preserved system/layout but exposed no visible required-label alert. Recovery was unreached.
- Held-pan and stationary long-press probes passed before any gesture patch. No gesture defect or speculative fix is claimed.
- Initial selection discovered zero cases; cold Nuxt startup timed out before the bootstrap form. Neither is claimed as a semantic RED.
- The migrated two-spec gates returned 6/3 then 7/3. An affected retake returned 2/1; the exact preservation retake passed 1/1. Corrections addressed export-blob setup, actual portalled form lifetime and comparison with the already committed placement. All relevant cases then passed completely, including within the final whole-suite invocation.
- No forced clicks, retries, skips, timeout inflation or precision changes were introduced.

Only compact outcomes, the source identity and two approved positive images are stored here. See the [manifest](evidence-manifest.json) and [gate summary](selected-evidence/gate-summary.json) for exact attribution and per-case timing comparison. All raw stdout, stderr, JSON, failure screenshots and traces remain in literal host TEMP. First full evidence: `C:/Users/fbal-fontaine/AppData/Local/Temp/ticket23-direct-final-gate-20261020-run1/full-suite`. Final complete evidence: `C:/Users/fbal-fontaine/AppData/Local/Temp/ticket23-direct-final-serial-20261020-run1`.

The coordinator owns lifecycle, documentation outside this directory and Git.
