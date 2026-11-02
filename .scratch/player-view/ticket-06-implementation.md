---
title: Ticket 06 implementation and verification
status: in-progress
parent: spec.md
---

# Ticket 06: Compressed player links with a JSON fallback

The user explicitly authorized [ticket 06](tickets/06-compressed-player-links.md) through `implement` on 2026-11-02, following the proposed transport/interface subagent split. Local commits on the current feature branch are authorized. No push, PR, remote issue update, deployment or feature merge into main is authorized.

## Baseline

- Branch: `codex/player-view-ticket-01`; starting HEAD `686b42c07f407682e12d3d5e3182cad186644b5f`. Only the unrelated untracked `.codex/environments/` directory was present and remains untouched.
- Fetched origin/main: `47c0418a835da285e9edb88e8f8dffc19c3a2bba`; starting branch twelve ahead/twenty-six behind. Incoming work adds global Search and owned verification. The clean separate main checkout was safely fast-forwarded from `d40e5f51`, preserving local work.
- Integration preserves player publication models, preview overlays and guarded file exports together with Search overlays, focus settlement and navigation. Two conflicted files preserve both intents. Newly introduced Search tests retain their assertions while adopting the current chart-details label. The pinned merge revision and baseline evidence are below.
- GitHub #9 was reread with all comments: open, same body/labels, no comments, last updated 2026-10-09T14:46:17Z. No remote write occurred.

## Workflow and verification ownership

Sensitive route: architect before source edits; at most two disjoint implementation writers; independent Standards/Spec and complementary input/privacy/lifecycle review. Coordinator owns Git, documentation, runtime ports, browsers, integrated checks and final qualification. Delegated specialists do not restart orchestration or mutate shared resources.

The existing approved seams remain: public transport/codec behavior, actual generated URLs decoded by the production codec and compared with JSON/preview; private-marker exclusion and intentional geometry; bounded encoding/decompression/graph admission; malformed/truncated/version/size failures; fresh/reloaded and multiple reader links beside unchanged GM storage; preflight/applied-state ownership and failed copy. Native browser I/O can be gated at its boundary; do not mock internal transport modules. No additional seam approval is required.

Use vertical red/green slices with measured URL-budget evidence. Keep one common public projection and JSON admission implementation. Freeze runtime inputs for browser checks, use the owned local launcher and preserve its separate reports. Typecheck/lint regularly; production-build and compiled-route checks cover SSR integration. Run the cumulative complete suite once on the finished candidate, followed by affected replays only when needed. Do not present fixed initial failures as a clean first run.

## Design and evidence

The architect fixed transport and interface ownership before parallel implementation. Native measurements, admitted limits and lifecycle decisions are recorded below.

### Integrated baseline and agreed contracts

Actual implementation/review baseline: **`62e5e55d293573019979df1e59013855ac9317a0`**, the validated merge of refreshed main (thirteen ahead/zero behind `47c0418a`). Full lint passed. Nuxt typecheck initially found six incoming fixture shape errors; explicit private/default properties corrected them and full-project validation passed. Focused pure checks passed 49/49 plus 5/5 object-branch cases. The initial owned browser run passed six of seven; its compact menu reproduced a 0.296875px scrollport clip despite correct focus. Matching existing padding with `scroll-padding-block: 0.8rem` fixes native focus scrolling; all three responsive cases then passed with unchanged full-intersection assertions. Search/deep Hierarchy, dialog ownership, existing player JSON and preview passed. Final integration types, affected lint and Markdown references passed. Evidence uses `test-results/player-view-06-*` and the owned launcher's timestamp reports; measured geometry is `player-view-06-menu-geometry.json`.

Transport is one client utility around the existing codec: `createPlayerShareUrl(document, readerUrl, { signal? })` and `decodePlayerShareFragment(fragment, { signal? })`; fixed error codes `invalid-link`, `unsupported-version`, `too-large`, `unavailable`. Version 1 is `#player=1.gzip.<unpadded-base64url>`. Reject percent encoding, alternate alphabets, padding and noncanonical trailing bits. JSON format/version and projection remain unchanged; export the codec's existing 4 MiB byte limit for reuse.

Budget: **8,192 UTF-8 bytes for the complete URL**, including actual scheme/host/port/base path and prefix. This is an application policy, not a universal browser/messenger guarantee. Bound encoded/compressed input before allocation, compression output, and decompressed output before retaining excessive chunks. Use fatal UTF-8 plus the existing JSON/graph validation. Native stream support is checked on invocation; cancellation must release readers/listeners and fence stale results. No unbounded response collector in production transport.

