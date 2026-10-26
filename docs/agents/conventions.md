# Source conventions

These are project source conventions; framework docs describe capabilities, not folder rules. For interaction guarantees, use [the UI guide](ui.md). For state ownership and dependency direction, use [the editor architecture reference](../architecture/editor.md).

## Files and interfaces

Give each source file one cohesive responsibility. Split independently changing behavior when that gives consumers a smaller interface; keep related steps together when callers would otherwise coordinate the same details across files. Prefer a focused command such as `openSystem(systemId)` over asking callers to assemble selection, guards, and map context. Keep flat returns and option bags focused on each consumer's needs.

Use composables for Vue reactivity, lifecycle ownership, or effect cleanup; use plain functions for deterministic calculations over supplied values. A composable that creates subscriptions owns their setup and cleanup. See Vue's [composables guide](https://vuejs.org/guide/reusability/composables.html).

Architecture reviews assess responsibilities, dependency direction, state ownership, public interfaces and framework practices. Behavior defects can support that assessment but do not replace it.

## Ownership, drafts, and comments

Types express shape; focused interfaces and meaningful TSDoc express ownership. Document non-obvious mutation rights, state lifetime, async ordering, cancellation, errors, and whether success means an in-memory application or durable save. For example, `applyWorkspace` publishes a validated snapshot before its IndexedDB acknowledgement settles. Avoid restating parameter types or adding comments to satisfy a quota.

Use typed Vue props and emits. In Vue 3.5, destructured `defineProps` values remain reactive, so avoid copying a prop into a local ref unless the component intentionally needs a snapshot. Direct nested mutation is supported when a parent deliberately shares an editable draft; route related-field changes and committed workspace changes through their owning editor command and writer. Vue documents the distinction in [props](https://vuejs.org/guide/components/props.html#mutating-object-array-props).

## Framework and type practices

Preserve Nuxt's SSR-safe state model. Use Nuxt state or Pinia for shared reactive state and hydration; keep Pinia within the editor UI boundary in [the architecture reference](../architecture/editor.md). Keep browser effects in client lifecycle ownership. See Nuxt's [TypeScript guidance](https://nuxt.com/docs/guide/concepts/typescript).

Keep the configured TypeScript checks meaningful. Treat external data as `unknown` until it is validated and narrowed; do not silence uncertain data with a cast. See [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html). Prefer Nuxt UI components and supported props or slots. A custom control or layout should have a clear editor need and follow the exception guidance in [the UI guide](ui.md).

Five hundred nonblank, non-comment-only lines in a Vue component is a review trigger for responsibility and interface size, not a framework maximum. Keep a coherent component when a split would only add forwarding files, and explain a substantial exception. No numeric limit is established for other file types. Keep the existing lint warning policy; do not add warnings or a new lint gate as a substitute for design review.
