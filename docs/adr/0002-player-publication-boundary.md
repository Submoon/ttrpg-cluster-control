---
status: accepted
date: 2026-10-30
---

# Separate player publication from the complete source workspace

Player publication introduces deliberate disclosure of system markers without publishing their full source records. Existing map export is a complete backup, and the Warden renderer reads source names, IDs, internal counts and routes. Filtering its visual marks would leave the private data available to rendering, accessibility and future serialization.

Use a pure allowlisted player projection and renderers that accept only its document. Hidden systems are omitted; remaining systems receive snapshot-local public identities after filtering. Unknown presence is neutral, Known type uses the generic Star system classification, and Revealed permits the source system name. The initial slice included only committed system positions and the independent player share title. Ticket 02 extends Revealed systems with permitted internal objects and required orbital geometry, still excluding routes, prose, Fields and source totals. The preview is Warden-side consultation, not a security boundary for lending the Warden's browser.

Persist source publication through the existing writer and mutation/history coordinator. Extend the existing guarded chart editing session rather than create a parallel draft/persistence workflow. Applying a chart edit still means memory publication first and a separate durable acknowledgement; previewing is not an edit.

## Versioning trade-off

Complete source workspaces and new full-map exports advance to version 4 for player text, Field policies/masks and route sharing together. Layout remains version 1 because its geometry representation is unchanged. Version 3 remains supported with its required system/object publication; version 2 retains its required system publication/title and initializes object publication Hidden. A missing or malformed v2 system field or v3 object publication must not be silently repaired as legacy. Old full-map version 1 files and unversioned local workspaces initialize systems and objects Hidden through their explicit migration paths. Earlier versions initialize only newly introduced player text/masks and sharing flags to empty/private; v4 requires their valid current shape. Existing descriptions remain private GM notes without rewriting their text. The complete source format and player document have separate identities and version lifetimes; the internal player projection remains version 1 before transport is introduced.

An additive version 1 extension would rely on older readers retaining unknown properties and would lose publication intent in reconstruction paths. Explicit versioning makes unsupported data fail visibly while preserving legacy imports. The user accepted that new complete backups need not open in older application versions. Recovery and history validation use the same version-aware source restoration contract; they must not erase valid settings or repair malformed current data as old data.

## Append-import metadata

Complete backup/restore round trips retain the source cluster's player title and each system/object's publication. Ordinary JSON import still appends independent systems to the destination cluster and remaps entity IDs. It preserves incoming publication modes and the destination cluster's player title, just as it preserves the destination cluster name. The source title is not applied to a different destination chart. No additional cluster-provenance store or second workspace is introduced.

## Effective geometry before disclosure

Resolve object positions, Orbit centers, radii, rotations and default angles against the complete committed source before filtering. Hidden sibling order and host classification can affect defaults. Recomputing from the reduced scene would move public locations; materializing defaults in the source would turn consultation into an edit.

Retain each public object's required placement/host chain, promoting only otherwise Hidden physical hosts to Unknown in the projection. Retain each required Orbit once and omit unrelated branches. An unoccupied center remains geometry. Copy resolved numeric values into detached DTO records, remap every relationship to public identities and omit source ordering. This preserves effective geometry without handing the source renderer or private records to the player component.

## Assignment-local content and import policy

Only Revealed objects may project player text and Field values. Field publication belongs to reusable definitions or native settings; per-object masks restrict that permission further. Applicability remains independent, and inactive assignments/masks remain in the complete source. Publish only the permitted assignment's name, type and value, never a definition inventory, unused options, applicability or source Field identities. A selected value such as Merchants must not disclose another option such as Cult. GM notes never substitute missing player text.

Append-import must preserve both destination and incoming publication intent. Silently intersecting policies loses incoming intent; unioning them can publish existing private values. Reuse same-name definitions only when policies and type/options agree. Shared definitions additionally need equal canonical applicability: a scope union could otherwise publish a formerly inactive assignment. Private definitions keep existing scope-union behavior. Native policy mismatches also fail explicitly through the established import conflict path. This conservative choice requires aligning policies before retry rather than introducing a second import-decision workflow. Custom masks follow definition ID remapping; native masks use reserved native identities.

Earlier accepted files could use those newly reserved native identities for custom definitions. Before current validation, legacy restoration/import remaps conflicting custom definition IDs and their assignment keys to deterministic unused aliases, preserving native values separately. The caller explicitly identifies a local workspace, cluster export or standalone system export; ignored metadata and opposite-kind payloads do not participate. Local workspaces and cluster exports preserve their original global uniqueness rules, while standalone exports preserve their separate Field/entity namespaces. Alias allocation avoids actual entity, definition and assignment keys independently of those admission rules. Original duplicate/invalid definitions still fail; current v4 reserved-ID collisions are rejected rather than repaired. This migration preserves old accepted data without making a custom assignment a native publication permission.

## Public route relationships

Player routes refer to public system markers, independently of the logical Jump Point objects that source routes require. Share only explicitly permitted routes with at least one retained system. If its other system is Hidden, orient the public representation from the retained side and copy the Hidden system's exact position into a generic unknown destination. This geometry disclosure is deliberate; the private source direction, resolution, names and endpoint identities remain unchanged.

For an authored unresolved exit, resolve its complete committed source geometry before filtering and copy only the endpoint coordinates. Public paths, bends, labels, counts and bounds are then derived from the public graph; they do not receive the source route order or unresolved label. Physical Station links appear only between two Revealed objects and never promote a secret Station into the projection.

This decision covers tickets 01–04. Standalone player file/link loading and player image exports remain later slices of the approved scope.
