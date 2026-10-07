# Mothership Campaign Cartography

This context defines the language for the Warden's schematic maps of star systems and Jump Clusters.

## Language

**Jump Cluster**:
A schematic network of known star systems and the Jump Routes between them.

**Star system**:
A local map containing one or more stars, Orbits, and notable locations.

**Jump Point**:
A logical endpoint for a Jump Route, distinct from an optional physical Station installation that it may reference.
_Avoid_: Jump Station (when referring to a logical endpoint)

**Jump Route**:
A connection between logical Jump Points in a Jump Cluster; its far end may be unresolved beyond the known cluster.

**Jump level**:
A positive integer used to identify a Jump Route; standard levels are 1 through 9, with higher positive levels available for custom classifications.
_Avoid_: Sequential route number, Jump-01

**Orbit**:
An elliptical schematic path around a catalogue-object host or an unoccupied center; a hosted Orbit can be detached by replacing its object host with an unoccupied center. Equal horizontal and vertical radii form a circle, and an Orbit can contain zero or more map objects, each of which may host nested Orbits.
_Avoid_: Centerless Orbit (the center still exists)

**Location key**:
A short marker unique within a star system that links a map object to its Warden-facing keyed description.
