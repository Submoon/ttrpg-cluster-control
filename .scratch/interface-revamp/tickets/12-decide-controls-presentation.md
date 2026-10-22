---
title: Decide readable control grouping and accessible operation labels within B
status: closed
assignee: codex-wayfinder-controls-presentation
label: wayfinder:prototype
type: prototype
mode: HITL
parent: ../spec.md
---

## Resolution

On 2026-10-16 the accepted composition was a Dock with distinct Navigate / Select / Move and Add, optional Hierarchy, Inspect and Map files. Desktop panels coexist with the map; mobile Inspect and Hierarchy are fullscreen and exclusive, hiding dock/zoom controls.

When Add is active on a compact screen, reuse the context banner for type, next target/progress and Quit Add while preserving context and Back. Make controls and Orbit operations readable and named without relying on hover or color. Right-button drag pans; stationary right-click retains native browser behavior. Nuxt UI remains the default implementation library. This resolves composition, not physical-device, full-product or accessibility acceptance.
