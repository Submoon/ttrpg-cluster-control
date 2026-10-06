---
title: 26. Refining sidebar collapse animation and labels
label: wayfinder:implement
type: implement
status: open
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 26. Refining sidebar collapse animation and labels

## What to build

As a Warden, I can follow a clear collapse sequence for the hierarchy and inspector sidebars, so that they leave the map more room without making their controls hard to identify.

## Acceptance criteria

- Collapsing either sidebar follows three visibly ordered phases: its panel text and contents disappear quickly; the sidebar then shrinks and moves toward its edge; after it reaches the existing collapsed size and position, its title label quickly appears.
- The final collapsed handle keeps the current dimensions and edge placement; collapsing does not abruptly jump, obscure the map or navigation controls, or leave the viewport.
- The collapsed title (`Hierarchy` or `Inspector`) is displayed vertically as upright letters, one character per line, rather than rotated sideways text. The reopen control retains a clear accessible name and keyboard focus state.
- The same behavior works for both sidebars in the Jump Cluster and system-map views and remains legible and usable on narrow screens.
- Reopening a sidebar remains functional, restores its content and preserves existing responsive behavior, including the rule that opening one panel closes the other when space is limited.
- Reduced-motion preferences are respected without changing the final layout or hiding the reopen controls.
- Browser verification covers the ordered collapse phases, final handle geometry, accessible controls, and narrow-viewport behavior for both sidebars.

## Blocked by

- None.

## Source specs

- [Mothership Campaign App - V1 Specification](../map.md)
- [16. Making the workspace darker and more map-first](16-map-first-visual-refresh.md)
- [10. Navigating and arranging both map views](10-map-navigation.md)
