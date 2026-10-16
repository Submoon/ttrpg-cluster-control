import type { LocalWorkspace } from '../domain/workspace'

/** Builds an opt-in dense inspector sample without changing the ordinary prototype seed. */
export function createDenseInspectorFixture(workspace: LocalWorkspace): LocalWorkspace {
  const dense = JSON.parse(JSON.stringify(workspace)) as LocalWorkspace
  const system = dense.cluster.systems.find(candidate => candidate.id === 'sys-vela')
  const object = system?.objects.find(candidate => candidate.id === 'obj-vela-planet')
  if (!object || !system) return dense

  object.name = 'Aster, Keeper of the Quiet Meridian and Outer Beacon'
  object.description = [
    'A broad, tidally locked world with a line of abandoned weather stations along the habitable terminator.',
    'The night side still carries faint navigation beacons. Surveyors report that the oldest signal repeats after every fourth local dawn.',
    'The southern landing shelf is stable, although dust storms can cover the access road in less than an hour.',
  ].join('\n\n')
  object.atmosphere = 'Breathable'
  object.customFieldValues = {
    ...object.customFieldValues,
    threat: 0,
    'session-note': 'The archive door is beneath the old weather station.\n\nAsk the crew what they left there before the last survey.',
    confidence: 0,
    'hazard-flag': false,
    'survey-status': 'Needs a second pass',
    'landing-log': 'The north ridge is safe in daylight.\nThe lower shelf floods after a storm.\nA beacon repeats on the fourth dawn.',
  }
  dense.objectFieldSettings.customFields.push(
    { id: 'confidence', name: 'Survey confidence', type: 'number' },
    { id: 'hazard-flag', name: 'Confirmed hazard', type: 'boolean' },
    { id: 'survey-status', name: 'Survey status', type: 'single-select', options: ['Not started', 'Needs a second pass', 'Complete'] },
    { id: 'landing-log', name: 'Landing and weather log', type: 'text' },
  )
  return dense
}
