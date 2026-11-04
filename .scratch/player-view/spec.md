---
title: Player view and secret-free sharing
status: closed
triage_labels:
  - enhancement
  - ready-for-agent
scope_review: approved
scope_reviewed_on: 2026-10-29
spec_published_on: 2026-10-29
ticket_breakdown_review: approved
tickets_published_on: 2026-10-29
ticket_count: 7
---

# Player view and secret-free sharing

The user approved this scope and verification plan through the integrated final review on 2026-10-29. On 2026-10-30 the user separately authorized implementation of tickets 01 and 02, then simultaneous implementation of tickets 03 and 04, with subagents and the `implement` workflow. All seven local tickets are closed, including simultaneous implementation of 05 and 07 under the user's authorization and ticket 06 under the explicit `implement` instruction. Ticket 06 verification and local closure completed on 2026-11-04. The source GitHub issue remains open; no remote write, push, PR or feature merge into main is authorized by this specification.

## Source issue

- [GitHub #9 — Player view and secret-free export](https://github.com/Submoon/ttrpg-cluster-control/issues/9), read and rechecked on 2026-10-29. Open, `enhancement`, `priority:P1`, no comments; source last updated 2026-10-09T14:46:17Z.
- Source requires a separate player-safe export, undiscovered locations hidden, GM notes removed, independent loading/viewing and clear GM-only controls. The rules below clarify those requirements; they do not claim they already exist.

### Baseline

- Analysis baseline: `8d4b66504ca6723db5405ed7cb93d0a666264c9a`. Successful origin fetches, including the `to-spec` publication check, confirm HEAD, local main and origin/main at that commit, with 0 ahead / 0 behind. No intentionally different base or main fast-forward is needed.
- Worktree: `C:/Users/fbal-fontaine/.codex/worktrees/5fe9/ttrpg-cluster-control`. The pre-existing untracked `.codex/environments/` is unrelated and preserved.
- [Code evidence and interview log](analysis.md) records the current contracts, references, recommendations that were superseded and user answers. This specification is the consolidated scope; historical pending proposals in that log are not current requirements.

## Problem Statement

The Warden prepares maps containing names, notes, fields, locations and relationships that players should not all receive. Current JSON exports contain full authoritative map data and shared field definitions. Current images render the complete applied scene, and SVG also retains nonvisual names/attributes. Visual hiding alone cannot make those exports safe to distribute.

The Warden needs to deliberately publish a limited player document that recipients can open without access to the GM workspace, without adding a shared map database or publication backend.

## Solution

Maintain one saved GM workspace and one common player publication configuration. Generate a sanitized, versioned player snapshot, usable by a read-only player reader, Warden preview, player JSON and player SVG/PNG exports. Put a compressed snapshot in the share URL fragment; use the player JSON file when a shareable URL would be too large. Each updated snapshot requires a new link.

The player reader loads its own document rather than importing into the GM editor. Multiple player links can coexist in separate tabs alongside the GM workspace. Visiting the base site still hydrates the saved GM workspace for that browser profile and origin. It must not resume the most recently consulted player document instead.

### Location disclosure

The following user-facing modes apply to systems and catalogue objects:

| Mode | Player presentation | Authorized data |
| --- | --- | --- |
| Hidden | No ordinary marker | No source entity name, type, key, notes or properties. The relationship exceptions below may disclose a minimal anonymous center or unknown route destination. |
| Unknown presence | Neutral marker and generic unknown label | Necessary position/presentation data only; no actual name, type, Location key, prose or Fields. |
| Known type | Type-specific presentation and generic type label | Type and necessary position/presentation data; no name, Location key, prose or Fields. |
| Revealed | Published name/type and public inspection | Player-facing text and only permitted Field values; never GM notes. |

Only Revealed systems open their internal map. Unknown presence and Known type systems remain cluster markers; Hidden systems are not openable. Internal content of an unopened/hidden system is not included merely because a descendant has a more permissive setting. Those descendant settings remain unchanged in the GM workspace.

New systems/objects default to Known type. New Fields default private and new routes unshared. Legacy locations are Hidden, Fields private and routes unshared until explicit publication. Existing descriptions remain private GM notes; player text starts empty. There is no separate campaign-progression flag for discovered-but-GM-only content.

### Text, Fields and labels

- Player-facing text and GM notes are separate. The public text feature extends the existing object description workflow; it does not imply new campaign journals or prose subsystems for every entity kind.
- Both native Fields (including Atmosphere and Port class) and custom Fields have a shared player-publication setting. A Warden can additionally mask a normally shareable value on a particular object. A private Field is not made public by an object override.
- Unknown presence and Known type modes omit all properties regardless of Field settings. Revealed objects include only Field names, types and values actually permitted there.
- Omit private or unused Field definitions, masked assignments, applicability inventories and unused selection options. Publishing `Faction: Merchants` does not publish an unused `Cult` option from the GM definition.
- Real location names appear only in Revealed mode. Exclude Warden Location keys and internal route names in all player outputs.
- Shared routes keep their Jump level. Unknown destinations use a generic player label; authored GM unresolved-destination strings are not implicitly public.
- The Warden chooses a player-facing share title; do not automatically publish the cluster title. Use permitted player labels for filenames, accessibility text and errors as well as visible text. A separate alias for every object is outside this scope.

### Relationship rules

**Jump Routes:** each route has an explicit sharing setting. A shared route requires at least one endpoint system to be non-hidden. If both systems are Hidden, omit it. Internal logical Jump Points do not have to be revealed for the cluster connection to be shown.

With two retained endpoint systems, show the connection between their published markers. With one Hidden system, show an unresolved player destination at that Hidden system's **exact schematic map position**. This spatial disclosure is deliberate. Omit the hidden system's source identity, name, type, internal map and properties. Project from the retained side even if that is the source route's logical destination. Keep the authoritative route resolved and unchanged. A source-unresolved external exit also requires a shared route and a retained origin and uses safe generic labels.

**Orbit hosts:** a shared object's required chain of secret hosts is shown automatically as Unknown presences, with the necessary orbital structure. Do not publish other hidden satellites or unrelated Orbit branches. Preserve effective applied geometry rather than letting removed siblings/defaults move the remaining objects. Include only Orbits required by published objects and their host chain; do not add empty-Orbit publication controls.

Projection interpretation: automatic expansion supplies a minimum Unknown presence where an otherwise omitted host is required, without downgrading a host already permitted as Known type or Revealed. An unoccupied geometric Orbit center remains geometry rather than an invented physical object. These rules give the accepted host-chain behavior a coherent projection contract.

**Physical Stations:** show a Jump Point's physical Station association only if both objects are Revealed. This association does not auto-promote a Hidden Station to Unknown presence. Logical Jump Route endpoints and physical Stations remain distinct.

### Sharing and consultation

- A link and player JSON contain the sanitized cluster, including only the internal system content permitted by the rules above. System-only player links are outside this initial scope.
- The player reader provides pan/zoom, cluster navigation, entry into Revealed systems and inspection of authorized details. It provides no source editing, private-data reveal, GM history or recovery action.
- The Warden has a preview of the same player content and player SVG/PNG export of the current map. Retain the existing useful palette/print and applied-geometry behavior when adding the distinct player actions.
- A player system-map image is eligible only if that system is Revealed. If the current player map has no permitted features, refuse that image rather than falling back to the full source scene. This does not restrict complete GM image exports.
- Do not generate a sharing artifact that is entirely empty. If every system is Hidden and no player content remains, explain that there is nothing to share. Do not add a hidden location to satisfy an editor validator. The Warden may still inspect an empty preview while configuring publication.
- Reject invalid, truncated, unsupported or oversized player inputs clearly. Never load the local GM workspace as a fallback for a failed player document. A legitimate Revealed system can have no published internal objects; this is different from an entirely empty cluster share.
- The hosted application must be available to load the reader. No self-contained offline HTML application, live data synchronization, stable mutable share URL, account requirement or revocation service is included.
- Snapshot data is readable/copyable by anyone receiving the URL/file. Compression is not encryption. Changing a later snapshot cannot recall an earlier copy. Publicly authored prose is not automatically scanned for unmarked spoilers.

## User Stories

1. As a Warden, I want to choose a location's disclosure mode, so that I can publish nothing, a presence, a type or its public identity.
2. As a Warden, I want one player publication configuration, so that I can prepare a common map without managing player accounts.
3. As a Warden, I want existing prose to remain private after upgrade, so that old preparation notes are not accidentally published.
4. As a Warden, I want newly created locations to show only their type by default, so that new map content appears without publishing its identity or details.
5. As a Warden, I want separate public text and private notes, so that a visible location can still have secrets.
6. As a Warden, I want native and custom Fields to be shareable deliberately, so that I choose which properties players receive.
7. As a Warden, I want to mask a normally shareable Field on a particular object, so that one sensitive assignment stays private.
8. As a Warden, I want unused Field options and definitions omitted, so that a published value does not reveal other preparation data.
9. As a Warden, I want an explicit player title and safe labels, so that filenames and nonvisual text do not expose private names.
10. As a Warden, I want to share a route independently of its Jump Point details, so that I can publish the connection alone.
11. As a player, I want a route to a hidden destination to remain unresolved at its real map position, so that the schematic geography stays meaningful.
12. As a Warden, I want a route with two hidden systems to stay absent, so that sharing a route does not expose an otherwise entirely hidden connection.
13. As a Warden, I want a published object's secret host chain represented anonymously, so that I can preserve its orbital structure.
14. As a Warden, I want unrelated satellites and empty Orbits to stay private, so that structural sharing stays bounded.
15. As a Warden, I want physical Station associations shared only between Revealed objects, so that routes do not expose installations implicitly.
16. As a Warden, I want a player preview before sharing, so that I can inspect the actual published result.
17. As a Warden, I want player SVG/PNG images of the current map, so that I can share or print the same permitted information.
18. As a Warden, I want readable image palettes and the existing light-print option, so that player images remain usable on screen and paper.
19. As a player, I want to open a link directly without the GM file or an account, so that I can consult the map independently.
20. As a player, I want pan, zoom and inspection of public details, so that I can explore the permitted map comfortably.
21. As a player, I want only Revealed systems to open their internal map, so that an anonymous marker does not expose undisclosed contents.
22. As a Warden, I want partial or hidden systems to withhold their internal data while retaining my child-object settings, so that changing a system's publication does not destroy preparation work.
23. As a Warden, I want a player JSON fallback, so that large maps remain shareable without a link-shortening backend.
24. As a player, I want incompatible or damaged links to fail clearly, so that the reader never substitutes unrelated local GM data.
25. As a Warden, I want multiple player consultations to coexist with my saved workspace, so that sharing cannot replace my work.
26. As a Warden, I want the base site to reopen my saved GM workspace, so that a prior player consultation does not change my normal entry point.
27. As a player, I want consultation to work without GM workspace storage, so that a fresh browser can open the shared document alone.
28. As a Warden, I want full backups to retain notes and publication settings, so that transfer and recovery preserve all my work.
29. As a Warden, I want legacy full-map files to remain importable with private defaults, so that an upgrade preserves preparation without publishing it implicitly.
30. As a Warden, I want publication edits to follow normal save and Undo/Redo behavior, so that I can safely correct publication mistakes.
31. As a Warden, I want exports to use committed data and leave the source unchanged, so that a player snapshot neither captures an unfinished preview nor changes my map.
32. As a Warden, I want each snapshot to keep its original published state, so that a later update does not silently change a previously distributed copy.
33. As a Warden, I want an entirely empty share to be refused, so that I do not distribute a useless artifact.
34. As a Warden, I want the actual shared data to exclude secrets, so that source inspection or decoding cannot recover information merely hidden on screen.

## Implementation Decisions

The user approved the common projection seam, source-preservation guarantees and verification approach. The boundaries below guide later design; they are not a committed schema or implementation.

1. Persist publication intent with authoritative map data through the existing validated mutation coordinator, single writer, ordered durability queue, recovery and history boundaries. Do not move durable data or privacy workflows into transient UI state. Publication edits should behave as ordinary undoable edits; exporting itself is not a mutation.
2. Build one pure disclosure projection over committed source data. Construct a player document from allowlisted properties, safe identities and permitted relationships. Do not spread full source entities then delete a few known secret fields. Unknown future extensions default to omission.
3. Resolve effective source geometry before filtering; then construct only authorized player geometry, graph references and derived counts. Preserve explicit exact-position disclosure for hidden route destinations. Never calculate player counts, labels or bounds from the omitted source graph.
4. Preview, player reader and player image renderers consume the same player document/projection. A hidden class, disabled UI control or full-scene DOM clone is not the confidentiality boundary. Shared styling/rasterization utilities may remain useful after providing a safe scene.
5. Keep URL compression/encoding and player JSON as two transports of the same validated, versioned player document. Decode client-side without requiring GM IndexedDB or replacing the saved GM workspace. Bound compressed and decompressed sizes and graph work, and never truncate output silently.
6. Establish and document a practical link budget through representative-map and supported-browser/share-path verification. Above it, provide the agreed JSON fallback. Browser maximum URL length alone is not a sharing guarantee. The exact numeric budget/codec choice remains a technical implementation decision to validate.
7. Separate player format identity/version from full GM backups. Continue importing existing full-map v1 documents with private legacy defaults. New complete backups retain all notes, publication settings and layout. A newer full-backup version may be needed; older-application compatibility is not promised. Unsupported versions fail clearly.
8. Preserve independent-copy import semantics and ID/reference remapping for complete GM maps, including per-object Field masks and disclosure settings. Shared same-name Field definitions must not silently broaden publication: preserve compatible policies or use an explicit conflict/review path. Preserve existing legacy geometry/Jump-level shims.
9. Keep the GM reader/writer/history entirely out of the player reader composition. Preview is a convenience inside a GM session, not a promise that the GM browser contains no secrets. Visiting the base site intentionally still opens the saved GM workspace.
10. Reuse existing guarded file-action preflight and committed-state semantics. Drafts, armed tools, continuous gestures and transient previews do not become private-data sources for a generated snapshot. Preserve existing full export, save-failure and recovery behavior.

### Acceptance Criteria

1. Clear desktop and compact UI controls express four location modes, separate public/private prose, Field publication and per-object masks, route sharing and the player title. Saving/reloading preserves them; normal edit cancellation, Undo/Redo and recovery retain their established guarantees.
2. Legacy initialization and new-creation defaults match the distinct agreed policies without losing descriptions, values, geometry or complete GM data.
3. Unknown presence never reveals source type through a glyph, halo, key, ID, field or accessibility label. Known type reveals type but no source identity/properties. Revealed content contains only permitted details.
4. Only Revealed systems open their internal map. Hidden/partial system payloads do not carry internal objects, even if a child setting is more permissive.
5. Shared routes follow the retained-endpoint rules and keep Jump levels; hidden destinations retain exact permitted coordinates with generic unresolved presentation. Both-hidden/unshared routes are absent. Source route resolution is unchanged.
6. Required secret host chains become anonymous with correct effective geometry; hidden siblings/unrelated Orbits stay absent. Already-published hosts are not duplicated. Empty Orbits are not independently published.
7. Station associations appear only between two Revealed objects and never auto-disclose a private Station.
8. Player prose/Fields obey mode, definition and assignment restrictions. No private or unused option/definition inventory, applicability, notes or Location keys is distributed.
9. Complete serialized player JSON, decoded URLs and SVG source contain no excluded source data, unknown extensions, private action/history or backup state. PNG shows only the same authorized scene. Filenames, accessible text, counts and bounds follow the same rules.
10. Preview, fresh-context URL loading, player-file loading and corresponding image exports agree on published information. Palette, full-scene/applied geometry and preview-isolation behavior remain correct.
11. URL size/decompression limits, invalid codecs, truncation and unsupported versions fail clearly or select the agreed JSON fallback, with no local-GM fallback or mutation. Entirely empty share generation is refused.
12. Two different player links and the GM base route can coexist without state contamination. Returning to the base site/reloading it retains the saved GM workspace. Player consultation works without a GM workspace or its IndexedDB hydration.
13. Complete backup/export/import and current/last-valid recovery remain full-data operations. Publication metadata survives supported full round trips; old files remain importable; visibility-policy conflicts do not silently publish data.

## Testing Decisions

Prefer one highest useful pure projection/reader seam over many tests mirroring internal functions. Assert observable published information, source immutability, valid references and actual serialized absence. Use existing Playwright/pure tests and public UI helpers rather than a new test runner.

- Pure matrix: every disclosure mode, native/custom Field restrictions, unused options, unknown extra properties, legacy/new defaults, root-system gate, and safe identities/labels.
- Graph/geometry: nested secret hosts, sibling-default angles/radii, already-public hosts, unoccupied centers, hidden siblings, route conversion from either source orientation, exact hidden-destination position, private route ordering, both-hidden endpoints and physical Stations.
- Portable data: new full backup round trips and independent-copy import, all supported old export shapes, per-object mask remapping, privacy-policy Field conflicts, current and backup restore.
- Real artifacts: capture actual downloaded link/JSON/SVG/PNG; inspect the whole decoded/serialized data including SVG attributes, not just a screenshot. Put distinct secret markers in every private surface. Verify both privacy and the intentionally disclosed unknown positions/host structure.
- Browser journeys: author changes modes/Fields/routes, previews, shares, and opens in a fresh player context; load JSON fallback; multi-tab player isolation alongside the base editor; reload/error handling; compact/desktop controls and focus; source export unchanged after sharing.
- Preflight/regressions: modified drafts, continuous/held gestures, failed saves, stale context and authoritative applied geometry. Retain existing complete JSON, SVG/PNG, independent-copy import, backup/recovery and history scenarios.

Prior art: `tests/workspace-data.spec.ts`, `tests/workspace-field-types.spec.ts`, `tests/workspace-reviewed-imports.spec.ts`, `tests/workspace-image-exports.spec.ts`, `tests/workspace-image-export-preflight.spec.ts`, `tests/workspace-recovery.spec.ts`, `tests/workspace-history-coordinator.spec.ts`, `tests/workspace-history-retention-ui.spec.ts`, and download helpers in `tests/helpers.ts`.

For later implementation: lint, typecheck, focused pure/browser failures and a production build/compiled-reader entry check because a new client-loaded route interacts with SSR. Run the integrated full suite once on the stable candidate, then targeted retests after corrections. Use the Sensitive project-development route: architect before implementation, developer, independent reviewer plus complementary deep review. No application tests/builds were run for this documentation-only scoping effort.

## Out of Scope

- Pushes, PRs, remote issue edits, deployments, feature merges into main or source-issue closure. The separate `implement` instructions for tickets 01–07 authorize their local implementation and commits.
- Multiple saved editable GM workspaces, simultaneous GM-tab write-conflict resolution, multiple audience profiles or per-player discovery tracking.
- Accounts, shared map storage/database/cache, stable mutable share URLs, live updates, access revocation, link-shortening service or self-contained offline HTML app.
- Full campaign management, journals, factions/NPCs/missions, new external/embedded note features, annotations, or a separate competing domain glossary.
- Independent empty-Orbit publication, system-only player links, per-object public aliases, or editing a player document in the GM importer.
- Inferring whether deliberately public free text contains an unmarked spoiler.

## Further Notes

### Publication and Readiness

Published locally by explicit invocation of `to-spec` on 2026-10-29, following the repository's tracker mapping: specifications are authoritative under `.scratch/<feature>/spec.md`. The specification carries category `enhancement` and state `ready-for-agent` in `triage_labels`, separate from lifecycle `status: open`. GitHub remains the authoritative source request; its labels and state are unchanged. No additional interview or implementation tickets were needed to publish this specification.

The common projection seam and verification approach were already confirmed in the integrated final review. Exact schema/version numbers, compression choice and numeric link budget are technical design tasks within the specified acceptance criteria, not unresolved product scope. The Sensitive design/review route remains required for later implementation.

### Approved Implementation Tickets

The user approved these seven end-to-end slices and their exact blocking edges through the integrated `to-tickets` question on 2026-10-29. They were published as separate open/unclaimed local tickets triaged `enhancement` / `ready-for-agent`. All seven tickets are closed under the user's separate implementation instructions. System/object publication, player text, Field policies/masks, shared routes and safe Station associations are implemented in the common allowlisted preview and independent player JSON reader, with player SVG/PNG exports, strict source migration and complete private backups. Ticket 06 adds immutable compressed links with bounded client-side admission and JSON fallback; its verification and local closure completed on 2026-11-04. Ticket frontmatter records current lifecycle. References below are local, not GitHub issue numbers.

| Ticket | End-to-end slice | Blocked by |
| --- | --- | --- |
| 01 | [Preview system publication in the Jump Cluster](tickets/01-system-publication-preview.md) | None |
| 02 | [Explore published objects and anonymous Orbit host chains](tickets/02-object-publication-host-chains.md) | 01 |
| 03 | [Publish player text and permitted Field values](tickets/03-public-text-and-fields.md) | 02 |
| 04 | [Publish Jump Routes and safe physical Station associations](tickets/04-shared-routes-and-stations.md) | 02 |
| 05 | [Export and open a standalone player JSON snapshot](tickets/05-player-json-and-reader.md) | 03, 04 |
| 06 | [Share compressed player links with a JSON fallback](tickets/06-compressed-player-links.md) | 05 |
| 07 | [Export player-safe SVG and PNG maps](tickets/07-player-svg-png-exports.md) | 04 |

At publication the initial executable frontier was ticket 01 only. All seven tickets are now closed; no implementation ticket remains on the executable frontier. Image work did not wait for JSON/URL transport: the common object/relationship scene was its prerequisite; public prose/Fields are not drawn as map imagery, so 03 was not an artificial image dependency. Coordinate overlapping shared-contract edits under the existing specialist ownership rules. The [tickets 03/04 implementation record](tickets-03-04-implementation.md) preserves its original checks/base; the [tickets 05/07 implementation record](tickets-05-07-implementation.md) records integration with refreshed main, final checks and review closure. The [ticket 06 implementation record](ticket-06-implementation.md) records the final upstream integration, bounded link transport, compiled native sharing evidence, cumulative suite and affected replays.

No standalone prefactor or horizontal schema/test ticket is needed: the focused projection/persistence boundaries are introduced through the first demoable preview slice. Tickets 01–04 expose only the Warden-side preview; player JSON waits for both content and relationship projection, and image sharing waits for the complete relationship scene. Each slice owns relevant privacy/compatibility checks. Run the integrated full suite once on the stable completed candidate, followed by required Sensitive reviews; do not defer individual ticket verification to an unspecified final cleanup ticket.

Ticket-publication verification: seven files, 57 unchecked acceptance criteria, all required metadata/parent/blocker/index links present, exact approved dependency graph, no cycles and initial frontier 01 only. No ticket body contains a specific implementation-file path. The planning baseline/source issue were refreshed and unchanged; no application tests were run for this Markdown-only publication.

### Risks and Dependencies

- **Deliberate structural disclosure:** exact route destination positions and recursive unknown centers reveal existence/geometry. They are accepted exceptions to a blanket Hidden-means-no-presence rule; implementations and tests must not erase them or silently reveal more.
- **Format/migration risk:** current codecs export full objects and field settings, tolerate some unknown properties and use same-name Field merging. Privacy metadata must survive full operations without broadening publication. Player documents have different contracts from editable full maps.
- **Link size:** the implemented policy caps the complete URL at 8,192 UTF-8 bytes, including actual origin/base path/version prefix. Representative distinct prose exceeds this limit and retains complete JSON fallback. Compiled Chromium native clipboard, second-tab navigation and reload passed at 8,191 bytes; this is not a guarantee for every messaging service. See the ticket 06 evidence for exact fixtures and limits.
- **Session/persistence risk:** the current editor has a singleton `current`/`last-valid` slot and full history snapshots. Player consultation must not hydrate/import itself through those owners or expose their recovery paths. This does not erase the GM's private data or make a borrowed GM browser safe.
- **UI filters:** [#8](https://github.com/Submoon/ttrpg-cluster-control/issues/8) controls presentation, not secrecy. Player export must use publication rules independently of ordinary map filters.
- **Future surfaces:** [#11 annotations](https://github.com/Submoon/ttrpg-cluster-control/issues/11) and [#22 note links](https://github.com/Submoon/ttrpg-cluster-control/issues/22) must enter the allowlisted projection deliberately if later supported. They are not blockers. Parent [#3](https://github.com/Submoon/ttrpg-cluster-control/issues/3) is closed.
- **Implementation order:** follow the approved local ticket graph above. Architecture/design precedes source edits under the Sensitive route; implementation remains subject to a separate instruction. GitHub #9 is not split into remote sub-issues or otherwise changed by this local publication.

### Scope Review

Approved by the user on 2026-10-29: scope and verification plan validated. This covers the consolidated publication rules, a common projection for preview/link/JSON/images, ordinary save and Undo/Redo for publication edits, actual-artifact privacy checks, source preservation, empty-share refusal and isolated invalid-input handling. No product-choice questions remain open. Exact schema/version numbers, URL budget/codec and detailed implementation interfaces remain technical design work within this scope.

At specification publication, origin fetch showed HEAD/main/origin/main at the recorded baseline; GitHub #9 had the same body, labels, state and no comments; all 11 checked local planning/test reference paths existed. That planning-only phase ran no application tests/build and changed no product source or GitHub state. Actual implementation/check evidence is recorded separately for [ticket 01](ticket-01-implementation.md) and [ticket 02](ticket-02-implementation.md).

## Follow-up requests

On 2026-11-04 the user requested [Align player maps with the Warden map interface](tickets/08-player-map-interface-consistency.md), initially referenced in [GitHub #40](https://github.com/Submoon/ttrpg-cluster-control/issues/40). The user clarified that local ticket 08 belongs to this current effort and blocks merge of PR #39 until implemented and verified. It covers icons, dashed Orbits, useful inspection, nested Hierarchy and consistent Back placement while retaining revelation colors, without changing the established disclosure rules.

## Original seven-ticket resolution

All seven approved slices are implemented and committed locally on `codex/player-view-ticket-01`. The common allowlisted player document serves preview, JSON, immutable compressed URLs and SVG/PNG; the base route retains the saved GM workspace. Ticket 06 completed verification on 2026-11-04 against integrated baseline `62e5e55d293573019979df1e59013855ac9317a0` (origin/main `47c0418a835da285e9edb88e8f8dffc19c3a2bba`).

The single cumulative run passed 654/670; all 16 initial failures passed subsequent affected replays, including the final 9/9 image/responsive matrix. Eight timing failures passed unchanged without an established cause; this is not a clean full-suite pass. Lint, types, build, actual artifact/privacy checks and independent review closure are recorded in the [ticket 06 implementation record](ticket-06-implementation.md). GitHub #9 remains open and unchanged; no remote publication or feature merge into main occurred.
