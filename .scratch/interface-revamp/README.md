# Interface revamp planning snapshot

Published on `codex/interface-revamp` with the user's authorization on 2026-10-14.

Start with [the Wayfinder map](map.md). Decisions, reports, measurement scripts, source archives, browser traces and screenshots are retained here. All project documentation is in English.

## Source and runnable prototype

The product baseline is `629d2a98715c3a16b954e0f77c639b1f0c31212c`, freshly fetched from `origin/main` before publication. This branch deliberately includes the three disposable prototype captures, ending at accepted B commit `7ea41e0a9b0e585e23812eb9165e95420d72dc89`, followed by the planning snapshot. The prototype source is at the repository root; see [run instructions and limitations](../../README-PROTOTYPE.md). From a fresh clone of this branch, run `npm ci`, then `npm run prototype`, and open `http://127.0.0.1:3113/?variant=B`.

The prototype remains a design study with simulated persistence and documented gaps. Publishing it does not confirm Nuxt UI adoption, complete the product revamp or authorize merging this branch into main.

## Local runtime directories

The original `prototype-worktree/`, isolated measurement source directories, dependency installations and build outputs are machine-local and excluded from this snapshot. Their historical paths in traces describe the executed environment. The source commits and measurement tarballs preserve the inputs; [measurement reproduction instructions](measurement-lab/artifacts/measurement-facts.md) describe rebuilding the isolated laboratory, including the three-value fixture adaptation and the separate unchanged output used for offline probes. Recreate runtime directories before rerunning those commands.

## Current decision and later route

The [focused B control-presentation prototype](research/b-controls-prototype-2026-10-15.md) supplies two runnable candidates, source hashes and bounded checks: production build/typecheck pass, 9 emulated-browser cases, and menu action hit tests. The human subsequently selected Dock. The [targeted Orbit placement and anchored creation controls](research/dock-feedback-2026-10-15.md) report records the resulting corrections, independent review and local browser evidence. Earlier production checks and the final development-server layering checks have separate source identities. Physical-phone acceptance remains pending.

[Finalize the tools contract after the Astra interface review](tickets/11-finalize-tools-contract.md) is closed on 2026-10-15 through the human's explicit answers. Its Resolution adds Select and right-drag pan, makes Add persistent with same-type repetition and on-demand Inspect, and retains a chosen route origin during view pan. Its dated baseline was checked by a fresh origin fetch again before closure; the accepted B direction is retained. The complete [Astra review](research/astra-interface-review-2026-10-15.md), its brief and preservation evidence remain the inputs, not automatic design acceptance.

[Decide readable control grouping and accessible operation labels within B](tickets/12-decide-controls-presentation.md) remains claimed and in progress. The human selected Dock after comparing the two published B candidates. Luna XHIGH implements the bounded corrections under the closed tools contract, with SOL analysis and independent review. Dock is the confirmed direction; the refined presentation awaits human feedback. Separate unanswered follow-ups are [Decide the mobile Fields list-to-editor flow](tickets/13-decide-mobile-fields-flow.md) and [Decide inspector form density and domain-facing display labels](tickets/14-decide-inspector-form-refinements.md). [Test the resolved tools contract in a focused B prototype iteration](tickets/15-prototype-resolved-tools-contract.md) remains blocked for final validation until the presentation ticket is resolved. No final adoption or physical acceptance follows from the Dock preference.

[Validate the selected B direction on representative devices and preservation flows](tickets/10-validate-b-device-preservation.md) remains in progress. Final Nuxt UI adoption remains blocked on evidence and its later live human decision. Once the relevant decisions and essential evidence make the route clear, continue with to-spec, then to-tickets in later sessions. No product implementation, merge or GitHub comment follows from this planning checkpoint.
