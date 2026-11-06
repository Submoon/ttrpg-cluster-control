import { expect, test } from './fixtures'
import {
  addCustomFieldDefinition,
  createLocalWorkspace,
  createSystemObject,
  projectPlayerCluster,
  replaceWorkspaceSystem,
  updateChartDetails,
  updateCustomFieldApplicability,
  updateSystemObject,
} from '../domain/workspace'

test('revealed player objects contain only player text and permitted Field values @pure', () => {
  const initial = createLocalWorkspace('Private Cluster Notes', 'Aster Reach')
  const factionWorkspace = addCustomFieldDefinition(
    initial,
    'Faction',
    'single-select',
    ['Merchants', 'Cult'],
    true,
  )
  const faction = factionWorkspace.objectFieldSettings.customFields[0]!
  const privateWorkspace = addCustomFieldDefinition(factionWorkspace, 'Warden Clue', 'text')
  const privateField = privateWorkspace.objectFieldSettings.customFields[1]!
  const habitatWorkspace = addCustomFieldDefinition(privateWorkspace, 'Habitat', 'text', [], true)
  const habitatField = habitatWorkspace.objectFieldSettings.customFields[2]!
  const scopedWorkspace = updateCustomFieldApplicability(
    habitatWorkspace,
    habitatField.id,
    [{ kind: 'subtype', family: 'CelestialBody', subtype: 'planet' }],
  )
  const sourceSystem = scopedWorkspace.cluster.systems[0]!
  const sourceStar = sourceSystem.objects[0]!
  const systemWithStar = updateSystemObject(
    sourceSystem,
    sourceStar.id,
    {
      publication: 'revealed',
      description: 'PRIVATE GM NOTES',
      playerText: 'PUBLIC STAR TEXT',
      customFieldValues: {
        [faction.id]: 'Merchants',
        [privateField.id]: 'ONLY THE WARDEN',
        [habitatField.id]: 'STAR HABITAT IS SECRET',
      },
    },
    scopedWorkspace.objectFieldSettings,
  )
  const planet = createSystemObject(systemWithStar, 'planet')
  const systemWithPlanet = { ...systemWithStar, objects: [...systemWithStar.objects, planet] }
  const systemWithMaskedPlanet = updateSystemObject(
    systemWithPlanet,
    planet.id,
    {
      publication: 'revealed',
      playerText: 'TEXT MASKED WITH ITS FIELD',
      playerFieldMasks: [faction.id],
      customFieldValues: { [faction.id]: 'Cult', [privateField.id]: 'SECRET ON PEER' },
    },
    scopedWorkspace.objectFieldSettings,
  )
  const moon = createSystemObject(systemWithMaskedPlanet, 'moon')
  const systemWithMoon = {
    ...systemWithMaskedPlanet,
    objects: [...systemWithMaskedPlanet.objects, moon],
  }
  const systemWithNonRevealedMoon = updateSystemObject(
    systemWithMoon,
    moon.id,
    {
      publication: 'known-type',
      playerText: 'KNOWN TYPE TEXT MUST STAY PRIVATE',
      customFieldValues: { [faction.id]: 'Merchants' },
    },
    scopedWorkspace.objectFieldSettings,
  )
  const workspace = updateChartDetails(
    replaceWorkspaceSystem(scopedWorkspace, systemWithNonRevealedMoon),
    sourceSystem.id,
    {
      clusterName: scopedWorkspace.cluster.name,
      systemName: sourceSystem.name,
      playerTitle: scopedWorkspace.cluster.playerTitle,
      publication: 'revealed',
    },
  )

  const document = projectPlayerCluster(workspace)
  const system = document.systems[0]
  if (!system || system.disclosure !== 'revealed') {
    throw new Error('Expected the published star system to have an internal map.')
  }

  expect(system.map.objects[0]).toMatchObject({
    disclosure: 'revealed',
    label: 'Primary Star',
    playerText: 'PUBLIC STAR TEXT',
    fields: [{ name: 'Faction', type: 'single-select', value: 'Merchants' }],
  })
  expect(system.map.objects[1]).toMatchObject({
    disclosure: 'revealed',
    playerText: 'TEXT MASKED WITH ITS FIELD',
    fields: [],
  })
  expect(system.map.objects[2]).toMatchObject({
    disclosure: 'known-type',
    label: 'Moon',
  })
  expect(system.map.objects[2]).not.toHaveProperty('playerText')
  expect(system.map.objects[2]).not.toHaveProperty('fields')

  const serialized = JSON.stringify(document)
  for (const privateText of [
    'Private Cluster Notes',
    'PRIVATE GM NOTES',
    'ONLY THE WARDEN',
    'SECRET ON PEER',
    'KNOWN TYPE TEXT MUST STAY PRIVATE',
    'Cult',
    'Warden Clue',
    'Habitat',
    'STAR HABITAT IS SECRET',
  ]) {
    expect(serialized).not.toContain(privateText)
  }
  expect(workspace.cluster.systems[0]?.objects[0]?.customFieldValues?.[habitatField.id])
    .toBe('STAR HABITAT IS SECRET')
})
