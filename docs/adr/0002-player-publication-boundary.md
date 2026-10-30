---
status: accepted
date: 2026-10-30
---

# Separate player publication from the complete source workspace

Player publication introduces deliberate disclosure of system markers without publishing their full source records. Existing map export is a complete backup, and the Warden renderer reads source names, IDs, internal counts and routes. Filtering its visual marks would leave the private data available to rendering, accessibility and future serialization.

Use a pure allowlisted player projection and renderers that accept only its document. Hidden systems are omitted; remaining systems receive snapshot-local public identities after filtering. Unknown presence is neutral, Known type uses the generic Star system classification, and Revealed permits the source system name. The initial slice included only committed system positions and the independent player share title. Ticket 02 extends Revealed systems with permitted internal objects and required orbital geometry, still excluding routes, prose, Fields and source totals. The preview is Warden-side consultation, not a security boundary for lending the Warden's browser.

Persist source publication through the existing writer and mutation/history coordinator. Extend the existing guarded chart editing session rather than create a parallel draft/persistence workflow. Applying a chart edit still means memory publication first and a separate durable acknowledgement; previewing is not an edit.

## Versioning trade-off

Complete source workspaces and new full-map exports use version 3 after object publication is introduced; layout remains version 1 because its geometry representation is unchanged. Version 2 remains an explicitly supported legacy format: validate its required system publication/title fields, retain them and initialize object publication as Hidden. A missing or malformed v2 system field must not be silently repaired as legacy. Current version 3 requires valid object publication as well. Old full-map version 1 files and unversioned local workspaces initialize systems and objects Hidden through their explicit migration paths. The complete source format and player document have separate identities and version lifetimes; the internal player projection remains version 1 before transport is introduced.

An additive version 1 extension would rely on older readers retaining unknown properties and would lose publication intent in reconstruction paths. Explicit versioning makes unsupported data fail visibly while preserving legacy imports. The user accepted that new complete backups need not open in older application versions. Recovery and history validation use the same version-aware source restoration contract; they must not erase valid settings or repair malformed current data as old data.

## Append-import metadata

Complete backup/restore round trips retain the source cluster's player title and each system/object's publication. Ordinary JSON import still appends independent systems to the destination cluster and remaps entity IDs. It preserves incoming publication modes and the destination cluster's player title, just as it preserves the destination cluster name. The source title is not applied to a different destination chart. No additional cluster-provenance store or second workspace is introduced.

## Effective geometry before disclosure

Resolve object positions, Orbit centers, radii, rotations and default angles against the complete committed source before filtering. Hidden sibling order and host classification can affect defaults. Recomputing from the reduced scene would move public locations; materializing defaults in the source would turn consultation into an edit.

Retain each public object's required placement/host chain, promoting only otherwise Hidden physical hosts to Unknown in the projection. Retain each required Orbit once and omit unrelated branches. An unoccupied center remains geometry. Copy resolved numeric values into detached DTO records, remap every relationship to public identities and omit source ordering. This preserves effective geometry without handing the source renderer or private records to the player component.

This decision establishes ticket 01's boundary and its ticket 02 extension. Private/public prose, Fields, routes, player file/link loading and player image exports remain later slices of the approved scope.
