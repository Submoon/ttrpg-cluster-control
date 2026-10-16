# Interface revamp planning snapshot

Published on `codex/interface-revamp` with the user's authorization on 2026-10-14.

Start with [the Wayfinder map](map.md). Decisions, reports, measurement scripts, source archives, browser traces and screenshots are retained here. All project documentation is in English.

## Source and runnable prototype

The product baseline is `629d2a98715c3a16b954e0f77c639b1f0c31212c`, freshly fetched from `origin/main` before publication. This branch deliberately includes the three disposable prototype captures, ending at accepted B commit `7ea41e0a9b0e585e23812eb9165e95420d72dc89`, followed by the planning snapshot. The prototype source is at the repository root; see [run instructions and limitations](../../README-PROTOTYPE.md). From a fresh clone of this branch, run `npm ci`, then `npm run prototype`, and open `http://127.0.0.1:3113/?variant=B`.

The prototype remains a design study with simulated persistence and documented gaps. Publishing it does not confirm Nuxt UI adoption, complete the product revamp or authorize merging this branch into main.

## Local runtime directories

The original `prototype-worktree/`, isolated measurement source directories, dependency installations and build outputs are machine-local and excluded from this snapshot. Their historical paths in traces describe the executed environment. The source commits and measurement tarballs preserve the inputs; [measurement reproduction instructions](measurement-lab/artifacts/measurement-facts.md) describe rebuilding the isolated laboratory, including the three-value fixture adaptation and the separate unchanged output used for offline probes. Recreate runtime directories before rerunning those commands.

## Current decision and later route

The [focused B control-presentation prototype](research/b-controls-prototype-2026-10-15.md) supplies two runnable candidates, source hashes and bounded checks: production build/typecheck pass, 9 emulated-browser cases, and menu action hit tests. The human selected Dock and subsequently reports trying the refined preview on their phone. The [targeted Orbit placement and anchored creation controls](research/dock-feedback-2026-10-15.md) report records corrections, review, local checks and the human's conclusion: mobile Add status should reuse existing context/banner space, with the exact placement delegated to the coordinator. This direction is recorded for a later refinement; a complete physical-phone acceptance matrix remains pending.

[Finalize the tools contract after the Astra interface review](tickets/11-finalize-tools-contract.md) is closed on 2026-10-15 through the human's explicit answers. Its Resolution adds Select and right-drag pan, makes Add persistent with same-type repetition and on-demand Inspect, and retains a chosen route origin during view pan. Its dated baseline was checked by a fresh origin fetch again before closure; the accepted B direction is retained. The complete [Astra review](research/astra-interface-review-2026-10-15.md), its brief and preservation evidence remain the inputs, not automatic design acceptance.

[Decide the mobile Fields list-to-editor flow](tickets/13-decide-mobile-fields-flow.md) is closed after SOL 6.1 High analysis and the human's final confirmation on 2026-10-15. [Validate the mobile Fields flow in the B prototype](tickets/16-prototype-mobile-fields-flow.md) is closed on 2026-10-16 after the human accepts the corrected artifact, with Bottom commands. Its Resolution and [report](research/fields-prototype-2026-10-15.md) preserve actual evidence and separate outstanding device checks. [Decide inspector form density and domain-facing display labels](tickets/14-decide-inspector-form-refinements.md) is also closed after the human confirms both rounds: visible responsive sections, persistent bottom actions/feedback, Description and separated Delete. [Validate the responsive inspector form in the B prototype](tickets/17-prototype-inspector-form.md) is prepared, open and unclaimed; its creation does not start code work. The existing [controls presentation](tickets/12-decide-controls-presentation.md) retains the selected Dock and phone-feedback conclusion, while [focused tools validation](tickets/15-prototype-resolved-tools-contract.md) retains its dependency. Code belongs to Luna XHIGH under SOL analysis/review; accepting Fields or resolving inspector layout does not establish final library adoption or complete physical acceptance.

[Validate the selected B direction on representative devices and preservation flows](tickets/10-validate-b-device-preservation.md) remains in progress. Final Nuxt UI adoption remains blocked on evidence and its later live human decision. Once the relevant decisions and essential evidence make the route clear, continue with to-spec, then to-tickets in later sessions. No product implementation, merge or GitHub comment follows from this planning checkpoint.
