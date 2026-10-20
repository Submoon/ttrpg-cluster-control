# Ticket 22 final QA gate

Runtime gate completed on 20 October 2026. The coordinator accepted the selected presentation PNGs. No application or canonical-test edits were made by this QA finisher. Git, issue closure and successor release remain coordinator responsibilities.

## Candidate and runtime

Intentional feature baseline: `2a4564d7ef5916df0cc4e025e7997ca7c86f81f7`; fetched `origin/main`: `629d2a98715c3a16b954e0f77c639b1f0c31212c` (0 main-only / 43 feature-only commits). Final candidate is `ticket22-final-candidate-6`, with 35 application/test/fixture paths. Its 21 application inputs equal candidate 4, whose sole production build exited 0. Candidates 5 and 6 contain only reviewed test adaptations after that build. Final Fit and recovery runs each verify all 35 hashes before and after execution.

The retained compiled entry was `.output/server/index.mjs`, SHA-256 `2441DA8E168741B5BF16B27CE66E7056D6499DB6CA6A69C2FF150106D377DCA1`. The resumed compiled listener was owned PID 22980 on `http://127.0.0.1:3180`. After stopping it, the identified `npm run dev -- --host 127.0.0.1 --port 3100` tree had launch PID 28876. Initial dev bundling took 2m29s; no recovery test ran against the startup page. Both verified owned servers were stopped; ports 3100 and 3180 had zero listeners at `2026-10-20T09:52:06.7469477+02:00`.

## Exact execution attribution

| Attempt | Runtime / candidate | Passed | Failed | Executed | Duration |
| --- | --- | ---: | ---: | ---: | ---: |
| Sole complete suite | Compiled / 4 | 104 | 5 | 109 | 512473.264 ms |
| Four corrected titles | Compiled / 5 | 3 | 1 | 4 | 35198.917 ms |
| Final affected Fit title | Compiled / 6 | 1 | 0 | 1 | 8562.566 ms |
| Unchanged IndexedDB recovery title | Development / 6 | 1 | 0 | 1 | 19844.794 ms |

All these invocations used retries 0, maxFailures 0 and unchanged canonical timeouts; none skipped or produced flaky results. The sole complete suite used two isolated-context workers; focused attempts used one. There was no second complete suite or production build. This is **not a 109/109 single-pass result**: 108 distinct cases have compiled passing evidence across the stated candidates, and the remaining unchanged recovery case has development passing evidence. Final typecheck exited 0.

The five original complete-suite failures and their resolutions are preserved:

- Palette keyboard add: reacquire its public Add Planet control after Chart details closes the palette; candidate 5 passes.
- Fit/recovery journey: migrate the old exact Save action to Apply. Candidate 5 then exposes an obsolete workspace-feedback assertion while the compact entity dialog owns that feedback. Candidate 6 scopes the same saved acknowledgement to the active Inspector and passes the complete journey, including the later geometry/recovery/draft assertions.
- Theme/save status: scope the existing status assertion to active workspace feedback; candidate 5 passes.
- Delete safety while editing: select all Name text before Delete, assert the resulting empty draft and existing entity before Discard; candidate 5 passes.
- Existing IndexedDB snapshot recovery: unchanged Vite `/_nuxt/@fs/` module import cannot resolve in production. Its unchanged development-only case passes on dev. No production test API, skip or harness was introduced.

The previously slow Orbit round-trip passes in the complete compiled run in **28548 ms**, within its original 30000 ms deadline. Earlier checkpoints remain separate: candidate 2 selected files 22/6; candidate 3 bounded run 5/3; candidate 3 compact presentation 16/16 checks; candidate 4 scoped run 2/2 in 41285.990 ms with typecheck 0. Accepted initial object RED was 0/1; subsequent failed attempts remain retained in host TEMP and the ledger.

## Presentation evidence

Eight unmodified positive PNGs are selected in [the manifest](evidence/presentation-manifest.json): actual persisted `/` and `/?variant=B&controls=dock&inspectorSample=dense`, paired at 1440×900 light object, 1440×900 dark Orbit, 390×844 dark object and 844×390 light Orbit.

The original compiled capture retained five positive PNGs, 28 passed checks, one prototype setup failure and zero page errors. Its compact B panel was collapsed. The QA adapter now conditionally opens its public Inspect panel after hydration. Only the three remaining arms were executed afterward: 13/13 checks, zero page errors, 35/35 unchanged source hashes. No complete eight-arm recapture occurred. Both attempts, actual fixture IDs, validated import/export hashes, source identities and geometry/contrast observations are preserved in [presentation observations](evidence/presentation-observations.json).

Root uses a separately constructed authoritative-domain-validated fixture, imported through public controls and verified through actual standalone-system downloads. Description and Session note differ; zero/false and distinct catalogue values are present. B uses its actual memory-only dense object sample, “Aster, Keeper of the Quiet Meridian and Outer Beacon.” Both Orbit comparisons therefore use B's object form as a structural reference, not a matching domain form or entity.

The coordinator visually accepted the body/section/footer composition and compact fullscreen behavior. The product's Chart details control and durable-save/review footer consume more vertical space than memory-only B. At 844×390, the root body is 111 px high and contains a complete 91.3125 px numeric field row; ordinary footer hit and natural visible keyboard focus pass. The earlier 390×500 supplement provides a 179 px body for a complete 63.3125 px row and retains invalid draft/error/control identity after Hide/Resume. Desktop and compact ordinary hits, body scrolling, error-to-control focus and relevant dropdown behavior pass. Sampled error/status contrast minima exceed 4.5:1 (short light: 6.388/6.110; compact dark checkpoint: 7.490/7.174). Contrast measurement temporarily suppresses foreground paint and restores it; selected PNGs are unmodified.

Physical Android Chrome, actual OS keyboard opening/closing, device safe areas and physical gestures remain unavailable. Browser viewport/touch emulation supplies no physical-device certification.

## Evidence and limitations

[Normalized complete results](evidence/compiled-full-normalized.json), [original five-failure packet](evidence/compiled-full-five-failures.json), [candidate 5 focused results](evidence/candidate5-compiled-focused-normalized.json), [final compiled Fit results](evidence/candidate6-compiled-fit-normalized.json), [unchanged dev recovery results](evidence/candidate6-dev-recovery-normalized.json), [final source identity](evidence/final-candidate-identity.json), and [runtime identities](evidence/runtime-identities.json) are curated here. [The evidence manifest](evidence/evidence-manifest.json) records hashes and host provenance. Original stdout/stderr, raw JSON, failed screenshots/traces and historical attempts remain in literal host TEMP `C:/Users/fbal-fontaine/AppData/Local/Temp/ticket22-*`; no raw source trees, large traces or patch dumps are copied into the repository.

Candidate 5's preflight and completed capture postflight bracket the four-title attempt with 35 matching hashes. A delayed extra hash capture after the reviewed candidate 6 assertion landed records that expected single test delta; it is not used as candidate 5 runtime identity evidence. No unresolved product blocker remains from these executed gates; the runtime and device boundaries above remain explicit.
