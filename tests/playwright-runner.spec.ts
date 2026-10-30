import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from './fixtures'
import { createPlaywrightSelection, isPureOnlySelection } from '../scripts/playwright-selection.mjs'
import { assertFreshPlaywrightOutputs, resolvePlaywrightOutput } from '../scripts/playwright-output.mjs'

type Selection = ReturnType<typeof createPlaywrightSelection>
type SyntheticCase = {
  identity: string
  title: string
}

const syntheticCases: SyntheticCase[] = [
  { identity: 'pure', title: 'domain validation @pure' },
  { identity: 'storage', title: 'local storage workflow @development-storage' },
  { identity: 'browser', title: 'browser interaction' },
]

function selectedProjectNames(selection: Selection, title: string): string[] {
  return selection.projects
    .filter(project => (!project.grep || project.grep.test(title))
      && (!project.grepInvert || !project.grepInvert.test(title)))
    .map(project => project.name)
}

function expectCasePartition(selection: Selection, expected: Record<string, string[]>): void {
  for (const syntheticCase of syntheticCases) {
    expect(selectedProjectNames(selection, syntheticCase.title), syntheticCase.identity).toEqual(expected[syntheticCase.identity])
  }
}

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesBelow(path) : entry.isFile() ? [path] : []
  })
}

test('runner selection partitions pure, storage and browser cases @pure', { tag: '@pure' }, () => {
  const invalidPreviewURL = 'not-an-immutable-preview-url'
  const pure = createPlaywrightSelection({
    PLAYWRIGHT_SUITE: 'pure',
    PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:1',
    PLAYWRIGHT_PRODUCTION_URL: invalidPreviewURL,
  })
  const checks = createPlaywrightSelection({
    PLAYWRIGHT_SUITE: 'checks',
    PLAYWRIGHT_PRODUCTION_URL: invalidPreviewURL,
  })
  const browser = createPlaywrightSelection({ PLAYWRIGHT_SUITE: 'browser' })
  const browserPreview = createPlaywrightSelection({
    PLAYWRIGHT_SUITE: 'browser',
    PLAYWRIGHT_PRODUCTION_URL: 'https://ttrpg-cluster-control-a1-submoon.vercel.app',
    PLAYWRIGHT_CHANNEL: 'chrome',
  })
  const all = createPlaywrightSelection({
    PLAYWRIGHT_SUITE: 'all',
    PLAYWRIGHT_PRODUCTION_URL: 'https://ttrpg-cluster-control-a1-submoon.vercel.app',
  })
  const pureCliArgs = ['tests/workspace-codec.spec.ts', '--project=pure']
  const mixedCliArgs = [
    'tests/workspace-codec.spec.ts',
    '--project=pure',
    '--project=development-storage',
  ]
  const pureCli = createPlaywrightSelection({ PLAYWRIGHT_SUITE: 'all' }, pureCliArgs)
  const mixedCli = createPlaywrightSelection({ PLAYWRIGHT_SUITE: 'all' }, mixedCliArgs)

  expect(pure.productionURL).toBeUndefined()
  expect(pure.webServer).toBeUndefined()
  expect(pure.projects.map(project => project.name)).toEqual(['pure'])
  expect(pure.projects[0]?.use).toBeUndefined()
  expectCasePartition(pure, {
    pure: ['pure'],
    storage: [],
    browser: [],
  })

  expect(checks.productionURL).toBeUndefined()
  expect(checks.webServer?.url).toBe('http://127.0.0.1:3100')
  expect(checks.projects.map(project => project.name)).toEqual(['pure', 'development-storage'])
  expectCasePartition(checks, {
    pure: ['pure'],
    storage: ['development-storage'],
    browser: [],
  })

  expect(browser.webServer?.command).toBe('npm run dev -- --host 127.0.0.1 --port 3100')
  expect(browser.projects.map(project => project.name)).toEqual(['browser'])
  expectCasePartition(browser, {
    pure: [],
    storage: [],
    browser: ['browser'],
  })

  expect(browserPreview.productionURL).toBe('https://ttrpg-cluster-control-a1-submoon.vercel.app/')
  expect(browserPreview.webServer).toBeUndefined()
  expect(browserPreview.projects[0]?.use).toEqual({
    channel: 'chrome',
    baseURL: browserPreview.productionURL,
  })
  expect(all.projects.map(project => project.name)).toEqual(['pure', 'development-storage', 'browser'])
  expect(all.webServer?.url).toBe('http://127.0.0.1:3100')
  expectCasePartition(all, {
    pure: ['pure'],
    storage: ['development-storage'],
    browser: ['browser'],
  })

  expect(isPureOnlySelection(pureCliArgs)).toBe(true)
  expect(pureCli.webServer).toBeUndefined()
  expect(isPureOnlySelection(mixedCliArgs)).toBe(false)
  expect(mixedCli.webServer).toMatchObject({
    command: 'npm run dev -- --host 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
  })
})

