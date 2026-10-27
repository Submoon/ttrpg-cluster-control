---
title: Measure Nuxt UI integration, offline resources, and comparative performance
status: closed
assignee: SOL6.1High
label: wayfinder:task
type: task
mode: AFK
parent: ../spec.md
---

## Resolution

The 2026-10-14 production comparison used baseline `629d2a98715c3a16b954e0f77c639b1f0c31212c` and accepted B snapshot `7ea41e0a9b0e585e23812eb9165e95420d72dc89`. In five desktop observations per arm, received JavaScript was 424,152 bytes for baseline and 830,902 for B; CSS was 62,957 and 284,514 bytes. The result includes comparison scaffolding and is not isolated Nuxt UI cost or a final budget. The baseline gesture point was occluded, so no valid direct gesture comparison was available; mobile yielded only four partial observations per arm.

Cold offline probes found missing USelect glyphs and an external Iconify dependency. OS-derived/remembered theme behavior and coherent light portals were unsupported in the prototype. Targeted focus/Escape checks and a theme-switch preservation sample passed, but full accessibility, data durability and physical-device behavior were not established. These are historical prototype findings; ticket 29's dossier owns current whole-product acceptance.
