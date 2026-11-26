# TTRPG Cluster Control

This context defines the language for the Warden's schematic maps of Jump Clusters and their Zones.

## Language

**Jump Cluster**:
A schematic network of named Zones and the Jump Routes between them.

**Jump Cluster backup**:
A complete snapshot of a Warden's Jump Cluster, including GM notes, player publication settings, and the saved map layout. Restoring it makes that Jump Cluster the active map.

**Zone**:
A named local map within a Jump Cluster, containing catalogue objects and Orbits. It may represent a star system or a place without stars, and may be empty while being prepared.

**Star system**:
A Zone representing a stellar system.

**Route object**:
A catalogue object placed along a Jump Route instead of within a Zone, retaining its identity and hosted orbital branch. It may represent a moving ship or a stationary obstacle; its position is updated manually by the Warden.

**Route position**:
An object's manually chosen relative position along a Jump Route, measured from departure toward arrival. Its relative progression is preserved when the route changes shape.

**Zone anchor**:
The reference point locating a Zone and its local geometry within its Jump Cluster, independent of its contents.

**Zone envelope**:
The frame marking a Zone's area on the Cluster map. Its edges stop at adjacent Zone frames and bound the permitted positions of its objects, including allowed automatic expansion. A player envelope reflects the area and contents available in the published chart.

**Jump Point**:
A location within a Zone that can specify where a Jump Route departs or arrives. A Jump Point may reference a physical Station in the same Zone.
_Avoid_: Jump Station (when referring to a Jump Point)

**Jump Route**:
A connection between two different Zones of a Jump Cluster, or from a Zone to an unresolved destination. An end at a known Zone may specify a Jump Point within that Zone.

**Jump level**:
A positive integer used to identify a Jump Route; standard levels are 1 through 9, with higher positive levels available for custom classifications.
_Avoid_: Sequential route number, Jump-01

**Orbit**:
An elliptical schematic path around a catalogue-object host or an unoccupied center; a hosted Orbit can be detached by replacing its object host with an unoccupied center. Equal horizontal and vertical radii form a circle, and an Orbit can contain zero or more map objects, each of which may host nested Orbits.
_Avoid_: Centerless Orbit (the center still exists)

**Location key**:
A short marker linking a map object to its Warden-facing keyed description. Newly assigned keys are unique throughout the Jump Cluster; existing duplicate keys in older maps may be retained.

**Custom field applicability**:
The catalogue objects a reusable custom field applies to: all objects by default, or selected catalogue categories and subtypes.

**Warden display filter**:
A view setting for the Warden's maps, covering objects in Zones and on routes. Objects outside the active criteria remain visible at greatly reduced opacity and available in Hierarchy and Inspect. Player publication is a separate choice.

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
A route deliberately included in player publication when at least one endpoint Zone is present. Sharing does not itself reveal associated Jump Points. A Hidden endpoint is represented as an unknown destination at its exact schematic position.
