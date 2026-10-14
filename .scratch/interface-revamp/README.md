# Interface revamp planning snapshot

Published on `codex/interface-revamp` with the user's authorization on 2026-10-14.

Start with [the Wayfinder map](map.md). Decisions, reports, measurement scripts, source archives, browser traces and screenshots are retained here. All project documentation is in English.

## Source and runnable prototype

The product baseline is `629d2a98715c3a16b954e0f77c639b1f0c31212c`, freshly fetched from `origin/main` before publication. This branch deliberately includes the three disposable prototype captures, ending at accepted B commit `7ea41e0a9b0e585e23812eb9165e95420d72dc89`, followed by the planning snapshot. The prototype source is at the repository root; see [run instructions and limitations](../../README-PROTOTYPE.md). From a fresh clone of this branch, run `npm ci`, then `npm run prototype`, and open `http://127.0.0.1:3113/?variant=B`.

The prototype remains a design study with simulated persistence and documented gaps. Publishing it does not confirm Nuxt UI adoption, complete the product revamp or authorize merging this branch into main.

## Local runtime directories

The original `prototype-worktree/`, isolated measurement source directories, dependency installations and build outputs are machine-local and excluded from this snapshot. Their historical paths in traces describe the executed environment. The source commits and measurement tarballs preserve the inputs; [measurement reproduction instructions](measurement-lab/artifacts/measurement-facts.md) describe rebuilding the isolated laboratory, including the three-value fixture adaptation and the separate unchanged output used for offline probes. Recreate runtime directories before rerunning those commands.

## Next investigation

[Validate the selected B direction on representative devices and preservation flows](tickets/10-validate-b-device-preservation.md) is the next Wayfinder frontier. The final Nuxt UI decision remains conditional on evidence and a live human decision.
