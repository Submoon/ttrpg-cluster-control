---
status: accepted
date: 2026-10-30
---

# Separate player publication from the complete source workspace

Player publication introduces deliberate disclosure of system markers without publishing their full source records. Existing map export is a complete backup, and the Warden renderer reads source names, IDs, internal counts and routes. Filtering its visual marks would leave the private data available to rendering, accessibility and future serialization.

Use a pure allowlisted player projection and a renderer that accepts only its document. Hidden systems are omitted; remaining systems receive snapshot-local public identities after filtering. Unknown presence is neutral, Known type uses the generic Star system classification, and Revealed permits the source system name. This first slice includes only committed system positions and the independent player share title, never system internals, routes, Fields or source totals. The preview is Warden-side consultation, not a security boundary for lending the Warden's browser.

Persist source publication through the existing writer and mutation/history coordinator. Extend the existing guarded chart editing session rather than create a parallel draft/persistence workflow. Applying a chart edit still means memory publication first and a separate durable acknowledgement; previewing is not an edit.

## Versioning trade-off

Complete source workspaces and new full-map exports use version 2; layout remains version 1 because its geometry representation is unchanged. Retain explicit support for old full-map version 1 files and unversioned local workspaces, assigning private system publication defaults. Current version 2 data must validate its required publication/title fields; a missing or malformed field is not silently reinterpreted as legacy. The complete source format and player document have separate identities and version lifetimes.

An additive version 1 extension would rely on older readers retaining unknown properties and would lose publication intent in reconstruction paths. Explicit versioning makes unsupported data fail visibly while preserving legacy imports. The user accepted that new complete backups need not open in older application versions. Recovery and history validation use the same version-aware source restoration contract; they must not erase valid settings or repair malformed current data as old data.

## Append-import metadata

Complete backup/restore round trips retain the source cluster's player title and each system's publication. Ordinary JSON import still appends independent systems to the destination cluster and remaps entity IDs. It preserves incoming system modes and the destination cluster's player title, just as it preserves the destination cluster name. The source title is not applied to a different destination chart. No additional cluster-provenance store or second workspace is introduced.

This decision implements ticket 01's boundary. Object publication, private/public prose, routes, player file/link loading and player image exports remain later slices of the approved scope.
