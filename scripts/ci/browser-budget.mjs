import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { PLAYWRIGHT_OUTPUT_OWNERSHIP_ENV } from '../playwright-output.mjs'
import { createPlaywrightSelection } from '../playwright-selection.mjs'

export const BROWSER_CASE_BUDGET = 100
export const DISCOVERED_PROJECTS = ['browser', 'development-storage']

const nativeListingArguments = [
  'test',
  '--list',
  '--project=development-storage',
  '--project=browser',
  '--reporter=list',
]

/**
 * Clears inherited Playwright selection, Preview and authentication inputs, then supplies
 * only the values required to discover the two browser-backed projects without a web server.
 * @param {NodeJS.ProcessEnv} inheritedEnvironment
 * @returns {NodeJS.ProcessEnv}
 */
export function createDiscoveryEnvironment(inheritedEnvironment) {
  const environment = { ...inheritedEnvironment }
  for (const name of Object.keys(environment)) {
    if (/^(PLAYWRIGHT_|VERCEL_)/iu.test(name)
      || [PLAYWRIGHT_OUTPUT_OWNERSHIP_ENV, 'FORCE_COLOR', 'NO_COLOR'].includes(name.toUpperCase())) {
      delete environment[name]
    }
  }

  environment.PLAYWRIGHT_SUITE = 'all'
  // A caller-supplied base URL disables the configured Nuxt server for native --list.
  environment.PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3100'
  environment.NO_COLOR = '1'
  return environment
}

/**
 * Parse the native Playwright list reporter's per-test lines and final completeness summary.
 * The summary and parsed project entries must agree so truncated or altered discovery fails closed.
 * @param {string} output
 * @returns {{ counts: Record<string, number>, total: number, files: number }}
 */
export function parseNativeListing(output) {
  const counts = Object.fromEntries(DISCOVERED_PROJECTS.map(project => [project, 0]))
  let listingEntries = 0
  let listingHeaderSeen = false

  for (const line of output.split(/\r?\n/u)) {
    if (line.trim() === 'Listing tests:') {
      listingHeaderSeen = true
      continue
    }

    if (!/^\s+\[/u.test(line)) continue
    const match = /^\s+\[([^\]]+)\] › .+$/u.exec(line)
    if (!match) {
      throw new Error(`Could not parse native Playwright test listing line: ${line.trim()}`)
    }

    const project = match[1]
    if (!Object.hasOwn(counts, project)) {
      throw new Error(`Native Playwright discovery included unexpected project "${project}".`)
    }

    counts[project] += 1
    listingEntries += 1
  }

  const summaries = [...output.matchAll(/^Total: (\d+) tests? in (\d+) files?$/gmu)]
  if (!listingHeaderSeen || summaries.length !== 1) {
    throw new Error('Native Playwright discovery did not produce one complete list and summary.')
  }

  const total = Number(summaries[0][1])
  const files = Number(summaries[0][2])
  const projectTotal = Object.values(counts).reduce((sum, count) => sum + count, 0)
  if (total !== listingEntries || total !== projectTotal) {
    throw new Error(`Native Playwright discovery was incomplete: summary reported ${total}, parsed ${listingEntries}.`)
  }

  const missingProjects = DISCOVERED_PROJECTS.filter(project => counts[project] === 0)
  if (missingProjects.length > 0) {
    throw new Error(`Native Playwright discovery was incomplete; no cases were listed for: ${missingProjects.join(', ')}.`)
  }

  return { counts, total, files }
}

/** @param {{ counts: Record<string, number>, total: number, files: number }} discovery @param {number} [budget] */
export function enforceBrowserBudget(discovery, budget = BROWSER_CASE_BUDGET) {
  if (discovery.total > budget) {
    const breakdown = DISCOVERED_PROJECTS
      .map(project => `${project}=${discovery.counts[project] ?? 0}`)
      .join(', ')
    throw new Error(`Browser-backed Playwright budget exceeded: ${discovery.total} cases found; maximum is ${budget} (${breakdown}).`)
  }
}

/** @param {string} repositoryRoot */
function assertInstalledPlaywrightMatchesLock(repositoryRoot) {
  const lock = JSON.parse(readFileSync(resolve(repositoryRoot, 'package-lock.json'), 'utf8'))
  const installed = JSON.parse(readFileSync(resolve(repositoryRoot, 'node_modules/@playwright/test/package.json'), 'utf8'))
  const lockedVersion = lock.packages?.['node_modules/@playwright/test']?.version

  if (typeof lockedVersion !== 'string' || installed.version !== lockedVersion) {
    throw new Error(`Installed @playwright/test version ${installed.version ?? 'unknown'} does not match package-lock.json (${lockedVersion ?? 'missing'}). Run npm ci before discovery.`)
  }

  return lockedVersion
}

/** @param {string} repositoryRoot @param {NodeJS.ProcessEnv} environment */
function assertServerlessDiscoverySelection(repositoryRoot, environment) {
  const selection = createPlaywrightSelection(environment, nativeListingArguments.slice(1))
  if (selection.webServer) {
    throw new Error('Native browser-budget discovery must not start a local web server.')
  }

  const selectedNames = selection.projects.map(project => project.name)
  if (!DISCOVERED_PROJECTS.every(project => selectedNames.includes(project))) {
    throw new Error(`Playwright configuration does not expose both required projects: ${DISCOVERED_PROJECTS.join(', ')}.`)
  }

  const playwrightCLI = resolve(repositoryRoot, 'node_modules/@playwright/test/cli.js')
  return { playwrightCLI, selectedNames }
}

/** @param {string} repositoryRoot */
export function runBrowserBudgetDiscovery(repositoryRoot = process.cwd()) {
  const lockedVersion = assertInstalledPlaywrightMatchesLock(repositoryRoot)
  const environment = createDiscoveryEnvironment(process.env)
  const { playwrightCLI } = assertServerlessDiscoverySelection(repositoryRoot, environment)
  const result = spawnSync(process.execPath, [playwrightCLI, ...nativeListingArguments], {
    cwd: repositoryRoot,
    env: environment,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  })

  if (result.error) {
    throw new Error(`Native Playwright discovery could not complete: ${result.error.message}`)
  }
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`Native Playwright discovery exited with status ${result.status ?? 'unknown'}.${details ? `\n${details}` : ''}`)
  }

  const discovery = parseNativeListing([result.stdout, result.stderr].filter(Boolean).join('\n'))
  enforceBrowserBudget(discovery)
  console.log(`Native Playwright ${lockedVersion} browser-backed case budget:`)
  for (const project of DISCOVERED_PROJECTS) console.log(`  ${project}: ${discovery.counts[project]}`)
  console.log(`  combined: ${discovery.total} / ${BROWSER_CASE_BUDGET} (${discovery.files} files)`)
  return discovery
}

function main() {
  if (process.argv.length > 2) {
    throw new Error('This command does not accept Playwright filters; discovery must cover both complete projects.')
  }

  runBrowserBudgetDiscovery(resolve(fileURLToPath(new URL('../..', import.meta.url))))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
