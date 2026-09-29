---
title: Defining the V1 map data model and object catalogue
label: wayfinder:grilling
type: grilling
status: closed
assignee: Copilot
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

## Question

Given the agreed hierarchy—Jump Clusters contain systems and routes; systems contain stars, nested orbits, and local objects; routes connect logical Jump Points—what is the smallest useful typed object catalogue and set of fields for V1?

Settle the minimum editable information for stars, planets/moons, asteroids/belts, stations/bases/colonies, vessels/derelicts, Jump Points, anomalies/nebulae/hazards, and the freely named "other" type. Distinguish objects that occupy an orbit from features that need a system-level location, and decide which fields are common versus type-specific. Keep the data sufficient for Mothership's keyed locations without turning V1 into a physics simulator.

## Resolution

### Catalogue and identity

Every catalogue object has a stable app-generated ID, a family/subtype, a user-editable key that is required and unique within its system, a name, and a description. The families are:

- `CelestialBody`: star, planet, moon
- `SmallBody/Field`: asteroid, belt
- `Installation`: station, base, colony
- `Vessel`: vessel, derelict
- `JumpPoint`
- `Phenomenon`: anomaly, nebula, hazard
- `Other`: user-supplied type label

A `JumpPoint` is a logical route endpoint and is distinct from a physical Jump Station; cluster routes reference Jump Points by stable ID.

### Location and orbit structure

Each catalogue object is either attached to an `Orbit` or directly to its system. Every object type may occupy either location and may host its own Orbits, including a star orbiting another star. A system-level object has a manually editable schematic X/Y position; the app supplies its initial position. These positions are not astronomical coordinates.

An `Orbit` is an unkeyed placement structure with a technical ID, a host object, and an order among that host's Orbits. It may contain zero or more catalogue objects, including none. No physical orbital measurements are modeled.

### Fields

The optional native fields are `atmosphere` for planets/moons and `portClass` for applicable installations. Both are single-select fields with user-editable options. All other campaign-specific attributes use custom fields: definitions are global to the local app and reusable across clusters and systems; values are optional per catalogue object. Custom fields support text, number, boolean, and single-select values with user-defined options. They do not apply to structural Orbit entities.
