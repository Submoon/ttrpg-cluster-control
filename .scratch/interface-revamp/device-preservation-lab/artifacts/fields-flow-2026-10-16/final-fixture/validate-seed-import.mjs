import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createJiti } from '../../../../preview-build/node_modules/jiti/lib/jiti.mjs'
import ts from '../../../../preview-build/node_modules/typescript/lib/typescript.js'

const root = process.cwd()
const outputDir = path.join(root, '.scratch/interface-revamp/device-preservation-lab/artifacts/fields-flow-2026-10-16/final-fixture')
const sha256 = value => createHash('sha256').update(value).digest('hex').toUpperCase()
const read = relative => readFile(path.join(root, relative))

const workbenchPath = 'components/PrototypeWorkbench.vue'
const fixtureModulePath = 'components/prototype-fields-fixture.ts'
const workbench = await read(workbenchPath)
const fixtureModuleSource = await read(fixtureModulePath)
const source = workbench.toString('utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
assert.ok(source, 'PrototypeWorkbench setup script exists')
const ast = ts.createSourceFile(workbenchPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
let seedDeclaration
function findSeed(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'seedWorkspace') seedDeclaration = node
  ts.forEachChild(node, findSeed)
}
findSeed(ast)
assert.ok(seedDeclaration, 'Extract the actual seedWorkspace function from the Vue script')
const transpiledSeed = ts.transpile(seedDeclaration.getText(ast), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None })
const jiti = createJiti(import.meta.url)
const [{ toNormalizedMapPoint }, { isLocalWorkspace }, { prepareJsonImport }, { minimumOrbitRadius }, { createDenseFieldsFixture }] = await Promise.all([
  jiti.import(path.join(root, 'utils/system-map-geometry.ts')),
  jiti.import(path.join(root, 'domain/workspace-schema.ts')),
  jiti.import(path.join(root, 'domain/workspace-json-import.ts')),
  jiti.import(path.join(root, 'domain/workspace-orbits.ts')),
  jiti.import(path.join(root, fixtureModulePath)),
])
const seedWorkspace = new Function('toNormalizedMapPoint', `${transpiledSeed}; return seedWorkspace;`)(toNormalizedMapPoint)
const seed = seedWorkspace()
const dense = createDenseFieldsFixture(seed)
const fixture = JSON.parse((await read('.scratch/interface-revamp/device-preservation-lab/artifacts/fields-flow-2026-10-16/after/valid-replacement-map.json')).toString('utf8'))

function inspectWorkspace(name, workspace) {
  assert.equal(isLocalWorkspace(workspace), true, `${name} passes the actual isLocalWorkspace validator`)
  const orbits = workspace.cluster.systems.flatMap(system => system.orbits.map(orbit => {
    const minimum = minimumOrbitRadius(system, orbit)
    const radii = workspace.layout.orbitRadii[orbit.id]
    assert.ok(radii.horizontal >= minimum && radii.vertical >= minimum, `${name} orbit ${orbit.id} radii meet ${minimum}`)
    return { system: system.name, id: orbit.id, order: orbit.order, hostId: orbit.hostId, minimumRadius: minimum, radii }
  }))
  return {
    systems: workspace.cluster.systems.length,
    objects: workspace.cluster.systems.reduce((sum, system) => sum + system.objects.length, 0),
    customDefinitions: workspace.objectFieldSettings.customFields.length,
    customValueAssignments: workspace.cluster.systems.flatMap(system => system.objects).reduce((sum, object) => sum + Object.keys(object.customFieldValues ?? {}).length, 0),
    orbits,
  }
}

const workspaces = [
  { name: 'normal seed', workspace: seed },
  { name: 'dense seed', workspace: dense },
]
const results = workspaces.map(({ name, workspace }) => {
  const state = inspectWorkspace(name, workspace)
  const prepared = prepareJsonImport(workspace, fixture)
  assert.equal(isLocalWorkspace(prepared.workspace), true, `${name} plus replacement fixture remains valid`)
  assert.equal(prepared.workspace.cluster.systems.length, workspace.cluster.systems.length + 1)
  return {
    name,
    state,
    preparedImport: {
      validCombinedWorkspace: true,
      systemsAfterImport: prepared.workspace.cluster.systems.length,
      addedSystemIds: prepared.addedSystemIds,
    },
  }
})

const report = {
  generatedAt: new Date().toISOString(),
  method: 'Extracted seedWorkspace from PrototypeWorkbench.vue with installed TypeScript transpilation; used actual toNormalizedMapPoint, isLocalWorkspace, minimumOrbitRadius, createDenseFieldsFixture, and prepareJsonImport through installed jiti.',
  hashes: {
    prototypeWorkbenchSha256: sha256(workbench),
    denseFixtureHelperSha256: sha256(fixtureModuleSource),
    importFixtureSha256: sha256(JSON.stringify(fixture)),
  },
  results,
}
await mkdir(outputDir, { recursive: true })
await writeFile(path.join(outputDir, 'seed-import-validation.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ hashes: report.hashes, results: results.map(result => ({ name: result.name, systems: result.state.systems, objects: result.state.objects, customValueAssignments: result.state.customValueAssignments, importedSystems: result.preparedImport.systemsAfterImport })) }, null, 2))