test('only browser-capable suites validate a configured Preview URL @pure', { tag: '@pure' }, () => {
  const invalidPreviewURL = 'not-an-immutable-preview-url'

  expect(() => createPlaywrightSelection({
    PLAYWRIGHT_SUITE: 'pure',
    PLAYWRIGHT_PRODUCTION_URL: invalidPreviewURL,
  })).not.toThrow()
  expect(() => createPlaywrightSelection({
    PLAYWRIGHT_SUITE: 'checks',
    PLAYWRIGHT_PRODUCTION_URL: invalidPreviewURL,
  })).not.toThrow()
  expect(() => createPlaywrightSelection({
    PLAYWRIGHT_SUITE: 'browser',
    PLAYWRIGHT_PRODUCTION_URL: invalidPreviewURL,
  })).toThrow('Preview URL must be a clean HTTPS URL on the immutable Vercel preview host.')
  expect(() => createPlaywrightSelection({
    PLAYWRIGHT_SUITE: 'all',
    PLAYWRIGHT_PRODUCTION_URL: invalidPreviewURL,
  })).toThrow('Preview URL must be a clean HTTPS URL on the immutable Vercel preview host.')
})

test('runner keeps explicit fresh CLI and reporter destinations disjoint @pure', { tag: '@pure' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'playwright-output-resolution-'))

  try {
    const cases = [
      {
        args: ['test', '--output', 'fresh-space/artifacts', '--last-failed-file', 'reports/last-file-wins.json', 'tests/example.spec.ts'],
        env: {
          PLAYWRIGHT_OUTPUT_DIR: 'ignored-output',
          PLAYWRIGHT_JSON_OUTPUT_FILE: 'reports/file-wins.json',
          PLAYWRIGHT_JSON_OUTPUT_DIR: 'ignored-json-dir',
          PLAYWRIGHT_JSON_OUTPUT_NAME: 'ignored-name.json',
          PLAYWRIGHT_HTML_OUTPUT_DIR: 'reports/html-one',
          PLAYWRIGHT_LAST_RUN_OUTPUT_FILE: 'ignored-last-run.json',
        },
        output: 'fresh-space/artifacts',
        report: 'reports/file-wins.json',
        html: 'reports/html-one',
        lastRun: 'reports/last-file-wins.json',
      },
      {
        args: ['test', '--output=fresh-equals/artifacts', 'tests/example.spec.ts'],
        env: {
          PLAYWRIGHT_JSON_OUTPUT_DIR: 'reports/json-dir',
          PLAYWRIGHT_JSON_OUTPUT_NAME: 'dir-wins.json',
          PLAYWRIGHT_HTML_OUTPUT_DIR: 'reports/html-two',
          PLAYWRIGHT_LAST_RUN_OUTPUT_FILE: 'reports/last-run-env.json',
        },
        output: 'fresh-equals/artifacts',
        report: 'reports/json-dir/dir-wins.json',
        html: 'reports/html-two',
        lastRun: 'reports/last-run-env.json',
      },
    ]

    for (const options of cases) {
      const output = resolvePlaywrightOutput({ ...options, cwd: root })
      expect(output.outputDirectory).toBe(join(root, options.output))
      expect(output.jsonReportFile).toBe(join(root, options.report))
      expect(output.htmlReportDirectory).toBe(join(root, options.html))
      expect(output.lastRunFile).toBe(join(root, options.lastRun))
      assertFreshPlaywrightOutputs(output, { cwd: root })
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('runner rejects ownership destinations outside the initial option prefix @pure', { tag: '@pure' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'playwright-output-prefix-'))

  try {
    for (const args of [
      ['test', 'tests/example.spec.ts', '--output=fresh-after-filter'],
      ['test', '--project=pure', '--last-failed-file', 'fresh-after-flag.json'],
      ['test', '--grep', '--output=fresh-as-grep-value'],
      ['test', '--grep-invert', '--', '--output=fresh-after-separator'],
      ['tests/example.spec.ts', 'test', '--output=fresh-after-nonleading-command'],
      ['test', '--output=first', '--output=duplicate'],
      ['test', '--last-failed-file'],
    ]) {
      expect(() => resolvePlaywrightOutput({ env: {}, args, cwd: root })).toThrow()
    }

    expect(() => resolvePlaywrightOutput({
      env: {},
      args: ['test', '--output', 'fresh-before-separator', '--', '--last-failed-file=ambiguous-literal.json'],
      cwd: root,
    })).toThrow('must appear before test filters and other Playwright flags')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('runner rejects retained or overlapping output targets without changing prior evidence @pure', { tag: '@pure' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'playwright-output-retained-'))
  const retainedDirectory = join(root, 'retained')
  const retainedFile = join(retainedDirectory, 'first-failure.trace.zip')
  mkdirSync(retainedDirectory)
  writeFileSync(retainedFile, 'first attempt evidence')

  try {
    const retained = resolvePlaywrightOutput({
      env: { PLAYWRIGHT_OUTPUT_DIR: retainedDirectory },
      args: [],
      cwd: root,
    })
    expect(() => assertFreshPlaywrightOutputs(retained, { cwd: root }))
      .toThrow('already contains retained data')
    expect(readFileSync(retainedFile, 'utf8')).toBe('first attempt evidence')

    const retainedReportFile = join(root, 'retained-report.json')
    writeFileSync(retainedReportFile, '{"firstAttempt":"failed"}')
    const retainedReport = resolvePlaywrightOutput({
      env: {
        PLAYWRIGHT_OUTPUT_DIR: 'new-artifacts',
        PLAYWRIGHT_JSON_OUTPUT_FILE: retainedReportFile,
      },
      args: [],
      cwd: root,
    })
    expect(() => assertFreshPlaywrightOutputs(retainedReport, { cwd: root }))
      .toThrow('already exists')
    expect(readFileSync(retainedReportFile, 'utf8')).toBe('{"firstAttempt":"failed"}')

    const overlapping = resolvePlaywrightOutput({
      env: {
        PLAYWRIGHT_OUTPUT_DIR: 'overlap',
        PLAYWRIGHT_JSON_OUTPUT_FILE: 'overlap/results.json',
      },
      args: [],
      cwd: root,
    })
    expect(() => assertFreshPlaywrightOutputs(overlapping, { cwd: root }))
      .toThrow('separate, non-overlapping paths')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('native worker reloads keep failure and replacement attachments inside the coordinated outputs @pure', { tag: '@pure' }, () => {
  const testResultsRoot = join(process.cwd(), 'test-results')
  mkdirSync(testResultsRoot, { recursive: true })
  const root = mkdtempSync(join(testResultsRoot, 'playwright-worker-ownership-'))
  const outputHelperURL = pathToFileURL(resolve(process.cwd(), 'scripts/playwright-output.mjs')).href
  const artifactSetup = resolve(process.cwd(), 'scripts/ci/playwright-artifacts.mjs')
  const playwrightCLI = resolve(process.cwd(), 'node_modules/@playwright/test/cli.js')
  const ownershipEnvironmentNames = [
    'PLAYWRIGHT_OUTPUT_DIR',
    'PLAYWRIGHT_OUTPUT_RUN_ROOT',
    'PLAYWRIGHT_JSON_OUTPUT_FILE',
    'PLAYWRIGHT_JSON_OUTPUT_DIR',
    'PLAYWRIGHT_JSON_OUTPUT_NAME',
    'PLAYWRIGHT_HTML_OUTPUT_DIR',
    'PLAYWRIGHT_HTML_REPORT',
    'PLAYWRIGHT_LAST_RUN_OUTPUT_FILE',
    'TTRPG_PLAYWRIGHT_OUTPUT_OWNERSHIP',
    'PLAYWRIGHT_PRODUCTION_URL',
    'VERCEL_AUTOMATION_BYPASS_SECRET',
    'OUTPUT_OWNERSHIP_PROBE_MODE',
  ]

  try {
    const runProbe = (runName: string, mode: 'fail-first' | 'success', explicitOutput?: string) => {
      const runRoot = join(root, runName)
      mkdirSync(runRoot, { recursive: true })
      const configFile = join(runRoot, 'playwright.config.mjs')
      const testFile = join(runRoot, 'ownership-probe.spec.mjs')
      const firstAttachment = join(runRoot, 'first-worker-context.txt')
      const replacementAttachment = join(runRoot, 'replacement-worker-context.txt')
      writeFileSync(firstAttachment, 'first-worker-attachment')
      writeFileSync(replacementAttachment, 'replacement-worker-attachment')

      writeFileSync(configFile, [
        `import { defineConfig } from '@playwright/test'`,
        `import { fileURLToPath } from 'node:url'`,
        `import { initializePlaywrightOutput } from ${JSON.stringify(outputHelperURL)}`,
        `const output = initializePlaywrightOutput({ env: process.env, args: process.argv.slice(2), cwd: process.cwd(), configFile: fileURLToPath(import.meta.url) })`,
        `export default defineConfig({ testDir: ${JSON.stringify(runRoot)}, testMatch: 'ownership-probe.spec.mjs', reporter: [['list'], ['json', { outputFile: output.jsonWriteFile }]], outputDir: output.outputDirectory, workers: 1, retries: 0, projects: [{ name: 'serverless' }], globalSetup: ${JSON.stringify(artifactSetup)}, use: { trace: 'retain-on-failure' } })`,
        '',
      ].join('\n'))
      writeFileSync(testFile, [
        `import { test, expect } from '@playwright/test'`,
        `test('first worker failure retains its attachment', async ({}, testInfo) => {`,
        `  await testInfo.attach('first-worker-context', { path: ${JSON.stringify(firstAttachment)}, contentType: 'text/plain' })`,
        `  if (process.env.OUTPUT_OWNERSHIP_PROBE_MODE === 'fail-first') expect('failure').toBe('success')`,
        `})`,
        `test('replacement worker attachment remains in the owned output', async ({}, testInfo) => {`,
        `  await testInfo.attach('replacement-worker-context', { path: ${JSON.stringify(replacementAttachment)}, contentType: 'text/plain' })`,
        `})`,
        '',
      ].join('\n'))

      const environment: NodeJS.ProcessEnv = { ...process.env }
      for (const name of ownershipEnvironmentNames) delete environment[name]
      environment.OUTPUT_OWNERSHIP_PROBE_MODE = mode
      if (explicitOutput) environment.PLAYWRIGHT_OUTPUT_DIR = explicitOutput
      return spawnSync(process.execPath, [playwrightCLI, 'test', '--config', configFile], {
        cwd: runRoot,
        env: environment,
        encoding: 'utf8',
        timeout: 30_000,
        windowsHide: true,
      })
    }

    const firstRun = runProbe('default-run', 'fail-first')
    expect(firstRun.error, firstRun.stderr).toBeUndefined()
    expect(firstRun.status, firstRun.stdout + firstRun.stderr).toBe(1)
    expect(firstRun.stdout + firstRun.stderr).toContain('first worker failure retains its attachment')

    const firstRoot = join(root, 'default-run')
    const firstMarker = JSON.parse(readFileSync(join(firstRoot, 'test-results/.playwright-diagnostics-sanitized.json'), 'utf8')) as {
      outputs: string[],
    }
    const firstOutputDirectory = firstMarker.outputs.find(path => /[\\/]artifacts$/.test(path))
    const firstJsonFile = firstMarker.outputs.find(path => /[\\/]results\.json$/.test(path))
    expect(firstOutputDirectory).toBeDefined()
    expect(firstJsonFile).toBeDefined()
    const firstArtifacts = filesBelow(firstOutputDirectory!)
    expect(firstArtifacts.some(path => path.endsWith('trace.zip'))).toBe(true)
    const firstTexts = firstArtifacts
      .filter(path => path.toLowerCase().endsWith('.txt'))
      .map(path => readFileSync(path, 'utf8'))
    expect(firstTexts).toContain('first-worker-attachment')
    expect(firstTexts).toContain('replacement-worker-attachment')

    const explicitOutput = join(root, 'explicit-env', 'native-artifacts')
    const secondRun = runProbe('explicit-env-run', 'success', explicitOutput)
    expect(secondRun.error, secondRun.stderr).toBeUndefined()
    expect(secondRun.status, secondRun.stdout + secondRun.stderr).toBe(0)

    const secondRoot = join(root, 'explicit-env-run')
    const secondMarker = JSON.parse(readFileSync(join(secondRoot, 'test-results/.playwright-diagnostics-sanitized.json'), 'utf8')) as {
      outputs: string[],
    }
    expect(secondMarker.outputs).toContain(explicitOutput)
    const secondJsonFile = secondMarker.outputs.find(path => /[\\/]results\.json$/.test(path))
    expect(secondJsonFile).toBeDefined()
    const secondArtifacts = filesBelow(explicitOutput)
    const secondTexts = secondArtifacts
      .filter(path => path.toLowerCase().endsWith('.txt'))
      .map(path => readFileSync(path, 'utf8'))
    expect(secondTexts).toContain('first-worker-attachment')
    expect(secondTexts).toContain('replacement-worker-attachment')
    expect(filesBelow(firstOutputDirectory!).some(path => path.endsWith('trace.zip'))).toBe(true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
