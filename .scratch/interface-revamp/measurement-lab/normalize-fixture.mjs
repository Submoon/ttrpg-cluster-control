import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const lab = path.dirname(fileURLToPath(import.meta.url))
const rawPath = path.join(lab, 'fixture-original.json')
const rawBytes = await fs.readFile(rawPath)
const raw = JSON.parse(rawBytes)
const normalized = structuredClone(raw)
const changes = []

for (const system of normalized.cluster.systems) {
  const groups = new Map()
  for (const orbit of system.orbits) {
    const key = orbit.hostId ?? null
    const siblings = groups.get(key) ?? []
    siblings.push(orbit)
    groups.set(key, siblings)
  }
  for (const [hostId, siblings] of groups) {
    siblings.sort((left, right) => left.order - right.order)
    siblings.forEach((orbit, index) => {
      const expected = index + 1
      if (orbit.order !== expected) {
        changes.push({ systemId: system.id, orbitId: orbit.id, hostId, from: orbit.order, to: expected })
        orbit.order = expected
      }
    })
  }
}

const normalizedBytes = Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`)
await fs.writeFile(path.join(lab, 'fixture.json'), normalizedBytes)
await fs.writeFile(path.join(lab, 'fixture-baseline.json'), normalizedBytes)
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const sourceB = await fs.readFile(path.join(lab, 'source-b/components/PrototypeWorkbench.vue'))
const acceptedSourceB = await fs.readFile(path.resolve(lab, '../prototype-worktree/components/PrototypeWorkbench.vue'))
await fs.writeFile(path.join(lab, 'artifacts/fixture-normalization-provenance.json'), JSON.stringify({
  sourceFixture: 'seedWorkspace() from accepted B source, preserved as fixture-original.json',
  acceptedPrototypeSourceCommit: '7ea41e0a9b0e585e23812eb9165e95420d72dc89',
  acceptedPrototypeWorkbenchSha256: hash(acceptedSourceB),
  originalSha256: hash(rawBytes),
  normalizedSha256: hash(normalizedBytes),
  measurementBSourcePath: 'source-b/components/PrototypeWorkbench.vue',
  measurementBSourceSha256AfterAdaptation: hash(sourceB),
  measurementAdaptationPatchPath: 'artifacts/b-fixture-normalization.patch',
  changes,
  rule: 'Within each system, renumber orbit orders consecutively from 1 within each hostId group (null is the unhosted-center group), preserving original sibling order, identities, objects, positions, radii, and all other values.',
}, null, 2))
console.log(JSON.stringify({ changes, originalSha256: hash(rawBytes), normalizedSha256: hash(normalizedBytes), measurementBSourceSha256AfterAdaptation: hash(sourceB) }, null, 2))
