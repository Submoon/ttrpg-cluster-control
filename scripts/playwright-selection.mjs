import process from 'node:process'
import { validatePreviewUrl } from './ci/vercel-preview.mjs'

/** @typedef {{ name: string, grep?: RegExp, grepInvert?: RegExp, use?: { baseURL?: string, channel?: string } }} PlaywrightProjectSelection */

/**
 * Builds the suite-specific Playwright projects and local server configuration.
 * @param {NodeJS.ProcessEnv} [environment]
 * @param {string[]} [args]
 */
export function createPlaywrightSelection(environment = process.env, args = []) {
  const baseURL = environment.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100'
  const suite = environment.PLAYWRIGHT_SUITE ?? 'all'
  const suiteIncludesBrowser = suite === 'browser' || suite === 'all'
  const productionURL = suiteIncludesBrowser && environment.PLAYWRIGHT_PRODUCTION_URL
    ? validatePreviewUrl(environment.PLAYWRIGHT_PRODUCTION_URL).toString()
    : undefined
  const channel = environment.PLAYWRIGHT_CHANNEL
  const browserOptions = channel ? { channel } : {}

  if (!['pure', 'checks', 'browser', 'all'].includes(suite)) {
    throw new Error('PLAYWRIGHT_SUITE must be pure, checks, browser, or all.')
  }

  /** @type {PlaywrightProjectSelection} */
  const pureProject = {
    name: 'pure',
    grep: /@pure/,
  }
  /** @type {PlaywrightProjectSelection} */
  const storageProject = {
    name: 'development-storage',
    grep: /@development-storage/,
    use: { ...browserOptions, baseURL },
  }
  const checksProjects = [pureProject, storageProject]
  /** @type {PlaywrightProjectSelection} */
  const browserProject = {
    name: 'browser',
    grepInvert: /@pure|@development-storage/,
    use: { ...browserOptions, baseURL: productionURL ?? baseURL },
  }
  /** @type {PlaywrightProjectSelection[]} */
  const allProjects = [
    ...checksProjects,
    browserProject,
  ]
  /** @type {PlaywrightProjectSelection[]} */
  const projects = suite === 'checks'
    ? checksProjects
    : suite === 'browser'
      ? [browserProject]
      : suite === 'pure'
        ? [pureProject]
        : allProjects
  const needsLocalServer = !isPureOnlySelection(args) && suite !== 'pure' && (suite !== 'browser' || !productionURL)
  const webServer = environment.PLAYWRIGHT_BASE_URL || !needsLocalServer
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 3100',
        url: baseURL,
        timeout: 300_000,
      }

  return { baseURL, productionURL, projects, webServer }
}

/** Returns true only when every explicit Playwright project selector names `pure`. */
/** @param {string[]} args @returns {boolean} */
export function isPureOnlySelection(args) {
  const selectedProjects = []
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--project') {
      let nextIndex = index + 1
      if (!args[nextIndex] || args[nextIndex].startsWith('-')) return false
      while (nextIndex < args.length && !args[nextIndex].startsWith('-')) {
        selectedProjects.push(args[nextIndex])
        nextIndex += 1
      }
      index = nextIndex - 1
    } else if (argument.startsWith('--project=')) {
      const value = argument.slice('--project='.length)
      if (!value) return false
      selectedProjects.push(value)
      let nextIndex = index + 1
      while (nextIndex < args.length && !args[nextIndex].startsWith('-')) {
        selectedProjects.push(args[nextIndex])
        nextIndex += 1
      }
      index = nextIndex - 1
    }
  }

  return selectedProjects.length > 0 && selectedProjects.every(project => project === 'pure')
}
