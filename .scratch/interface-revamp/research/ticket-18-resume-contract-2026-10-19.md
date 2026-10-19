# Ticket 18 resumption contract — 2026-10-19

## Authority, baseline and limits

This is the bounded implementation contract for the human-authorized resumption of local ticket 18. The corrected specification, ticket 18 and `interface-fidelity-reset-2026-10-16.md` govern it. The historical instruction to stop implementation was superseded by the current explicit resumption. No new design vote is needed.

Coordinator-supplied fetched baseline: `HEAD = origin/codex/interface-revamp = 28278d90c462fcc0542088513ebd8cf07c7eeaa4`; intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`, with 0 main-only / 33 feature-only commits. This analyst inspected source and historical evidence only; no Git/runtime/test action was performed. Preserve the six pre-existing modified tests/helpers, cluster-map, object-fields, workspace-data, workspace-ui and workspace-chart-drafts files. They are outside this implementation's ownership.

Ticket 18 owns opening, creating, loading, resuming and recovering the actual local workspace at `/`. Ticket 21 owns the full map board, bottom Dock, zoom placement, overlay panels and the dense loaded-workspace header. The rejected top Dock/fixed columns/header composition is still rejected. Finishing launch/recovery cannot establish that those map-shell defects are fixed.

## What source already implements

- `pages/index.vue` mounts the real `BaselinePage` for `/`, the baseline alias and unrecognized variants. Explicit A/B/C queries retain the experimental comparator until ticket 29. Do not redo the already completed route switch.
- `BaselinePage` supplies one `useLocalWorkspace` owner and passes state/events into `WorkspaceWelcome`. Presentation owns neither persistence nor a second copy of workspace data.
- `WorkspaceWelcome` distinguishes loading, unavailable current snapshot and ready-without-workspace. Creation retains the two required names and native validation. Error recovery exposes Try again and Restore last valid backup. Its native inputs/buttons and large editorial welcome composition remain the concrete local presentation gap against maximum practical Nuxt UI adoption.
- `useLocalWorkspace.hydrate` loads and validates before publishing the workspace. Failure clears workspace and exposes a load error. `restoreBackup` stays loading while storage commits, then publishes the restored workspace, or returns to an unavailable state with a recovery error. Successful creation is applied memory followed by ordered durable saving; it must not acquire the distinct backup-restore guarantee.
- `workspace-storage.ts` validates detached snapshots, preserves the last valid record, waits for transaction completion, and performs backup replacement atomically. The inspected source has the required durable-before-publication boundary already; this ticket needs preservation evidence, not a persistence rewrite.
- Existing `workspace-launch.spec.ts` and `workspace-recovery.spec.ts` cover actual-root creation/reload, short-landscape focus, invalid current, missing/damaged backup, aborted restoration, successful restoration/reload and transient IndexedDB opening failure. Historical passes are useful prior evidence, not current-source verification.

## B/Dock reference interpretation

Inspected `PrototypeWorkbench.vue` B source (header around lines 69–76, map board/context around 79–116, Dock around 127 onward) and the historical desktop Dock capture `device-preservation-lab/artifacts/dock-feedback-2026-10-15/after/final/dock-feedback-1440x900.png`. B has restrained framed surfaces, a compact brand/theme header, serif identity/context, small technical labels and subdued borders on a continuous background. The approved source always starts with a seeded in-memory workspace: **there is no B empty, loading or recovery screen to reproduce**.

Use this visual language for the changed launch surfaces, with the current shared application palette and Nuxt UI controls. Keep a compact brand/local-boundary/theme header and one readable setup or recovery surface; reduce oversized hero/ornament where it competes with form reachability. A desktop split intro/form may remain if restrained and demonstrably useful; its exact layout is an implementation choice, not a new acceptance rule. At compact sizes use a single readable flow. Preserve real product/local-storage wording, never demo chart numbers or simulated-save claims. No Dock or map-panel chrome belongs on an empty/error screen.

The comparator's light/dark values and its historical image are visual references, not a requirement to add another provider or duplicate prototype CSS. Use existing tokens. Do not change the loaded map header or claim an empty-state comparison is a paired map-fidelity pass.

## Bounded implementation ownership

One developer owns these files, adapting to other agents' work rather than reverting it:

| File | Permitted correction |
| --- | --- |
| `components/WorkspaceWelcome.vue` | Adopt `UInput`, `UButton` and suitable configured Nuxt UI form/status primitives, with native field/form semantics retained. Apply the restrained launch composition consistently to welcome, loading and recovery. Keep existing models/events and authoritative validation. Preserve clear errors, disabled/busy states, reachable focus and text wrapping. |
| `components/WorkspaceHeader.vue` | Optional only if the existing no-workspace header demonstrably obstructs the changed launch surface. Prefer leaving it untouched. Any correction must explicitly target **no-workspace** presentation; loaded-workspace consumers remain unaffected. Retain the theme control's accessible name. |
| `tests/workspace-launch.spec.ts` | Adapt role/label selectors only where actual approved markup changes require it. Add focused launch presentation/responsiveness assertions or screenshots that protect a changed behavior. Keep actual root and save/reload proof. |
| `tests/workspace-recovery.spec.ts` | Preserve and, only where needed, adapt existing recovery assertions to the new presentation. Keep fault injection at browser IndexedDB boundaries, with cleanup. |

`BaselinePage.vue` may receive only a narrowly justified no-workspace class/spacing adjustment if the two components cannot express the layout cleanly. Coordinate this before editing it. No need to change `pages/index.vue`, composables, storage, domain/codec, package/config files, global palette, maps, Dock or panels. Any newly discovered behavioral persistence defect must return to the coordinator for a bounded contract amendment before touching that boundary.

Use library configuration, slots and existing adapters first. Preserve native `name`, `required`, `maxlength`, label association and form submit semantics through Nuxt UI. Do not add a second form validation authority or rebuild the form around a new domain schema. Small scoped layout/focus CSS is justified; bespoke replacement controls require a recorded reason. Loading/restoration must show a busy state without available editing controls. Failure text must remain explicit and actionable; styling must not turn save failure into a success indicator. Existing event transitions already suppress recovery commands during loading; preserve that behavior.

## Sensitive boundary and failure contract

1. Keep database `ttrpg-cluster-control`, IndexedDB version 1, store `workspace`, keys `current` / `last-valid`, marker `ttrpg-cluster-control-map`, schema/version, IDs/references and supported shapes unchanged. No migration, previous-marker fallback or durable drafts.
2. No record means show creation after loading. Valid current means resume it. Invalid current or unavailable IndexedDB means show an unavailable workspace, its actual reason and recovery actions. Never substitute demo data, silently clear storage or expose partial editable data.
3. Try again repeats the existing read/validation path. It may return to creation only if the durable current record is actually absent, or resume only when valid.
4. Missing backup reports its absence. Invalid/unsupported backup reports rejection. Both preserve durable current/backup records and keep the editor unavailable.
5. A backup replacement write failure/transaction abort preserves both records and returns actionable failure. Until transaction completion there is no restored editable workspace. Successful replacement keeps backup intact, publishes only afterward and survives reload with the restored identity/content.
6. Ordinary creation/application remains memory-first followed by truthful saving/saved/error feedback and existing retry/export behavior. Do not change it to backup semantics or pretend applied memory was saved when durability fails.

## Agreed seams and bounded verification

The human already approved real-app Playwright desktop/mobile plus narrow existing model/storage checks. Do not create a new application test API, component harness, device harness or broad test rewrite.

- Capture a safe isolated retained-baseline check at `/?variant=baseline` before changed launch presentation, then verify the actual `/`. Use fresh browser contexts; never alter the human's real browser data. The alias shares current providers/styles; disclose that it is not pristine main.
- Run the existing focused launch/recovery files against the development product once changes settle. Preserve actual UI creation → durable save → reload → same named/identified workspace, current-unavailable/Try again and backup failure/success coverage. Keep the existing narrow atomic-save/storage regression; the development-only module-import storage test cannot serve as compiled-production proof.
- Add one meaningful public-UI RED/green case for a demonstrated gap (for example required-field label/error/focus behavior or unavailable-state action reachability). Demonstrate its failure before the correction where applicable. Do not assert Nuxt component names or internal implementation structure merely to manufacture a failing test.
- Run typecheck and one production build. Against the compiled app, capture actual-root welcome and recovery, assert no SSR/hydration warnings/errors, and perform one create/save/reload journey plus one restore/reload journey. Existing tests that rely on dev module paths should remain development tests; use UI/IndexedDB browser seams for compiled evidence.
- Presentation coverage: desktop 1440×900, portrait 390×844, short landscape 844×390 and reduced height 390×500, in relevant light/dark launch/recovery states. Use ordinary hit testing and keyboard traversal to demonstrate Create, Try again, Restore and theme actions are reachable, with complete visible focus and no horizontal overflow. Inputs/error text must remain usable after native validation and failed recovery. Confirm changed input/control boundaries and text meet the specification's contrast thresholds on actual backgrounds.
- Save four representative before/after image pairs for the changed welcome/recovery states, with source/runtime/route/fixture/viewport/theme/browser/input identity. Compare the changed launch header/surface to B's restrained visual language and state explicitly that the prototype has no identical launch fixture. A small paired B/root loaded-map overview can document the known ticket-21 mismatch, but must not grow ticket 18 into map-shell work or certify it.
- Physical Android Chrome keyboard/safe-area/gesture checks remain unavailable unless an actual device is used. Viewport/touch emulation is evidence for responsive layout only. Record the unavailable gate without claiming a physical pass.

Do not rerun the historical 405-observation matrix. The coordinator plans one final full-suite attempt with `maxFailures=1`; record existing map failures separately and make no broad repairs under ticket 18. Broaden other testing only for a concrete new change/failure/risk; complete B map-fidelity acceptance remains its owning ticket's responsibility.

## Handoff status

Implemented in the inspected baseline: root routing, loading/create/resume/recovery ownership and transactional durability mechanisms. Required correction: bounded Nuxt UI/launch-surface presentation and fresh scoped evidence after the acceptance reset. Not verified by this analysis: current runtime behavior, compiled hydration, current screenshots/contrast/focus or physical-device behavior. The coordinator owns ticket/plan updates and final acceptance; this document changes no ticket status.
