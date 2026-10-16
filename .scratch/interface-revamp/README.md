# Interface revamp: decisions and specification handoff

Start with the [buildable specification](spec.md); the [closed Wayfinder map](map.md) retains the decision trail. All project documentation is in English. GitHub [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3) remains the open source request; local Markdown records decisions, specification and later implementation work.

## Current state — 2026-10-16

The human has selected **B / Dock**, accepted the mobile Fields flow and responsive Inspector prototype, and confirmed **maximum Nuxt UI component reuse with limited justified exceptions**. Existing custom prototype surfaces are not automatically approved production exceptions.

The [controls presentation Resolution](tickets/12-decide-controls-presentation.md#resolution) and [focused Tools prototype Resolution](tickets/15-prototype-resolved-tools-contract.md#resolution) now consolidate existing human choices and source-specific evidence. They do not claim physical-device or production acceptance. No further broad layout comparison is required.

The [current independent Astra review](research/astra-current-interface-review-2026-10-16.md) covers the whole interface, accumulated decisions and Tools. Its verdict is ready for specification synthesis, with required fixes: Map files/Inspector layering, compact Fields/Add chrome, keyboard action access and usable map space around overlays. The human subsequently limits supported Android browsers to Chrome; keep keyboard/landscape criteria there and retain Firefox observations only as historical evidence. The historical Fit disappearance is absent in its two current sampled systems. Full parity, persistence/recovery, themes/local icons, image exports, accessibility and performance remain mandatory implementation/acceptance work.

The authorized **to-spec** synthesis is complete. Analysis uses SOL 6.1 High; later code implementation belongs to Luna XHIGH subagents. Separate specification/test-seam subagents and independent technical/domain reviews completed the [handoff](research/specification-handoff-2026-10-16.md), with no remaining review blockers after correction. The human confirms automated desktop and mobile-emulated Playwright journeys, with targeted supported-Chrome phone checks for OS keyboard and physical gestures. The specification is locally planned and ready-for-agent. Continue with to-tickets in a subsequent step; no implementation tickets, product implementation, source issue closure or merge are included here.

## Source and runnable artifact

Fresh origin fetch before this handoff confirms intentionally different branch `codex/interface-revamp` at `52b3e7aa2946824826ec41071b0d530cc88f38ed`, matching its remote and 0 main-only / 22 feature-only against product baseline `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Source issue 3 is unchanged, open, `enhancement` / `priority:P1`, with no comments. Later planning/specification commits do not change this recorded intake snapshot.

The [existing draft PR 28](https://github.com/Submoon/ttrpg-cluster-control/pull/28) contains the disposable design study. The main route serves sample data; the saved-workspace application remains separately available. **Do not promote the sample workbench to the production editor.** Application source is unchanged since accepted Inspector commit `be8bef3e9efaea76b986480a40de6bd260e59d18`; later changes record decisions/evidence.

See [run instructions and limitations](../../README-PROTOTYPE.md). Agent iteration/testing uses local `npm run dev`; the [B Dock Vercel preview](https://ttrpg-cluster-control-git-codex-interface-revamp-submoon.vercel.app/?variant=B&controls=dock) is for the human's phone tests. Optional `inspectorSample=dense` loads long sample content. Reloading restores the seed; prototype saving/errors are simulated rather than durable saved-workspace operations.

## Evidence and limits

- [Consolidated validation dossier](research/b-consolidated-validation-2026-10-16.md): source-specific results, retained-baseline reachability and known real-device limitations.
- [Controls prototype](research/b-controls-prototype-2026-10-15.md) and [Dock refinements](research/dock-feedback-2026-10-15.md): historical candidate exploration, scoped input/placement/chooser checks and human Dock/phone feedback.
- [Fields prototype](research/fields-prototype-2026-10-15.md) and [modal correction](research/fields-modal-position-2026-10-16.md): accepted list/detail/Edit, Bottom commands, one creation entry and library centering.
- [Inspector prototype](research/inspector-prototype-2026-10-16.md): accepted form layout, independent source reviews, final bounded checks and full-control-parity omissions to restore.
- [Final Nuxt UI policy](tickets/08-confirm-nuxt-ui-adoption.md#resolution): authoritative maximum-reuse requirement.

Human device feedback names Nothing phone 4a pro, Android and Firefox, with versions and loaded SHA unspecified. Keyboard-open editing actions are hidden; Fields' landscape header is too large. Physical second-contact retest remains unanswered. Emulated viewports, synthetic touch and independent Astra inspection do not establish physical acceptance or remove these failures. The subsequent Chrome-only Android support decision does not turn those Firefox observations into Chrome test results; acceptance now targets Chrome. Preserve test/source identities rather than adding old suites into a current-head score.

## Historical runtime directories

Dependency installations, build outputs and original machine-local worktrees are excluded from the planning snapshot. Their historical trace paths describe the executed environment. Source commits and measurement archives retain inputs; [measurement reproduction](measurement-lab/artifacts/measurement-facts.md) describes the isolated laboratory. Recreate required runtime directories before rerunning a historical command. Unrelated local environment files, logs and diagnostic captures remain untouched.
