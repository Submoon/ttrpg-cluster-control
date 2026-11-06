---
title: Player view and secret-free export — scope analysis
status: closed
---

# Player view and secret-free export

This is the historical analysis/interview log. The user approved the [consolidated scope and verification plan](spec.md) on 2026-10-29. No product behavior has been implemented. Earlier proposals, pending-state wording and rejected options are retained as history and are superseded by that specification.

## Current decision summary

The [consolidated specification](spec.md) supersedes the historical proposals and pending-state wording in this interview log. Its final shared-understanding/verification review is approved; all product-choice questions have received answers.

Confirmed by the user:

- Self-contained compressed player-snapshot links, a player JSON fallback for oversized links, and a new link for each update (Q3).
- Four location presentations: Hidden, Unknown presence, Known type, Revealed (Q7). Withheld information is removed from distributed data.
- Separate player-facing text and private GM notes (Q6).
- Player publication configured per native/custom Field, with additional per-object masking of a normally shareable value; partial-disclosure modes publish no properties (Q8).
- Legacy descriptions become private GM notes, player text starts empty, and existing locations/Fields require explicit publication (Q9).
- Only the name/type/value of Fields actually published on Revealed objects is embedded; private/unused definitions, masked values, applicability and unused select options are omitted (Q18).
- Real location names appear only when Revealed. GM Location keys and internal route names are omitted; shared routes keep their Jump level and unknown destinations use generic labels. The share has a player title chosen by the GM rather than automatically using the cluster name (Q19).
- The base site continues reopening the saved GM workspace for the same browser profile/origin; a player link must not overwrite it.
- Initial workspace scope is one saved GM workspace and multiple independent simultaneous player views; no editable multi-GM-workspace library (Q22).
- Link/player JSON contain the sanitized cluster; the reader permits read-only pan/zoom, entry into Revealed systems and inspection of public details. Initial scope also includes a GM player preview and safe SVG/PNG of the current map (Q20).
- A Jump Point/Station association is published only when both objects are Revealed; do not auto-reveal a hidden Station for this association (Q23).
- Only Orbits required by shared objects and their required host chain are published; no initial empty-Orbit publication controls (Q24).
- New systems/objects default to Known type, new Fields to private, and new routes to unshared. Legacy locations/Fields still require explicit publication (Q21 and follow-up question 5).

Also confirmed: only Revealed systems open their internal maps (Q15); shared routes to Hidden systems appear unresolved at the destination's exact map position (Q10/Q11/Q16); routes have their own sharing switch, require at least one non-hidden system, and do not require the internal Jump Points to be revealed (Q17). A visible object's entire required chain of hidden orbital centers is automatically represented as Unknown presences (Q12/Q14). These are player projections: the GM's resolved routes and original host relationships remain unchanged.

Confirmed closing choices: one common audience configuration; dedicated versioned player documents with continued import of legacy GM files; full backups retain publication metadata without an older-app compatibility guarantee; entirely empty share generation is blocked. The user approved the final shared-understanding and verification-seam review. Scoping is complete; no product implementation is authorized.

## Source issue

