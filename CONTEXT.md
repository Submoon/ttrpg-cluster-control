# TTRPG Cluster Control

This context defines the language for the Warden's schematic maps of Jump Clusters and star systems.

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

**Custom field applicability**:
The catalogue objects a reusable custom field applies to: all objects by default, or selected catalogue categories and subtypes.

**Player publication**:
The Warden's choice of how a location is presented to players: Hidden, Unknown presence, Known type, or Revealed. Publication does not change the authoritative location or track campaign discovery separately.

**Player share title**:
A player-facing chart title chosen independently of the Warden's Jump Cluster name.

**Player preview**:
A Warden-side consultation of the information selected for players. The Warden's surrounding workspace retains its private preparation.

**Player document**:
A detached snapshot of the published Jump Cluster and its permitted details and relationships, shared independently of the Warden's complete preparation.

**Player reader**:
A consultation view of one player document, offering navigation and inspection without map editing or access to Warden preparation.

**Player link**:
A URL carrying one immutable player document. Generating a new link publishes a new snapshot; previously distributed links keep their own content.

**Required Orbit host chain**:
An orbital object's host and each further host in its placement ancestry. Player publication can show otherwise Hidden required hosts as Unknown presences without revealing unrelated satellites. An unoccupied Orbit center is geometry, not a physical host object.

**GM notes**:
Private object prose retained for the Warden's preparation.

**Player text**:
Object prose deliberately authored for player inspection when the object is Revealed, separate from GM notes.

**Field publication**:
The shared choice to permit an applicable native or custom Field's assigned value on Revealed objects. Publication does not change applicability or erase stored assignments.

**Player Field mask**:
An object's additional restriction that hides one Field value from players. A mask cannot make a private Field public.

**Shared Jump Route**:
A route deliberately included in player publication when at least one endpoint system is present. Sharing does not reveal its logical Jump Points. A Hidden endpoint is represented as an unknown destination at its exact schematic position.
