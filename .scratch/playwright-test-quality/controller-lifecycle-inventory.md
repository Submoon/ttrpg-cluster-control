# Controller lifecycle and history dispositions

Ticket 04 reviews F10 at `a00451ee5d25ede93e214a1270e6bfee65fcfd91` on 2026-11-02. The approved boundary is real controller actions with controlled dependencies and mounted owners for lifecycle claims. The observed warnings do not establish a production leak. [Implementation evidence](implementation-04-06-results.md) records verification.

| Reviewed item | Disposition | Required observable contract |
| --- | --- | --- |
| Main integration: `createOrbitCenterControllers` | Change | Mount the real placement owner. A nonnull Orbit preview must clear on unmount without manual cancellation; later input/map changes must not publish another preview. |
| Main integration: full editor composition in accepted Orbit/Object sessions and blank-route Add/history guards | Change | Mount the composition; preserve session, history and deferred-result assertions. Unmount before disposing injected history. |
| Main integration: editor owner cleanup | Change | Observe preview removal, store reset, removed subscriptions and cancelled queued work. Later identity changes must not revive disposed state. |
| Apply-preflight: `createHarness` | Change | Mount real composition and unmount before history disposal; retain deferred preflight/cancellation. |
| Mutation-transitions: existing custom renderer and late-result/new-session test | Retain/reuse | Share the already mounted owner mechanism; preserve the concrete stale-result outcome. |
| History coordinator: no-op Redo assertion | Change | Rename, acknowledge durability, Undo and establish nonempty Redo before the no-op; preserve data/history and actually Redo afterward. Retain separate deferred traversal coverage. |
| Narrow entity session, unresolved-exit placement, system creation and Inspector relationship controllers inspected in main integration and placement-inputs | Retain | Ordinary scopes remain appropriate when no component lifecycle hook is claimed. Retain real actions and explicit dependency disposal. |
| Framework-independent continuous Orbit controller and focus scheduler | Retain | Keep explicit controller disposal and controlled scheduling; distinguish it from mounted browser-resource ownership. |
| Coordinator draft guards, stale ownership/capacity, verdicts, cancellation and deferred save ordering | Retain | Preserve existing real coordinator contracts. |
| Native shortcut, gesture and responsive integration | Retain | Controller mounting does not replace browser input, focus, rendering or IndexedDB wiring. |

## Handoff to ticket 07

`tests/support/mounted-controller.ts` exports `mountController(setup)`, returning `{ value, unmount }`. It runs synchronous controller creation inside actual Vue setup and mounts with the existing non-DOM renderer. `withControlledBrowserEnvironment(run)` supplies event targets, media-query state and animation frames as controlled external dependencies; actions, watchers, history and mutations stay real. Consumers unmount their owner inside `finally` before the environment restores original global descriptors.

Observe lifecycle cleanup before manual history/reset disposal can mask it. Use scopes for narrow non-lifecycle subjects and mounted owners for component effects; do not convert every pure test or suppress warnings globally. The four changed specs passed 48 focused cases in the developer check, followed by a targeted Redo rerun after adding entry-list equality. Integrated verification is recorded in the batch report.
