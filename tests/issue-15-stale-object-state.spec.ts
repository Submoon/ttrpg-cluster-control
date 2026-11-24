import { expect, test } from './fixtures'
import {
  createLocalWorkspace,
  createSystemObject,
  planMapEntityDeletion,
  replaceWorkspaceSystem,
} from '../domain/workspace'

test('default object names skip occupied names after a deletion @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const initialSystem = workspace.cluster.systems[0]
  if (!initialSystem) throw new Error('Expected the starter workspace to contain a system.')

  const first = {
    ...createSystemObject(initialSystem, 'planet'),
    name: 'Foo',
    description: 'Old object draft',
    placement: { kind: 'system' as const, x: 0.82, y: 0.74 },
  }
  const withFirst = replaceWorkspaceSystem(workspace, {
    ...initialSystem,
    objects: [...initialSystem.objects, first],
  })
  const afterFirst = withFirst.cluster.systems[0]
  if (!afterFirst) throw new Error('Expected the first object to remain in its system.')

  const second = createSystemObject(afterFirst, 'planet')
  const withSecond = replaceWorkspaceSystem(withFirst, {
    ...afterFirst,
    objects: [...afterFirst.objects, second],
  })
  const afterSecond = withSecond.cluster.systems[0]
  if (!afterSecond) throw new Error('Expected the second object to remain in its system.')

  const differentlyTyped = {
    ...createSystemObject(afterSecond, 'other'),
    name: 'New planet 3',
  }
  const withDifferentType = replaceWorkspaceSystem(withSecond, {
    ...afterSecond,
    objects: [...afterSecond.objects, differentlyTyped],
  })
  const deletion = planMapEntityDeletion(withDifferentType, {
    kind: 'object',
    systemId: afterSecond.id,
    objectId: first.id,
  })
  const afterDeletion = deletion.workspace.cluster.systems[0]
  if (!afterDeletion) throw new Error('Expected the system to survive object deletion.')

  const recreated = createSystemObject(afterDeletion, 'planet')
  const survivingNames = afterDeletion.objects.map(object => object.name)
  expect(recreated.name).toBe('New planet 4')
  expect(survivingNames).not.toContain(recreated.name)
  expect(afterDeletion.objects.map(object => object.id)).not.toContain(recreated.id)
  expect(recreated.description).toBe('')
  expect(recreated.placement.kind).toBe('system')
  if (recreated.placement.kind !== 'system') throw new Error('Expected fresh system-level placement.')
  expect(recreated.placement.x).toBeCloseTo(0.7)
  expect(recreated.placement.y).toBeCloseTo(0.1)
  expect(recreated.placement).not.toEqual(first.placement)
})