Native Node 24 and installed Chromium 156 measurements agree for representative public documents: small JSON 1,035 bytes -> complete canonical URL 536; repeated survey JSON 25,508 -> 1,128; distinct prose JSON 82,148 -> 49,421, requiring JSON fallback. Exact fixtures/results are `test-results/player-view-06-budget-*`. Actual product boundary/navigation/copy evidence remains required. Primary references: [WHATWG Compression](https://compression.spec.whatwg.org/) and [WHATWG URL](https://url.spec.whatwg.org/); these do not establish the application budget.

Reader: empty fragment retains JSON chooser; nonempty fragment is link mode even when invalid. A normal clean same-tab `Open player JSON instead` href explicitly enters file mode. Mounted native hash-change plus route-hash triggers read raw `window.location.hash`, deduplicated by raw string through one nonce/abort owner. Clear old document/navigation synchronously before decoding. Link reload restores its snapshot; file reload returns to the chooser. A client Nuxt plugin wraps installed scroll handling at setup (after `nuxt:router`) and again before mount: bypass selector scrolling only for router-relative `/player`, delegate the genuine handler elsewhere. No payload in SSR, query parameters, errors or telemetry.

Generate extends the existing export owner/prepare callback, projecting one applied snapshot and checking request/context/revision ownership. Copy uses the retained immutable URL without preflight/regeneration. Clipboard failure preserves it with selectable/manual-copy guidance. Starting any newer export cancels/reset pending generation busy state. Copy guards use attempt/artifact identity; source edits do not revoke an already-generated snapshot.

After first RED tracers, transport writer owns new utility, minimal codec-limit export and pure tests. Interface writer owns export owner, reader, toolbar/share controls, BaselinePage glue, client scroll plugin and focused public/operation tests. The coordinator explicitly delegates those glue files to keep at most two writers and retains Git, runtime/browser checks, docs and final integration. Use the already-approved seams and real native I/O gates, never internal-module mocks.

### Implementation checkpoints and corrections

The public browser tracer first exported the real player JSON and then failed on the absent Generate player link button (`player-view-06-ui-red.log`): this is the feature-absence RED. The initial transport run failed to resolve the new module and is not represented as an assertion RED. The first canonical public round trip passed with independent native decompression and private-extension exclusion. The initial full typecheck found the native writer's ArrayBufferLike/ArrayBuffer mismatch; narrowing the allocated input type fixed it without a cast. Full source types and lint then passed.

Complementary sensitive review found two confirmed transport defects. Cancellation originally surfaced as unavailable rather than AbortError; the new public assertion failed, then passed after using a fixed DOMException. Deferred stream cancellation originally ran after releasing locks; the first native boundary regression exposed it. Both cancel and abort are now invoked before release, their settlement is observed, and public cancellation does not wait for native I/O. A second test expectation incorrectly assumed that writer.abort must fulfill; architect reassessment showed native cancellation may reject with the same stored size error. The corrected regression asserts original settlement/reason identity and excludes released-lock TypeError. Root retained the native settlement report, reran it successfully, and obtained explicit reviewer closure on both P2s.

The completed transport boundary matrix passed 9/9: canonical round trip, already-aborted operations, malformed/noncanonical fragments, unsupported transport versions, encoded cap, corrupt/truncated gzip, fatal UTF-8, existing codec empty/schema/graph errors, exact 8,192-byte complete-URL admission plus one-byte overflow, invalid reader URLs, unavailable native APIs, gated pending native-read abort with late rejection, and expansion-limit cancellation. No further production defect was found. Root's combined transport/readiness pure run passed 39/39 (`player-view-06-pure-boundaries.log`).

### Development readiness diagnosis

Two owned launchers failed before any test started; they are readiness failures, not failed feature assertions. The final text reported an old HTTP 503, while bounded independent probes later received HTTP 200 and a hydrated welcome screen without changing application source. Installed Nuxt/Vite-node traces showed cold module loading and IPC boundaries. Static inspection excludes execution of the client-only scroll plugin during SSR; no plugin defect or specific Nuxt root cause was established. The initial eight-second client probe expired during cold loading; a subsequent bounded twenty-second probe reached the welcome form with no pending requests, page errors or unexpected console output.

One concrete launcher defect was established: each HTTP attempt owned the entire remaining five-minute startup deadline, so a single stalled request prevented fresh readiness attempts and left a stale diagnostic. Two existing-seam regressions failed before the fix (`player-view-06-launcher-red.log`). `waitForHttpReady` now caps each attempt at five seconds, retries within the unchanged global deadline, reports the current timeout, and preserves owner cancellation. The 39-case pure run covers success after a stalled request, repeated stalls bounded by the global deadline, current diagnostics and exact cancellation reason. This small independent tooling correction does not claim to fix an application defect.

Early frozen UI/lifecycle review found no confirmed production defect. The reviewer checked raw-fragment ownership, safe errors, SSR separation, generation/preflight context and retained-URL copy guards. Installed Vue Router may emit a malformed percent-encoded hash in development diagnostics before page admission; its production branch excludes that diagnostic. Verification and documentation must not promise suppression of framework development-console diagnostics.
