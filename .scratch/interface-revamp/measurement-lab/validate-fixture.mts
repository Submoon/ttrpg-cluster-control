import fs from 'node:fs'
import { restoreLocalWorkspace, isStarSystem } from './source-baseline/domain/workspace-schema.ts'
import { restoreLocalWorkspace as restoreB, isStarSystem as isStarSystemB } from './source-b/domain/workspace-schema.ts'
import { isObjectFieldSettings, isJumpRoute, isSystemObject, isOrbit } from './source-baseline/domain/workspace-validation.ts'

const raw = JSON.parse(fs.readFileSync('.scratch/interface-revamp/measurement-lab/fixture-original.json', 'utf8'))
const normalized = JSON.parse(fs.readFileSync('.scratch/interface-revamp/measurement-lab/fixture.json', 'utf8'))
console.log('raw', { baselineRestored: !!restoreLocalWorkspace(raw), bRestored: !!restoreB(raw), perSystemValidity: raw.cluster.systems.map(s => [s.id, isStarSystem(s), s.objects.filter(o => !isSystemObject(o)).map(o => o.id), s.orbits.filter(o => !isOrbit(o)).map(o => o.id)]) })
console.log('normalized', { baselineRestored: !!restoreLocalWorkspace(normalized), bRestored: !!restoreB(normalized), systems: normalized.cluster.systems.map(s => [s.id, isStarSystem(s)]), routes: normalized.cluster.routes.map(r => [r.id, isJumpRoute(r)]), settings: isObjectFieldSettings(normalized.objectFieldSettings), positions: normalized.layout.systemPositions })
