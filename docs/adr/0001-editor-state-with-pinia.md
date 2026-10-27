---
status: accepted
date: 2026-10-26
---

# Use Pinia for shared editor UI state

Earlier application architecture notes rejected Pinia while shared editor state and its consumers were limited. The editor now shares selection, map/tool, panel, and map-visit state across Dock, Hierarchy, Inspector, and map interactions, while composable interfaces carry substantial repeated wiring. On 2026-10-26, we accepted a focused Pinia store for that shared transient UI state.

Keep editing drafts and their guarded commands in specialized, editor-scoped controllers. Keep browser handles, unfinished confirmation promises, and gesture effects with their mounted page or operation. Keep the committed workspace and its single ordered IndexedDB queue in `useLocalWorkspace`; Pinia is not a persistence layer or a second workspace copy. A focused-composable/provider approach remains viable but would preserve the repeated shared-state transport that prompted this decision. Pinia reduces that wiring at the cost of Nuxt SSR, reset, and consumer-discipline requirements; see [the editor architecture reference](../architecture/editor.md).
