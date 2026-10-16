import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const lab = path.dirname(fileURLToPath(import.meta.url))
const sourcePath = path.join(lab, 'source-b', 'components', 'PrototypeWorkbench.vue')
let source = await fs.readFile(sourcePath, 'utf8')
const changes = [
  ["id: 'orbit-vela-two', order: 2, hostId: planet.id", "id: 'orbit-vela-two', order: 1, hostId: planet.id"],
  ["id: 'orbit-vela-three', order: 3, hostId: null", "id: 'orbit-vela-three', order: 1, hostId: null"],
  ["id: 'orbit-kestrel-two', order: 2, hostId: null", "id: 'orbit-kestrel-two', order: 1, hostId: null"],
]
const applied = []

for (const [before, after] of changes) {
  const beforeCount = source.split(before).length - 1
  const afterCount = source.split(after).length - 1
  if (beforeCount === 1 && afterCount === 0) {
    source = source.replace(before, after)
    applied.push({ before, after, state: 'applied' })
  } else if (beforeCount === 0 && afterCount === 1) {
    applied.push({ before, after, state: 'already-applied' })
  } else {
    throw new Error(`Expected exactly one old or normalized literal; got before=${beforeCount}, after=${afterCount}: ${before}`)
  }
}

await fs.writeFile(sourcePath, source, 'utf8')
console.log(JSON.stringify({ sourcePath, changes: applied }, null, 2))
