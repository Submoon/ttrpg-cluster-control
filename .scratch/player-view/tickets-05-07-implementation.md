---
title: Tickets 05 and 07 implementation and verification
status: in-progress
parent: spec.md
---

# Tickets 05 and 07 implementation and verification

The user authorized simultaneous implementation of [Standalone player JSON and reader](tickets/05-player-json-and-reader.md) and [Player SVG/PNG exports](tickets/07-player-svg-png-exports.md) with `implement` and subagents on 2026-11-02. Ticket 06, pushes, PRs, remote issue writes and merges into main are outside this instruction. Local feature-branch commits are authorized.

## Baseline and coordination

- Starting HEAD: `abcf6625863c74785fb72a5e802dffc82af7a26e`, branch `codex/player-view-ticket-01`, including closed tickets 01–04. Only the pre-existing untracked `.codex/environments/` was present.
- Fetched origin/main: `d40e5f515baf1afeb0e2135461287b243b2a1f6c`; starting branch was eight ahead/four behind. The clean separate main checkout (apart from its untracked environment directory) was safely fast-forwarded from `d4b97331` to origin/main, preserving local work.
- Origin/main is being integrated into the feature branch before pinning the implementation/review base. Four test-only conflicts combine the newer quiet save feedback/startup waits with current chart-detail names and existing backup corruption helpers. Existing player tests follow the durable-state helper rather than expect removed routine success notices. The actual post-merge revision and checks will be recorded below.
- Source GitHub #9 was reread: open, unchanged body/labels, no comments, last updated 2026-10-09T14:46:17Z. No remote write occurred.
- Sensitive route: architect before edits, two disjoint implementation writers maximum, independent Standards/Spec and complementary privacy/input/persistence review. Coordinator owns Git, runtime/browser sessions, shared fixtures, BaselinePage and file-action glue, documentation, integrated compiler/lint/build and final suite.

## Agreed contracts and verification seams

The previously user-approved seams remain: pure projection/codec/input validation; actual JSON/SVG/PNG artifacts and complete serialized private-marker absence; public fresh/reloaded/multiple player contexts beside GM storage; and existing guarded/preflight/save-failure/stale-callback flows. No new seam approval is required. Use one tracer per vertical red/green slice, not a bulk imagined test layer.

- Keep the existing detached player format identity/version and one allowlisted projection. The codec explicitly reconstructs records and drops extensions on input and output. Safe fixed errors never include supplied names, keys, snippets or native parser diagnostics.
- Initial centralized technical limits: 4 MiB UTF-8 JSON, lexical nesting depth 64, 256 systems/512 routes, 2,000 objects and Orbits per system/10,000 of each total, 20,000 Field assignments, 256 KiB per text value, finite scene operands bounded at 1e9 with positive radii. Validate references and host acyclicity iteratively. Check input before parse/read and final output bytes; never truncate. Refine only with evidence within the approved bounded-work requirement.
- JSON requires a nonempty public cluster. An empty internal map of a Revealed system remains valid and openable; an entirely featureless image is rejected. Empty Warden preview remains permitted.
- `/player` is a separate SSR-safe shell. File data, nonce, errors and navigation are local to its mounted reader; no GM hydrate/store/importer/IndexedDB/recovery/history path. Invalid replacement clears the old view. Reload returns to the file chooser with an explicit reopen instruction; there is no new storage/cache lifecycle. Ticket 06 later restores snapshots from its URL transport.
- Extract shared public document navigation from the preview, retaining modal focus ownership in its wrapper. Ticket 05 owns reader/codec/new document view/preview wrapper; ticket 07 owns existing public map renderers and public geometry/drawing/image helpers. Neither writer owns the other's files.
- Share `CurrentPlayerMapScene` as a public-only cluster/system union. Coordinator resolves current source selection to the eligible public Revealed marker. Exports receive only detached DTOs; never a GM DOM clone or source record.
- Capture requested map/workspace/renderer before existing preflight; project authoritative applied memory after preflight; capture that applied revision. Recheck operation/context/revision/renderer ownership after asynchronous image work and immediately before download. Existing failed-save exports still use applied memory, without adding a write/history edge.
- Ticket 07 bounds the existing unbounded public route-label candidate search and preserves deterministic finite fallback. Its shared scene styling must cover every public paint variable for active/light-print palettes, rather than assuming the GM print host overrides player text variables.

## Checks and decisions

Architecture and export-path specialists returned read-only reports without edits or execution. Initial baseline checks, frozen red tracers, implementation handoffs and review results will be added as collected. Use unique `test-results/player-view-57-*` outputs/logs; never use the default Playwright output root. Freeze all source before integration checks; prepare/typecheck/build while browsers are idle. Run the complete suite once at the end, then only justified affected replays.

### Integrated baseline checks

The source merge is resolved without changing either feature intent. Main's quiet feedback/startup helper remains; player publication chart-detail labels and backup corruption helper remain. Thirty-three player test success waits now use the maintained durable-state helper. The first lint run found only three imports made unused by that adaptation; those imports were removed and the affected lint replay passed. Full Nuxt typecheck passed. The four focused projection/migration files passed **29/29**; the persisted-entry warmup passed **1/1**; five actual browser merge regressions passed **5/5 in 59.5 seconds** (invalid hidden draft, routine feedback desktop/compact, player Fields, last-valid recovery and independent-copy import preserving a draft).

Evidence: `test-results/player-view-57-baseline-typecheck.log`, `player-view-57-baseline-lint.log`, `player-view-57-baseline-lint-fixed.log`, `player-view-57-baseline-pure.log`, `player-view-57-baseline-warmup.log`, `player-view-57-baseline-ui.log`. No complete-suite run has occurred for this delivery; it remains scheduled once on the finished candidate.

The architect verified that custom `Other` subtypes remain verbatim, including whitespace, while Known type labels use `catalogueSubtypeLabel`'s trimmed display. Other families require an exact catalogue pair. Public route-label search is limited to eight rings/29 candidates, followed by one deterministic placement beyond the tracked rightmost obstacle; the fallback is included in bounds and has no secondary search loop.

The root-owned player file hook will take a focused asynchronous preparation callback returning one post-preflight document, nullable eligible current image scene, and `isCurrent`. It owns its own nonce/disposal/error and combines both ownership checks after every asynchronous stage and before download/error publication. A null scene blocks only images, never whole-cluster JSON. Common browser download/name behavior is extracted once; player names use public labels and an explicit player suffix. The image writer supplies `exportPlayerMapImage({scene, format, palette, isCurrent}): Promise<Blob | null>`, where null means stale cancellation.
