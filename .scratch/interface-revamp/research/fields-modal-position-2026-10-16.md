# Fields modal placement and human feedback

## Baseline and scope

Fresh `origin` fetch on 2026-10-16 confirms feature baseline `9d7de58e347169fa9744dfefe502d77d83769935`, intentionally 0 main-only / 14 feature-only versus `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Source issue 3 remains open with unchanged requirements and no comments. Work stays on `codex/interface-revamp` and draft PR 28.

The human's production screenshot at 1137×1244 shows the Fields modal clipped at the top-left. The previous 26-case development-server matrix did not establish production CSS placement; successful deployment alone was insufficient to verify it.

After phone testing, the human selects **Bottom commands**, for consistency with other screens, and identifies duplicate custom-field creation controls. Preserve that choice without reopening the list/detail/Edit flow or changing domain, persistence, draft or impact-review contracts.

## Acceptance and workflow

- Reproduce the actual off-screen modal using a local production build and a deterministic geometry assertion before applying a correction.
- Desktop: bounded, centered modal fully within the viewport, including the reported 1137×1244 size.
- Compact: fullscreen modal, usable scrolling and reachable actions; check portrait and short landscape.
- Bottom actions by default; an explicit Header query may remain diagnostic.
- One visible, reachable creation command per relevant screen, with retained draft guards.
- Keep field definitions, creation/edit drafts, focus return and baseline application behavior unchanged.
- Standard route: Luna XHIGH implementation and local production browser evidence, then independent SOL 6.1 High review of the frozen correction. Coordinator owns planning and Git/publication.

## Reported production geometry

The coordinator inspected the already-open human browser tab read-only, without navigation or changing its draft. At 1137×1244, the actual `Field definitions` dialog bounds are x=-519.5, y=-73.703125, width=1088, height=695.703125, right=568.5, bottom=622. Its computed styles combine `position: fixed`, `left: 568.5px`, `top: 622px`, `transform: matrix(1, 0, 0, 1, -544, -347.852)` and `translate: -50% -50%`. The dialog carries Nuxt UI's `-translate-x-1/2 -translate-y-1/2` utility classes as well as the application's class. This is direct evidence of additive translation; local production reproduction and the frozen correction still need execution.

The same existing browser then executes this read-only regression predicate: every edge must be inside the viewport and each modal center must be within 2 px of the viewport center. It returns **`pass: false`**, with the same bounds. This is the actual reported production symptom, without injected state or a reload. A separate local baseline build fails after 2m55s with Nitro `EPERM` while resolving a dependency path; no local baseline production bundle is claimed. The coordinator narrows the remaining loop: retain the actual deployed red predicate as baseline evidence, then build and run the corrected candidate locally with the corresponding geometry assertions. This avoids repeating a full baseline build after the exact failure is already measured in production.

Ranked falsifiable hypotheses: (1) legacy application `transform` adds to Tailwind's individual `translate`, so removing the redundant transform should center the unchanged envelope; (2) a modal animation contributes a remaining transform, so the offset should disappear after its completion; (3) a responsive override changes placement at this width, so nearby desktop widths should behave differently. The reported stable computed matrix prioritizes (1).

## Frozen correction and source review

Luna changes only `PrototypeFieldDefinitionsDialog.vue` and `PrototypeWorkbench.vue`: remove the desktop position/transform override, default to Footer unless Header is explicitly requested, remove the sidebar creation duplicate, and retain one creation command in each mutually exclusive list/detail action context. The surviving creation commands keep the pending-review/pending-command guard and call the existing transition logic.

Frozen SHA-256 values:

- Dialog: `17F34EA3F2B9D4020A8C0BAE5690B7564F9091D3C69F510A17C8B45E41900F4A`.
- Workbench: `0DC9F3C4D887384EEF0ECA39BB5FD2CC8954641895947454EBB794402BB03FA9`.

The coordinator verifies the actual bounded diff and hashes. Independent SOL 6.1 High source review finds no blocker: installed Nuxt UI supplies desktop fixed/50%/individual-translation placement; removing the manual transform removes double centering. The retained fullscreen resets are redundant but consistent with the component's inset-zero fullscreen variant. State, domain payloads and acknowledgement logic are unchanged. Whitespace checks pass. Production browser geometry and action reachability remain separate checks.

## Executed production checks

The corrected local production build passes (`npm run build`, exit 0; 2m15s), producing `.output/server/index.mjs`; `npm run typecheck` also passes. The dedicated server runs at `127.0.0.1:3142`. Elevated execution resolves the local build and loopback sandbox restrictions without changing dependencies or application behavior.

The [focused probe](../device-preservation-lab/modal-position-probe-2026-10-16/probe-production-modal.mjs) finishes **4/4 cases**, zero page errors and no failures. Its [raw report](../device-preservation-lab/modal-position-probe-2026-10-16/artifacts/production-modal-qa.json) records three geometry cases and one default-action/creation-flow case:

- 1137×1244: centered within 2 px and all edges inside the viewport, on the exact reported Footer route.
- 390×844 and 844×390: fullscreen at (0,0), matching viewport dimensions; list Add and detail Edit commands are visible and in bounds.
- No layout query: one footer action region, no header action region, one list creation command and one detail creation command. A modified creation draft survives Close and reopening through the normal production Fields button; Back returns to the list.

The first flow attempt incorrectly targeted the development-only “Return to Fields draft” switcher entry. Correcting the harness to use the production Fields opener passes without another application change. The coordinator independently reads the final report, checks all four assertions and empty failure list, verifies both runtime source hashes against the frozen checkout, and inspects the centered desktop and fullscreen portrait captures. These checks cover the correction; the earlier 26-case development matrix is not rerun or relabeled as production evidence.

The human's Bottom selection is recorded. The prototype ticket stays in progress for the remaining phone/keyboard feedback; this correction does not establish physical-keyboard acceptance, final Nuxt UI adoption or product completion. Publish through the existing draft PR; do not merge or close the source issue.

## Human acceptance

2026-10-16 — After publication of corrected snapshot `9c83edb1915114768cc447890db79b6e0d28e142`, the human says “OK pour ce prototype.” The [prototype decision](../tickets/16-prototype-mobile-fields-flow.md#resolution) is now closed. This supersedes the earlier pending-verdict handoff, while leaving the recorded measurement limits and separate device/preservation investigation unchanged.
