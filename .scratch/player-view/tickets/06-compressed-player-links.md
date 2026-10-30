---
title: 'Share compressed player links with a JSON fallback'
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 06: Share compressed player links with a JSON fallback

**Parent:** [Player view and secret-free sharing](../spec.md).

**Source:** [Player view and secret-free export — GitHub #9](https://github.com/Submoon/ttrpg-cluster-control/issues/9). Approved breakdown: 2026-10-29. Planning baseline: `8d4b66504ca6723db5405ed7cb93d0a666264c9a`, equal to fetched origin/main. Refresh source/baseline before implementation.

**What to build:** the Warden generates a directly openable player URL carrying a compressed copy of the sanitized snapshot. Recipients open it in the established reader; when a reliable URL cannot contain the snapshot, the Warden can use the player JSON instead.

**Status:** ready-for-agent. Lifecycle is open and unclaimed.

## Blocked by

- [05: Export and open a standalone player JSON snapshot](05-player-json-and-reader.md).

## Acceptance criteria

- [ ] The sharing UI generates/copies a versioned URL whose fragment carries a compressed, URL-safe encoding of the same player document used by JSON and preview. It never embeds full GM data or references a server-stored map.
- [ ] A fresh recipient context opens the URL directly into the existing read-only reader with the same permitted cluster, geometry, labels, prose/Fields and navigation as the JSON. No account, GM workspace or map database/cache is required; the hosted application is still required.
- [ ] Updating publication and generating another link produces the new snapshot. Previously distributed links retain their own content; no live-update, revocation or stable mutable share service is introduced. Anyone receiving a link can read/copy its player data; compression is not a confidentiality mechanism.
- [ ] Establish and document a practical complete-URL size budget using representative small/large snapshots and supported browser/share-path evidence. Account for the actual host/path/version prefix, not payload length alone. Above the budget, explain the limit and offer the existing JSON fallback without truncating data or silently adding a shortening backend.
- [ ] Bound encoded/compressed/decompressed size and decode/graph work before rendering. Corrupted encodings, decompression failures, truncated links, unsupported versions, invalid documents and empty snapshots fail clearly and cannot load the local GM workspace as fallback.
- [ ] Payload decoding is client-side; no map payload is added to an HTTP query, application telemetry/error report or server-side hydration path. Display only safe error context. Browser history or copies of the shared URL are not misrepresented as erased or inaccessible.
- [ ] Two distinct player links can coexist with each other and a GM base-site tab without data/selection/history contamination. Reload and switching documents restore the correct snapshot and release obsolete resources. The base site still opens its saved GM workspace.
- [ ] Generation observes existing file-action preflight/applied-state rules, preserves source data/history, and handles failed link copying without generating a different or partial document.

## Verification and completion

Inspect real generated URLs by decoding them through the production codec and compare their public document to actual JSON/preview output. Verify raw private-marker absence after decompression rather than relying on unreadable compressed text. Exercise budget boundaries, a too-large representative map with JSON fallback, malformed/decompression cases, fresh/reloaded contexts, multiple documents and an untouched GM base tab. Check the client/server entry boundary in the compiled app. Run relevant pure/browser checks, lint/typecheck and build when route/SSR integration changes.

## Scope boundaries

This is a transport extension of the established player document/reader, not a new projection or online campaign service. Choose codec and numeric limits from measured evidence within the accepted fallback contract. Do not add cloud storage, synchronization, accounts, audience profiles, system-only links or offline HTML packaging. Sensitive input/format review applies.
