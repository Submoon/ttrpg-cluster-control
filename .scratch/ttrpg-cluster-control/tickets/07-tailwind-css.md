---
title: 07. Adopting Tailwind CSS for the Nuxt interface
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
triage_labels:
  - enhancement
  - ready-for-agent
parent: "[TTRPG Cluster Control - V1 Specification](../map.md)"
---

# 07. Adopting Tailwind CSS for the Nuxt interface

## What to build

As a Warden, I want the Nuxt interface to use Tailwind CSS as its styling foundation, so that the remaining map-editor features can share consistent responsive styling. Configure Tailwind for Nuxt and migrate the existing workspace screen without changing its behavior or visual direction.

## Acceptance criteria

- Tailwind CSS is installed and configured for Nuxt pages and Vue single-file components.
- The workspace creation/restoration screen uses Tailwind utilities for layout, spacing, responsive behavior, and focus states; retain custom CSS only for bespoke visual details that utilities do not express clearly.
- The existing screen's content, dark visual direction, accessibility, and IndexedDB behavior remain unchanged.
- No component library or separate design-system package is added.
- `npm run typecheck` and `npm run build` pass.

## Blocked by

- [06. Building a star-system map with nested Orbits](06-star-system-map.md)

## Source specs

- [TTRPG Cluster Control - V1 Specification](../spec.md)
- [06. Building a star-system map with nested Orbits](06-star-system-map.md)
- [04. Choosing the V1 application and rendering architecture](04-application-architecture.md)

## Resolution

- Configured Tailwind CSS 4.3.3 with the Vite plugin for Nuxt. Tailwind utilities now handle the workspace's layout, spacing, responsive behavior, and focus states; custom CSS retains the existing visual details and D3 map styling.
- Validation passed: `npm run typecheck`, `npm test`, and `npm run build`.
