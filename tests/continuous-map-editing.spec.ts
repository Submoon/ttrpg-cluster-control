import { expect, test } from '@playwright/test'
import { resolveContinuousObjectOwnerIds } from '../utils/continuous-map-editing'

const systems = [
  { id: 'vesper', envelope: { x: 0, y: 0, width: 100, height: 100 } },
  { id: 'altair', envelope: { x: 200, y: 0, width: 100, height: 100 } },
]

test('a definite map hit owns an Add click before envelope inference @pure', () => {
  expect(resolveContinuousObjectOwnerIds({ x: 250, y: 50 }, systems, 'vesper')).toEqual(['vesper'])
})

test('a unique envelope owns an Add click, while overlap and outside require an owner choice @pure', () => {
  expect(resolveContinuousObjectOwnerIds({ x: 50, y: 50 }, systems)).toEqual(['vesper'])
  const overlap = [systems[0]!, { id: 'altair', envelope: { x: 50, y: 20, width: 100, height: 100 } }]
  expect(resolveContinuousObjectOwnerIds({ x: 75, y: 50 }, overlap)).toEqual(['vesper', 'altair'])
  expect(resolveContinuousObjectOwnerIds({ x: 150, y: 150 }, systems)).toEqual(['vesper', 'altair'])
})
