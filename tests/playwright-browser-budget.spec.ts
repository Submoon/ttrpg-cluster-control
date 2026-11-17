import { expect, test } from './fixtures'
import {
  BROWSER_CASE_BUDGET,
  createDiscoveryEnvironment,
  enforceBrowserBudget,
  parseNativeListing,
} from '../scripts/ci/browser-budget.mjs'

const completeListing = [
  'Listing tests:',
  '  [development-storage] › workspace-recovery.spec.ts:285:1 › failed storage save @development-storage',
  '  [browser] › workspace-launch.spec.ts:72:1 › launch saves and reloads',
  'Total: 2 tests in 2 files',
].join('\n')

test('browser budget counts native project entries and rejects incomplete discovery @pure', { tag: '@pure' }, () => {
  expect(parseNativeListing(completeListing)).toEqual({
    counts: { browser: 1, 'development-storage': 1 },
    total: 2,
    files: 2,
  })

  expect(() => parseNativeListing(completeListing.replace('Total: 2 tests', 'Total: 3 tests')))
    .toThrow('Native Playwright discovery was incomplete')
  expect(() => parseNativeListing(completeListing.replace('[development-storage]', '[pure]')))
    .toThrow('unexpected project "pure"')
})

test('browser budget allows exactly 100 cases and fails closed on overflow @pure', { tag: '@pure' }, () => {
  expect(() => enforceBrowserBudget({ counts: { browser: 99, 'development-storage': 1 }, total: 100, files: 50 }))
    .not.toThrow()
  expect(() => enforceBrowserBudget({ counts: { browser: 100, 'development-storage': 1 }, total: 101, files: 51 }))
    .toThrow(`maximum is ${BROWSER_CASE_BUDGET} (browser=100, development-storage=1)`)
})

test('browser budget discovery clears inherited selection and Preview authentication @pure', { tag: '@pure' }, () => {
  const environment = createDiscoveryEnvironment({
    PLAYWRIGHT_SUITE: 'browser',
    PLAYWRIGHT_SHARD: '2',
    PLAYWRIGHT_PRODUCTION_URL: 'https://preview.example',
    PLAYWRIGHT_CHANNEL: 'chrome',
    playwright_suite: 'pure',
    VERCEL_AUTOMATION_BYPASS_SECRET: 'secret',
    VERCEL_URL: 'preview.example',
    ttrpg_playwright_output_ownership: 'stale descriptor',
    force_color: '3',
    no_color: '0',
    KEEP_THIS: 'preserved',
  })

  expect(environment).toMatchObject({
    PLAYWRIGHT_SUITE: 'all',
    PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:3100',
    NO_COLOR: '1',
    KEEP_THIS: 'preserved',
  })
  expect(Object.keys(environment).filter(name => /^PLAYWRIGHT_/iu.test(name)).sort())
    .toEqual(['PLAYWRIGHT_BASE_URL', 'PLAYWRIGHT_SUITE'])
  expect(Object.keys(environment).filter(name => /^VERCEL_/iu.test(name))).toEqual([])
  expect(environment.ttrpg_playwright_output_ownership).toBeUndefined()
  expect(Object.keys(environment).filter(name => name.toUpperCase() === 'FORCE_COLOR')).toEqual([])
})
