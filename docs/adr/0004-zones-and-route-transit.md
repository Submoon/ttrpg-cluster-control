---
status: accepted
date: 2026-11-25
---

# Use generic Zones and route placement instead of free inter-system placement

Local maps already support empty contents and anchors independent of stars. Generalize that one container to a Zone, created empty, so it can represent a stellar system or a place without stars. Catalogue objects live in a Zone or are placed on a Jump Route as the same entities with their hosted branches and manually updated relative position. Route objects include stationary obstacles as well as moving ships; free placement between Zones is outside this model.

This replaces the broader free-inter-system proposal discussed for issue 60. A second local-container type would duplicate an existing capability, while unrestricted free placement would add ownership and endpoint rules that the user chose not to pursue. Known route ends remain Zones with optional local Jump Points. Route placement retains the catalogue object's data and identity. The detailed specification is retained in [Zones and catalogue objects on routes](../../.scratch/inter-system-objects/spec.md).