- [Player view and secret-free export — GitHub #9](https://github.com/Submoon/ttrpg-cluster-control/issues/9), fetched on 2026-10-29.
- Open; labels: `enhancement`, `priority:P1`; no comments. Source last updated: 2026-10-09T14:46:17Z.
- Existing requirements: a separate player export excluding internal notes and hidden locations; discovery-based hide/reveal; lightweight sharing without exposing preparation notes.
- Existing acceptance criteria: player-safe export available; undiscovered locations hidden; GM-only notes stripped; independent loading/viewing; clear UI to mark GM-only content.
- The issue does not specify audiences, exact fields, default discovery, file encodings, offline interactivity, or backward compatibility policy.

## Baseline and authorization

- Worktree: `C:/Users/fbal-fontaine/.codex/worktrees/5fe9/ttrpg-cluster-control`, detached HEAD.
- After a successful `git -c core.fsmonitor=false fetch origin`, HEAD, local `main`, and `origin/main` all resolve to `8d4b66504ca6723db5405ed7cb93d0a666264c9a`.
- HEAD versus origin/main: 0 ahead / 0 behind. Local main versus origin/main: 0 ahead / 0 behind. No fast-forward needed and no intentionally different base.
- Pre-existing untracked `.codex/environments/` is outside this effort and is preserved.
- Authorized work: code analysis, local planning, and product clarification. No product implementation, remote issue edits, push, PR, or merge.
- Process: read `ask-matt`, `grill-with-docs`, `grilling`, `domain-modeling`, `to-spec`, project development, AGENTS and its relevant references. Use a bounded interview backed by code facts, then synthesize locally after decisions. No setup or competing glossary. `CONTEXT.md` remains authoritative domain context. No durable domain decision or ADR has been agreed.

## Current contracts and evidence

Paths below are repository-relative and pinned to the baseline above.

| Concern | Established behavior | Evidence |
| --- | --- | --- |
| Domain | Objects have name, Location key, one description, placement, native/custom values and an optional Station association. Systems, Orbits and routes have no audience/discovery/privacy fields. No separate GM notes collection exists. | `domain/workspace-model.ts:34`, `:77`, `:100`, `:111`, `:121` |
| Location keys | Link map objects to Warden-facing keyed descriptions. Whether players should receive these markers is unresolved. | `CONTEXT.md:29` |
| Custom fields | Applicability determines object categories/subtypes, not confidentiality; assignments outside applicability remain valid and stored. | `domain/workspace-validation.ts:328`; `tests/workspace-field-types.spec.ts:42` |
| Cluster JSON | The complete cluster, all shared field settings and saved layout are exported. This is a backup/transfer contract. | `domain/workspace-codec.ts:11`; `README.md:20` |
| System JSON | Includes the complete selected system and all shared field settings, including unused definitions/options. Only unrelated layout and cluster routes are omitted. | `domain/workspace-codec.ts:33` |
| Import | Accepts map format `ttrpg-cluster-control-map`, outer and layout version 1. Validated import appends an independent copy with remapped IDs and relationships; it does not establish a read-only viewer. | `domain/workspace-json-import.ts:29`, `:188`, `:300` |
| Field merging | Same-name definitions merge when type and ordered options match; applicability scopes union. A future privacy policy must participate in compatibility and conflict handling. | `domain/workspace-json-import.ts:149`, `:315` |
| Unknown properties | Known fields are validated without a general unknown-property rejection. Restore/import spread some source records, so unknown object/system data may survive. A player boundary must reconstruct an allowlisted payload rather than remove a few known secret fields from a full object. | `domain/workspace-schema.ts:366`; `domain/workspace-json-import.ts:193` |
| SVG | Deep-clones mounted SVG, removes specified interaction artifacts, inlines styles and serializes the remaining DOM. It does not add an embedded workspace JSON block. It does not sanitize for secrecy. | `utils/map-image-export.ts:47`, `:168`, `:260` |
| Nonvisual SVG content | Root accessible names contain chart names; route accessible names contain endpoint and system names; object labels contain keys/names/subtypes; Orbit labels contain host names; entity data IDs remain. | `components/ClusterMap.vue:15`, `:603`, `:607`; `components/SystemMap.vue:15`; `components/maps/system-map-renderer.ts:714`, `:962`, `:969`; `utils/cluster-map-geometry.ts:359` |
| Derived disclosures | Cluster cards count all stars/objects; labels show keys/names/type glyphs. Counts, hierarchy, accessible text and scene bounds must be computed from published content. | `components/ClusterMap.vue:859`; `components/maps/system-map-renderer.ts:988` |
| PNG | Rasterizes the serialized SVG through canvas; no application JSON metadata is added. Visible labels and geometry still disclose information. | `utils/map-image-export.ts:276` |
| Filenames | Include chart names with filesystem-character replacement. A safe scene can still have a revealing filename. | `composables/useWorkspaceFiles.ts:181` |
| File action guards | Preflight resolves pending editing/continuous operations; image export rechecks map identity/name and projects authoritative applied geometry onto a clone. A player export must retain committed-state semantics and preview isolation. | `composables/useWorkspaceFiles.ts:239`; `components/ClusterMap.vue:211`; `components/maps/system-map-renderer.ts:467` |
| Persistence | One writer publishes detached validated memory then queues durability. IndexedDB contains full current and last-valid snapshots; a successful save usually retains the prior current as backup. | `composables/useLocalWorkspace.ts:65`; `utils/workspace-storage.ts:107` |
| History | Full workspace snapshots and name-bearing action descriptors live in the editor history; identity/hydration boundaries reset it. Hiding a panel or ordinary updates do not. | `composables/editor-workflows/workspace-history-timeline.ts:1`; `composables/editor-workflows/workspace-mutations.ts:354`; `composables/useWorkspaceHistory.ts:78` |

No existing player viewer entry point was found. The main route mounts `BaselinePage`, which composes the editor, file actions, persistence and history (`pages/index.vue:1`).

## Privacy distinction

An author preview can filter a complete local GM workspace; this is a convenience for the GM and does not establish that the browser contains no secrets. A distributed file needs a different guarantee: excluded content is absent from its data, source markup, embedded payloads and metadata. Disabling controls or applying CSS is insufficient.

Removing content from a distributed copy does not require erasing the GM's authoritative data, backup or history. Conversely, loading a player file into a browser already containing GM work cannot make that browser suitable for lending to players. A dedicated player consultation context should consume only the sanitized snapshot and should not expose the editor's recovery/history/export actions. Exact storage lifetime is still a design decision.

The application can enforce declared publication rules. It cannot infer that arbitrary text deliberately marked public contains an unmarked spoiler. Previously distributed snapshots also cannot be recalled by changing a later export.

## Decisions pending — interview tree

### First round sent to the user

1. **Audience and delivery:** recommended starting scope is one shared player group, no accounts, manually regenerated snapshots. The user instead asked whether the application can provide a link carrying all necessary context without a backend, database or cache. Audience cardinality remains unresolved; this question is a delivery preference/feasibility request, not acceptance of all prior recommendations.
2. **Independent consultation and formats:** the user gave the same self-contained-link question in response to the JSON/viewer question. A link-based reader is now under consideration. Required downloadable formats and offline interactivity remain unresolved.

### Follow-up: self-contained links and simultaneous workspaces

On 2026-10-29 the user also noted that this might require several workspaces at once. Clarification is pending between simultaneous player consultations and a library of independently editable, saved GM workspaces.

**Feasibility:** a proposed URL such as `https://<app-host>/player#v=1&data=<encoded-payload>` can carry a versioned, compressed, URL-safe encoding of a sanitized player document. This is illustrative; no such route currently exists. The client reads, decodes, decompresses and validates it, then renders only the player reader. The fragment after `#` is processed client-side and is not included in the HTTP request ([MDN URI fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment)). Browsers provide gzip/deflate compression/decompression APIs ([MDN Compression Streams](https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API)).

- The application still needs to be served; this approach adds no map-data backend, database, server cache or share-resolution endpoint. It does not make the application fully offline on first use.
- All necessary *player* context can be embedded: published cluster/system data, safe descriptions/fields, permitted relationships, geometry and optionally the initial map/view. Full GM context, publication source metadata, hidden entities and history must be absent before encoding. Compression/encoding is not secrecy or encryption.
- A link represents a snapshot. Keeping the same self-contained URL while changing its included data is impossible without consulting some other changing source. New revelations require regenerating and distributing a new URL. Previously distributed URLs remain readable and forwardable.
- The fragment avoids sending this payload in the initial HTTP request, but remains readable by the recipient and application scripts and may be retained in browser history or wherever the URL is shared. A generic link preview cannot read its fragment through the page request. The reader should not send the payload to telemetry or error reporting.
- Link size must be bounded and tested through intended browsers and sharing tools. Chromium itself has a finite maximum URL length, which is not an end-to-end sharing budget ([Chromium URL guidelines](https://github.com/chromium/chromium/blob/main/docs/security/url_display_guidelines/url_display_guidelines.md)). No universal safe numeric threshold has been chosen. Recommend a JSON fallback rather than silently truncating or adding a shortening service.
- An illustrative local measurement on the **complete existing** `tests/fixtures/workspace-data-campaign-baseline.json`: 3,751 UTF-8 bytes, 812 gzip bytes, 1,083 Base64url characters excluding the URL prefix. This is a small full-map fixture, not a sanitized-player benchmark or proof of large-map/browser/messenger support. Measurement used in-memory .NET gzip; it created no product implementation.
- Decode safely: bound encoded and decompressed sizes, validate version/schema/references, handle invalid or truncated links, and render prose as text. Do not fall back to loading a local GM map when a player link fails.

**Current coexistence constraint:** `utils/workspace-storage.ts:6` uses one database/store with fixed `current` and `last-valid` keys. `composables/useLocalWorkspace.ts:27` uses fixed Nuxt state keys and an invocation-owned save queue. Existing workspace IDs do not establish independent storage slots or cross-tab write coordination.

**Bounded recommendation:** player consultation gets a dedicated page/document lifetime, with decoded state in memory per tab and no hydration, import, recovery or write through the GM workspace owner. Multiple player links can then coexist with each other and with the editor without overwriting GM data or exposing local GM content. This provides simultaneous independent consultations without assuming a full saved-workspace library. Same-tab navigation must replace player state and clear obsolete selection/camera ownership consistently.

**Base-site navigation expectation clarified on 2026-10-29:** the user asked whether opening the base site in a new tab will reopen the GM workspace. Yes: the existing base route hydrates the saved `current` workspace for the same browser profile and site origin. Preserve this behavior. The proposed player route only reads its sanitized URL/file document; it must neither replace that saved workspace nor make a later visit to the base URL resume a player document instead. If that profile/origin has no saved GM workspace, the base site retains its normal initial-entry behavior. Tab isolation refers to player document memory, not separate IndexedDB storage per tab. Several editor tabs on the base route still access the same singleton saved GM slot; independent GM workspaces and concurrent editing coordination remain separate unresolved scope.

**Separate optional expansion:** multiple editable/persisted GM workspaces require identity-scoped storage, backup/recovery, save queues, UI/history lifetimes, migration from the singleton slot, and a choice of behavior when two tabs edit the same identity. A selector/library and its operations need explicit product scope. They are not automatically necessary for read-only URL consultations.

Follow-up questions sent:

3. Is a snapshot link the preferred delivery method, with JSON fallback for oversized content and a new link for each update? Alternative: same link kept current (different data-source constraint).
4. Is simultaneous isolated player consultation alongside one GM workspace enough, or must multiple editable, locally saved GM workspaces also be supported?

Q3 answered on 2026-10-29: **"Oui : lien autonome, JSON en secours"**. The user accepts a self-contained snapshot link, a player JSON fallback for oversized links, and generation of a new link for each update. This selects the delivery approach; it does not settle the audience, content publication rules, SVG/PNG scope or saved-workspace library. Q4 remains unanswered.

### Confirmed delivery decision

- Primary sharing artifact: a link carrying a compressed, sanitized player snapshot, directly opened by a dedicated player reader in the application.
- Fallback: a sanitized player JSON file when the snapshot is unsuitable for a shareable URL. The same reader/projection contract should serve both transports.
- Updates: generate and distribute a new link. No stable mutable share URL, shared map database, server map cache or hosted publication service is included in the initial delivery scope.
- The ordinary application hosting remains necessary; this decision does not request a self-contained offline HTML application.
- This is a local product decision, not authorization to implement. No new domain glossary entry or ADR is needed for this transport selection at this stage.

### Next clarification round

Q5 originally proposed separate manual discovery and GM-only states for systems and catalogue objects. On 2026-10-29 the user challenged the utility of "discovered but GM-only", since both cases hide the entity. That proposal was withdrawn, followed by a binary publication proposal. The user then requested partial disclosure; accepted Q7 below supersedes both earlier proposals. Hiding an entire entity remains distinct from excluding its private notes/Fields when that entity is revealed. Independent campaign-progression bookkeeping is not requested.

Q6 answered on 2026-10-29: **"Texte joueur et notes MJ séparées, et du coup les Fields doivent pouvoir être configurés pour être affiché aux joueurs ou pas"**. Confirmed: separate player-facing text and GM notes, and configurable player publication for Fields. Follow-up Q8/Q9 below settle Field granularity and legacy initialization.

In the same response to Q5, the user suggested a third treatment: **"Il y a quelque chose ici, mais vous ne savez pas quoi"**, with an option to hide even the type, or reveal the type while hiding the name and properties. This establishes partial disclosure as a requested design concern; the exact controls and modes are not yet selected. Both the original independent discovery/GM-only flags and the subsequent binary-only recommendation are insufficient for this new use case.

Q4 on multiple editable/saved GM workspaces remains open. Q6's text separation and configurable Fields are accepted. No unanswered privacy choice is treated as a decision.

### Confirmed content decisions and partial-disclosure proposal

- Player-facing text and GM notes are separate. GM notes are always excluded from distributed player data, including for a visible/revealed location.
- Fields must be configurable for player visibility. Accepted Q8 specifies a setting per Field, native or custom, plus per-object masking of a shareable value. Unknown-presence and known-type modes suppress all properties regardless of Field publication settings.
- The GM wants to consider revealing only a presence, or a type without identity/properties, in addition to omission and normal publication. This does not request automatic campaign progression or a separate discovered-but-GM-only bookkeeping state.

The Q7 matrix was **accepted on 2026-10-29** ("Oui : ces quatre présentations conviennent"):

| Presentation | Player map | Player payload |
| --- | --- | --- |
| Hidden | No marker, except when a shared object's required orbital center is automatically shown as Unknown presence (Q12) | No full source entity, identity or properties; only a minimal projected center if required by the accepted relationship exception |
| Unknown presence | Neutral marker at the permitted position; generic unknown label | Only a safe marker identity and necessary presentation/position data; no source name, key, family/subtype, description or properties |
| Known type | Type-specific marker; generic type label, such as Planet | Permitted type and necessary presentation/position data; no source name, key, description or properties |
| Revealed | Public name/type and available public details | Player-facing text and explicitly permitted Fields; no GM notes or other excluded data |

The four user-facing presentations are approved; the exact technical schema is not. A public alias, Location-key policy, partial system entry, and relation propagation are still open. "Revealed" does not mean every property is automatically public.

**Code implications checked at the unchanged baseline:** object rendering currently uses subtype-dependent glyphs and a star halo, a Location key, name, repeated type mark and a name/key/type accessible label (`components/maps/system-map-renderer.ts:961`, `:969`, `:978`; `utils/catalogue-labels.ts:26`; `utils/catalogue-marks.ts`). Cluster cards expose system names and star/object counts (`components/ClusterMap.vue:828`, `:850`, `:859`). Thus an unknown marker needs an explicitly generic player representation, not just replacement of visible name text. Type-bearing Location keys, source IDs/properties, accessibility labels, metadata and derived counts must obey the selected disclosure mode. Graph/geometry hints, hosted Orbits and routes still need product decisions.

**Field decision Q8, accepted on 2026-10-29** ("Oui : réglage par Field + masquage par objet"): player publication is configured per Field, including native Atmosphere/Port class and custom definitions, with an optional per-object mask for a sensitive value of an otherwise shareable Field. Unknown-presence and known-type presets suppress properties irrespective of the shared definition's publication setting. Current Fields UI already presents native and custom definitions together (`components/field-definitions/model.ts:16`, `:88`), but publication is a new concern, separate from applicability.

**Compatibility decision Q9, accepted on 2026-10-29** ("Oui : publication explicite des anciennes données"): keep existing descriptions as private GM notes and initialize player text empty; existing locations and Fields require explicit publication. This specifies legacy initialization, not the default for future newly created content.

**Additional acceptance/verification candidates:** test every chosen partial-disclosure mode in both link decoding and JSON loading, plus selected image exports; unknown presence must not reveal the original type through a glyph/halo/key/source attribute, and known type must not retain its source name or properties anywhere in the payload. Field publication must not re-enable details suppressed by the entity mode. Test one shared Field with a single masked assignment if Q8 is accepted. An object's effective geometry and relationship projection must preserve only the spatial/relational facts the GM deliberately authorizes.

Q7/Q8/Q9 are accepted. No product implementation was authorized.

### Relationship clarification round

Q10 response on 2026-10-29: **"Un système masqué ne peut pas être ouvert effectivement. Et s'il est masqué la route devrait s'afficher unresolved pour les joueurs"**. Confirmed: a Hidden system cannot be opened; the user rejects the proposal to suppress a route solely because its endpoint system is hidden. Q15 later confirms that Unknown presence and Known type systems also cannot open their internal map. Source object settings remain intact when the parent suppresses publication.

Q11 response on 2026-10-29: **"Une route vers un système masqué peut être affiché 'unresolved'."** Confirmed: player publication may turn a source-resolved route into an unresolved-looking player route when its destination system is hidden. This supersedes the previous route-disappearance recommendation. The route must stay resolved in the GM workspace, its backups and full exports. The exact sharing switch, handling of the original hidden origin, both-hidden case and output geometry were not explicitly accepted; Q13 addresses them. Existing unresolved external exits and route names/levels still need a public-label policy.

Q12 response on 2026-10-29: **"Montrer automatiquement le centre comme présence inconnue"**. Confirmed: a visible object's hidden orbital host is automatically represented as an Unknown presence, rather than dropping the child or making it a standalone marker with no host. This deliberately discloses the required center's existence and its necessary position, without its identity/type/properties. The exception must not automatically reveal all other dependents. Q14 clarifies orbit curves and how far the automatic representation extends. GM geometry/relationships remain unchanged. Station associations are still open.

Facts supporting the decision: `objectPositions(system, geometry)` (`utils/system-map-geometry.ts:279`) resolves full nested applied positions including saved/default geometry. It must run on the intact committed source before filtering; missing hosts/Orbits and cycles throw. `toNormalizedMapPoint` (`utils/system-map-geometry.ts:80`) can convert scene positions into free placements; an existing example is `freePointForObject` (`composables/editor-workflows/useSystemObjectPlacement.ts:320`). `captureEffectiveObjectAngles` preserves only angles and is insufficient alone. The player projection need not modify the source to show an independent marker.

Current route rendering still requires the source Jump Point objects (`utils/cluster-map-geometry.ts:250`, `:288`) and its accessible labels use their names (`:359`). A player route between safe system markers is therefore a distinct projection/renderer contract, not a direct reuse of the current graph with missing endpoints. This is a technical consequence, not a reason to force private Jump Points into the shared data.

#### Follow-up decisions Q13–Q18

- **Q13/Q16, accepted on 2026-10-29:** the user chose to retain direction or real destination position in Q13, then explicitly selected **"Oui : position exacte de la destination sur la carte"** in Q16. An unresolved player exit for a hidden system therefore retains its exact schematic map position. This deliberately publishes the location of an unknown destination while withholding source name, identity, type/properties, internal map and source endpoint details. Do not use the previous detached/nearby-exit recommendation. Orient the player connection from its retained side if necessary, without changing the source route. Do not promise to preserve bends derived from private route ordering.
- **Q14, accepted on 2026-10-29:** **"Afficher aussi toute la chaîne des centres comme inconnus"**. Recursively include the required chain of secret host objects as neutral Unknown presences and the necessary orbital structure. This supersedes the direct-host-only proposal. It does not publish other hidden satellites or unrelated orbit branches; it does not disclose private ancestor names, true types or Fields. Technical projection details for already-published ancestors and unoccupied geometric centers must be explicit in the eventual specification rather than inventing physical objects that do not exist.
- **Q15, accepted on 2026-10-29:** **"Oui : seule la présentation Révélé permet l’ouverture"**. Unknown presence and Known type systems remain cluster markers; only Revealed systems open internal maps, whose objects follow their own publication modes.
- **Q17, accepted on 2026-10-29:** **"Oui : réglage par route, au moins un système présent"**. Each route has its own sharing setting. A shared route requires at least one non-hidden system; two hidden endpoint systems suppress it. Its internal Jump Points do not need to be revealed. Existing source-unresolved routes still need a permitted origin system and a sharing setting; their label policy remains open.
- **Q18, accepted on 2026-10-29:** **"Oui : seulement les Fields et valeurs effectivement publiés"**. Include only name/type/value of Fields actually permitted on Revealed objects; omit private/unused definitions, masked values, applicability and unused select choices. Example: a published Faction value Merchants must not reveal a private Cult option. This is a consultation document, not a portable copy of the GM's field-definition editor.

### Labels, output scope and new-data defaults

- **Q19, accepted on 2026-10-29:** **"Oui : ces règles de libellés conviennent"**. Real names appear only for Revealed locations; GM Location keys are excluded; shared routes keep their Jump level and use a generic unknown-destination label, while internal route names stay private. The GM chooses a player-facing share title rather than implicitly publishing the cluster title. The player title can also provide a safe filename; do not reconstruct omitted source names in filenames, accessibility text or error messages.
- **Q20, accepted on 2026-10-29 via integrated question 1:** **"Oui : lien, JSON, aperçu et SVG/PNG"**. Link and player JSON contain the complete sanitized cluster, permitting read-only pan/zoom, entry into Revealed systems, and inspection of public details; the GM has a player preview and safe SVG/PNG export of the current map from the same disclosure projection. Unknown/Hidden systems' internal content stays excluded despite the term complete cluster. No additional system-only player-link scope was requested.
- **Q21 / follow-up question 5, accepted on 2026-10-29:** the user first corrected the proposed Hidden default to **"Par défaut ils commencent à avec le type révélé mais pas le nom plutôt"**, then explicitly confirmed **"Oui : nouveaux lieux Type connu, Fields privés, routes non partagées"**. New systems/objects therefore start Known type; new Fields remain private and routes unshared. Legacy initialization stays private per Q9. Previously agreed unknown-center/route projections remain the relationship exceptions for deliberately shared content. A valid empty player view for all-hidden content remains part of the final-review proposal, not an answer inferred from the user's default correction.

These questions do not settle a multi-GM-workspace library, per-audience publication profiles, Station association behavior or the compatibility strategy. No product implementation authorized.

### Workspace and secondary-relationship scope

The user explicitly requested that clarification continue on 2026-10-29 and then required questions to be asked through the integrated mechanism. Use `request_user_input_async` for subsequent product questions; do not substitute a prose-only questionnaire. The four outstanding questions were reissued through that mechanism and answered as recorded here.

- **Q22, accepted on 2026-10-29** ("Oui : un workspace MJ et plusieurs vues joueur"): retain the existing single saved GM workspace while isolating multiple simultaneous player documents. A library of multiple editable/saved GM workspaces is outside this issue's initial scope. Opening the base site still reopens the saved GM workspace; player consultation must not import itself into it. This resolves the earlier Q4 ambiguity.
- **Q23, accepted on 2026-10-29 via integrated question 3:** **"Oui : association entre deux objets révélés seulement"**. Publish a Jump Point's physical Station association only when both objects are Revealed. A hidden Station is omitted rather than automatically promoted to an unknown presence, because unlike an orbital host it is unnecessary to render the published object/route. The existing same-system Installation/Station reference invariant is established in `domain/workspace-schema.ts:72`; logical route endpoints and physical Stations are distinct in `CONTEXT.md`.
- **Q24, accepted on 2026-10-29 via integrated question 4:** **"Oui : seulement les orbites nécessaires"**. Publish only the Orbits required by shared objects and their accepted host chain; no empty-Orbit publication control in the first version. This concerns player output scope; it does not remove empty Orbits from GM authoring or backups.

**Follow-up integrated question 6, accepted on 2026-10-29:** **"Oui : une configuration joueur commune"**. One shared player publication configuration per GM workspace; no named group or per-player knowledge profiles.

**Follow-up integrated question 7, accepted on 2026-10-29:** **"Oui : joueur distinct, anciens fichiers MJ importables"**. Dedicated versioned player documents open consultation; full GM backups retain notes and publication settings. The updated application continues importing legacy GM files. New full backups need not open in older application versions.

**Follow-up integrated question 8, answered on 2026-10-29:** **"Empêcher la création d’un partage entièrement vide"**. Block entirely empty share generation; this supersedes the proposed distributable empty view. Clear invalid/unsupported-player errors without loading GM data are a final-review technical recommendation consistent with reader isolation. The consolidated specification includes the proposed verification seam for final review. Do not silently introduce accounts, campaign tracking or a multi-workspace library.

**Additional unresolved-route evidence:** `clusterRouteGeometry` computes resolved endpoints from true system positions and unresolved endpoints from separate positions or `automaticExitPosition` (`utils/cluster-map-geometry.ts:287` onward). Reusing the resolved source path would disclose hidden geometry. Any synthetic player exit must use only permitted player inputs and avoid ordinals/counts derived from omitted routes. `clusterRouteLabel` (`:359`) uses source endpoint/system names, so it must also be projected. A currently unresolved GM route's `unresolvedExit` string is arbitrary authored text, not automatically safe. Distinguish source unresolved external destination from player-unknown destination in the projection contract; do not change the existing authoritative domain meaning.

Acceptance checks now include conversion from either source orientation, the exact permitted hidden-destination map position, two hidden endpoints, multiple private routes, repeated routes to one hidden system without leaking source IDs, recursive auto-unknown hosts with sensitive glyphs/keys/Fields, siblings remaining private, and unchanged full GM export/history after player projection. Q14/Q16/Q17 determine the expected geometry, recursive host closure and route publication limits. Recompute derived layout from published structure where the user has not explicitly authorized an original source-derived value.

### Follow-up: stable URLs, hosting complexity and costs

The user asked whether keeping the same URL updated requires a database/cache and could make Vercel deployment more complex or expensive. This is a feasibility/cost question, not a choice of infrastructure or an approved scope expansion.

- A stable URL that resolves changing content needs an addressable source of the latest published snapshot. A database is one option, but a durable JSON file in object storage or a static file replaced through deployment also works. A disposable cache alone should not be the only copy of the published document.
- The existing self-contained fragment proposal adds no shared data service but requires a new URL when its contents change. A stable hosted snapshot trades that property for publication/storage infrastructure and read freshness rules. Updating an already open player view also requires an explicit refresh/polling/realtime choice; a stable URL by itself only locates the latest content on a subsequent fetch.
- If publication must occur from the browser application, it needs an authorized write mechanism and server-held storage credentials (or limited upload authorization), plus snapshot identity and cache invalidation/freshness behavior. This is a concrete complexity increase even with a managed service. Manual replacement/redeployment can avoid building an in-app publication endpoint, at the cost of a different GM workflow.
- Vercel offers managed Blob storage and database integrations; deployment can remain on Vercel. Blob has included Hobby usage, with limits; paid usage depends on storage, operations and transfer, and Function usage may also apply. A small private group may fit an included allowance, but no user workload or account plan was inspected and no zero-cost guarantee is made. Sources verified on 2026-10-29: [Vercel Storage](https://vercel.com/docs/storage), [Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing), [Vercel pricing](https://vercel.com/pricing).
- Recommended product trade-off to discuss: self-contained snapshot links plus JSON fallback if avoiding shared infrastructure is the priority; stable hosted player snapshots if retaining one URL is the priority. Neither requires storing the GM's secret source workspace remotely. No infrastructure provisioned or selected.

These choices affect the later questions; do not silently settle the branches below.

### Later rounds

- **Discovery and audiences:** what counts as a location (system, catalogue object, other)? Is discovery a manual shared state or inferred from relationships? Can revealed content become hidden again? If multiple audiences are requested, is discovery per audience?
- **Entity publication:** four partial-disclosure modes are approved (Q7). Independent campaign discovery/progression remains unnecessary unless an actual additional use case emerges. Private notes/Fields on a revealed entity remain a distinct content-level concern.
- **New content:** new locations default Known type, new Fields private and new routes unshared; Q9 separately keeps legacy content private.
- **Descriptions and notes:** separate player text and GM notes are approved, and legacy descriptions remain private. Any extension of prose to systems/routes beyond current object descriptions must be scoped explicitly.
- **Names and labels:** Q19 settles Revealed names, excluded Location keys/internal route names, retained Jump levels, generic unknown destinations and an explicit player share title. No separate per-object public alias was requested. Display filters from #8 cannot confer confidentiality.
- **Native/custom fields:** Q8 settles per-Field publication with per-object masks; Q18 limits embedded metadata to Fields and values actually published. No unused definition, applicability or unselected option inventory is distributed.
- **Systems and routes:** Q15 allows internal entry only for Revealed systems. Q16/Q17 authorize exact-position unresolved exits for shared routes to hidden systems, with at least one non-hidden endpoint system. The authoritative GM route remains resolved.
- **Orbit hosts and Station links:** Q12/Q14 select automatic Unknown presence for the entire required chain of secret hosts. Station associations still need policy. Do not apply destructive deletion cascades as privacy policy.
- **All content hidden:** current workspace validation requires at least one system. A valid empty player document is recommended for final shared-understanding review; do not expose a hidden system to satisfy editor validation. A player document need not satisfy all authoring-workspace requirements.
- **Reader behavior:** select navigation, public inspector details, image downloads, reload behavior and local persistence needs. Read-only controls cannot stop recipients editing a downloaded file externally; the security property is absence of source secrets.
- **Compatibility:** choose player-file versus GM-map identity/version behavior, old-map migration defaults, handling of player files in the normal import flow, and privacy-aware shared-field conflicts. No decisions approved yet.

## Candidate initial scope

Confirmed delivery: a self-contained snapshot URL and a player JSON fallback, a read-only player reader, GM player preview and safe SVG/PNG of the current map. Four disclosure modes, separate public text/GM notes, configurable Fields with per-object masks, and private legacy initialization are accepted. New locations start Known type, new Fields private and new routes unshared. One saved GM workspace coexists with multiple isolated player consultations; an editable GM workspace library is excluded. Full GM backup/transfer remains separate and complete. The remaining decisions concern audience profiles, compatibility and final verification/edge-case review; every artifact must include only the information authorized by its entity/Field disclosure and relationship rules.

No accounts, hosting, live synchronization, revocation service, individualized player knowledge, session journal, factions/NPCs/missions, automatic exploration, Markdown embedding, or full campaign management are included unless requested. Static file autonomy and interactive offline autonomy must be named separately.

## Candidate model boundary after examining existing contracts

Do not finalize a schema before the decisions above. A bounded candidate has three responsibilities:

1. Durable publication/discovery intent belongs with authoritative map data, written through the existing mutation/persistence/history path. Pinia retains its transient UI role. Publication changes should be undoable if ordinary edits are undoable; exact history behavior needs acceptance.
2. One pure projection takes a committed GM snapshot and explicit audience/publication policy, constructs an allowlisted player document, resolves permitted relationships, and retains only necessary layout/field definitions. It never mutates or destroys the original. Effective geometry may need to be materialized before filtering because missing angles/radii depend on sibling order and host structure.
3. A player reader and all player image renderers consume that projected document. Export bounds, labels, counts and accessibility text come from the projection. Do not deep-clone a full GM renderer and merely hide secret elements. Reusing the rasterization/style utilities can remain viable after supplying a safe scene.

This is a recommended seam, not an approved implementation design. The user must confirm its observable behavior before `to-spec` synthesis.

## Compatibility decisions to expose explicitly

Recommended package for final scope review (not yet approved): distinguish the player document/URL codec from the full GM backup format; continue accepting existing full-map v1 files with the agreed private migration defaults; introduce an explicit newer full-backup version if needed to retain publication metadata reliably instead of depending on unknown-property tolerance in older readers. Older readers should reject unsupported newer formats clearly rather than silently discard privacy intent. Keep full GM backup/recovery complete, and open a player JSON in the dedicated reader rather than treating it as an import that appends to the local GM workspace. Import of full backups must preserve Field visibility intent or present a conflict when same-name definitions disagree. These are compatibility recommendations, not new product authorization.

Recommended reader/projection verification seam for final review: one pure disclosure projection consumes committed authoritative data and outputs only a versioned player document; both compressed URLs and fallback JSON decode into the same validated document; any player preview/image path consumes that same projection. Check actual serialized artifacts and visible output, not only disabled UI controls. The existing source save/history owners are not replaced. No prototype or browser implementation has been created.

- Existing JSON is a full backup: `tests/workspace-data.spec.ts:680` deliberately expects a secret custom value to survive. Preserve this purpose when adding a distinct player action.
- Current v1 editor import requires descriptions, valid graph references and at least one system. A player-only document can have different requirements, but must be recognizable and validated before the editor import path accepts it.
- Unknown-field tolerance is not reliable privacy support in older clients: spreads preserve some data while reconstructed routes and field merges can drop new metadata. Decide supported reader versions and unsupported-version errors.
- Do not relabel incompatible output as existing version 1. A separate player format discriminator/version is the recommended candidate; a compatible editable sanitized map is an alternative with different reader/import consequences.
- Preserve existing legacy Jump level, Orbit geometry and applicability migrations. Define new privacy defaults explicitly for full import, restore, recovery and duplication.
- When same-name shared field definitions have different publication policies, merging type/options alone is insufficient. Require a deliberate rule or review conflict.

## Candidate acceptance criteria

The source criteria remain authoritative; these make them testable once decisions are settled.

1. The GM can identify and change each agreed discovery/privacy state through clear, consistent desktop and compact UI; reload preserves accepted changes and full-source data remains available.
2. Marked undiscovered/GM-only content is absent from player JSON and complete SVG source, including attributes, definitions/options, layout keys, embedded data and unexpected source properties.
3. Notes excluded by the agreed policy cannot be recovered from a player file, player history, viewer recovery UI or re-export. GM backups/history remain separate.
4. Route endpoints, Orbit hosts, Station links, child placement and field definitions in the player document follow the agreed relationship policy without dangling references, hidden-object counts or automatic secret destination labels.
5. The author preview, player JSON viewer and SVG/PNG represent the same published information. Bounds/counts/accessibility labels use published data; applied geometry remains stable where promised.
6. A recipient can open the selected player format in a fresh context without a GM workspace. Navigation/inspection/downloads behave as agreed, and unsupported/malformed versions fail clearly.
7. Full GM export/import, legacy map restore, independent-copy import, history, backup/recovery and save-failure behavior retain their established contracts.
8. Existing-content defaults, all-hidden output, permitted labels/filenames, and field publication behavior are documented rather than inferred.

## Risks, dependencies and verification

- **Primary risk:** visual filtering mistaken for data removal. Test complete serialized artifacts with unique secret markers in prose, hidden names, routes, keys, field names/options, inaccessible assignments, layout and unknown properties.
- **Graph risk:** filtering changes references, Orbit order and effective sibling geometry. Test hidden system, hidden route endpoint, hidden host with visible child, nested Orbits, hidden Station association, unresolved exits and all-hidden maps against the chosen policy.
- **Compatibility risk:** legacy defaults or definition merging broaden publication. Cover full-source round trips, restore/recovery defaults and conflicting shared fields. The current local storage has no domain schema version; IndexedDB version 1 is not a privacy schema contract.
- **UI/state risk:** preview, held gestures, modified drafts, asynchronous preflight or stale selections contaminate export. Reuse current applied-state/preflight guarantees and ensure preview does not change the original or history.
- **Future surfaces:** [#8 display filters](https://github.com/Submoon/ttrpg-cluster-control/issues/8), [#11 annotations](https://github.com/Submoon/ttrpg-cluster-control/issues/11), and [#22 note links](https://github.com/Submoon/ttrpg-cluster-control/issues/22) must respect the publication boundary when implemented. None is an established blocker. Parent [#3 interface revamp](https://github.com/Submoon/ttrpg-cluster-control/issues/3) is closed. A complete campaign manager is not a dependency.
- **Tests at the highest useful seam:** pure projection/reader tests for source immutability, allowlisting, reference validity and known secret-marker absence; actual downloaded JSON/SVG inspection and PNG pixel checks; a fresh-context viewer journey; desktop/compact publication controls and guarded export. Confirm these seams with the user before specification.
- **Existing test anchors:** `tests/workspace-data.spec.ts`, `tests/workspace-field-types.spec.ts`, `tests/workspace-reviewed-imports.spec.ts`, `tests/workspace-image-exports.spec.ts`, `tests/workspace-image-export-preflight.spec.ts`, `tests/workspace-recovery.spec.ts`, `tests/workspace-history-coordinator.spec.ts`, `tests/workspace-history-retention-ui.spec.ts`. Download helpers in `tests/helpers.ts` expose actual Blobs and PNG source SVG.
- **Later implementation route:** Sensitive under project-development because privacy, portable formats and persistence are involved: architect before implementation, developer, then independent reviewer plus complementary deep review. Current analysis does not authorize that implementation.

## Evidence collected in this session

- Closing synthesis: [Player view and secret-free sharing](spec.md), with all confirmed decisions, acceptance criteria, architecture/testing recommendations, risks, dependencies and exclusions. The user approved the final integrated shared-understanding and verification review on 2026-10-29, with no product implementation authorized.
- Source issue #9 was rechecked after the closing decisions: still open, same body/labels, no comments, last updated 2026-10-09T14:46:17Z. Final origin fetch still shows HEAD/main/origin/main at `8d4b66504ca6723db5405ed7cb93d0a666264c9a` and 0 ahead / 0 behind.

- Successful origin fetch and revision comparison; source issue, comments, labels/state, parent issue, relevant adjacent issue bodies and open issue inventory read with `gh`.
- Read-only source/document inspection, including two bounded factual explorations of export and data/history contracts under the interview workflow.
- No application tests, browser journeys or build run: no source behavior changed. This document is local analysis; it is not evidence that player-safe export currently works.
- User follow-up requests and answers are recorded above. Q3, Q6–Q24 and closing-round decisions are consolidated in the approved specification; earlier alternatives are superseded where indicated. Q22 resolves the earlier Q4 ambiguity. No product-choice questions remain open. No remote writes made.
- Follow-up origin fetch confirmed HEAD and origin/main still at `8d4b66504ca6723db5405ed7cb93d0a666264c9a` (0 ahead / 0 behind). Read the current route/configuration and singleton storage/state contracts, verified fragment/compression behavior against primary web documentation, and measured one existing fixture in memory. No product code or dependencies changed.

## Resolution

The local scoping analysis is complete. The user validated the consolidated product scope and verification plan through the integrated final question on 2026-10-29. The approved specification is the handoff for future authorized design/implementation. This closes the analysis only: GitHub #9 remains open and its product acceptance criteria have not yet been implemented or verified. No implementation tickets, commits, push, PR, merge or GitHub edits were made.

## Specification Publication

On 2026-10-29 the user explicitly invoked `to-spec` after approving the scope. The existing [specification](spec.md) was aligned to that skill's template, expanded to 34 user stories covering the agreed behaviors, and published to the repository's local planning tracker with `triage_labels: [enhancement, ready-for-agent]`. Lifecycle remains `open`; scope review remains approved. The previously approved projection/testing seam was reused without another interview. Origin/main and the source issue were rechecked and unchanged. This publication does not start product implementation or modify the GitHub request.

## Ticket Publication

On 2026-10-29 the user invoked `to-tickets` and approved seven vertical slices with the proposed blocking edges through the integrated question mechanism. Seven separate tickets are published under the effort's existing local-tracker convention and indexed in the [approved specification](spec.md). Direct blockers are: 01 none; 02 after 01; 03 after 02; 04 after 02; 05 after 03 and 04; 06 after 05; 07 after 04. The initial frontier is 01 only, once implementation is authorized. Tickets are open, unclaimed, typed implementation and locally triaged enhancement/ready-for-agent.

Each ticket embeds its relevant end-to-end behavior, acceptance criteria, verification scope, source reference, actual baseline and parent/blocker links. No product source was edited, no ticket was claimed, and the GitHub parent remains unchanged. Origin fetch and GitHub reread at ticket publication confirmed the same baseline and source requirements.

Publication checks passed: seven separate files, 57 acceptance criteria, required metadata, valid local links/index entries, exact approved direct blockers, acyclic graph, initial frontier 01 only, and no specific implementation-file paths in ticket bodies. Only local planning documents changed; application tests/builds were not run.
