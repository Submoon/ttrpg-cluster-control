import { createHash, randomUUID } from 'node:crypto'
import { lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path'

export const PLAYWRIGHT_OUTPUT_OWNERSHIP_ENV = 'TTRPG_PLAYWRIGHT_OUTPUT_OWNERSHIP'
export const PLAYWRIGHT_OUTPUT_RUN_ROOT_ENV = 'PLAYWRIGHT_OUTPUT_RUN_ROOT'

const ownershipSchemaVersion = 1
const ownershipFileSuffix = '.playwright-output-ownership.json'

/**
 * @typedef {{
 *   runRoot: string,
 *   artifactsDirectory: string,
 *   resultsFile: string,
 *   htmlDirectory: string,
 * }} PlaywrightRunPaths
 */

/**
 * @typedef {PlaywrightRunPaths & {
 *   outputDirectory: string,
 *   jsonReportFile?: string,
 *   jsonWriteFile: string,
 *   htmlReportDirectory: string,
 *   lastRunFile: string,
 *   lastRunFileExplicit: boolean,
 *   jsonReporterRequested: boolean,
 *   ownershipManifestPath?: string,
 * }} ResolvedPlaywrightOutput
 */

/**
 * Reserve sibling locations for native attachments, JSON results, and an HTML report.
 * A supplied run root is useful to callers that already own a containing run directory.
 *
 * @param {{ cwd?: string, runRoot?: string, runPrefix?: string, timestamp?: string | number | Date, pid?: number, randomSuffix?: string }} [options]
 * @returns {PlaywrightRunPaths}
 */
export function createPlaywrightRunPaths({
  cwd = process.cwd(),
  runRoot,
  runPrefix = 'playwright',
  timestamp = Date.now(),
  pid = process.pid,
  randomSuffix = randomUUID().replaceAll('-', '').slice(0, 8),
} = {}) {
  const timestampPart = (timestamp instanceof Date ? timestamp.toISOString() : String(timestamp))
    .replaceAll(/[^a-zA-Z0-9-]/g, '-')
  const resolvedRunRoot = runRoot
    ? resolve(cwd, runRoot)
    : resolve(cwd, 'test-results', `${runPrefix}-${timestampPart}-${pid}-${randomSuffix}`)

  return {
    runRoot: resolvedRunRoot,
    artifactsDirectory: resolve(resolvedRunRoot, 'artifacts'),
    resultsFile: resolve(resolvedRunRoot, 'results.json'),
    htmlDirectory: resolve(resolvedRunRoot, 'html'),
  }
}

/**
 * Resolve Playwright's owned destinations. Output and last-run options must precede
 * file filters and other flags so this resolver agrees with the native CLI parser.
 *
 * @param {{ env?: NodeJS.ProcessEnv, args?: string[], cwd?: string }} [options]
 * @returns {ResolvedPlaywrightOutput}
 */
export function resolvePlaywrightOutput({ env = process.env, args = process.argv.slice(2), cwd = process.cwd() } = {}) {
  const resolvedCwd = resolve(cwd)
  const options = parseInitialOwnershipOptions(args)
  const runPaths = createPlaywrightRunPaths({
    cwd: resolvedCwd,
    runRoot: env[PLAYWRIGHT_OUTPUT_RUN_ROOT_ENV] || undefined,
  })
  const outputDirectory = resolve(
    resolvedCwd,
    options.outputDirectory ?? env.PLAYWRIGHT_OUTPUT_DIR ?? runPaths.artifactsDirectory,
  )

  const jsonReporterRequested = Boolean(env.PLAYWRIGHT_JSON_OUTPUT_FILE
    || env.PLAYWRIGHT_JSON_OUTPUT_DIR
    || env.PLAYWRIGHT_JSON_OUTPUT_NAME)
  let jsonReportFile
  if (env.PLAYWRIGHT_JSON_OUTPUT_FILE) {
    jsonReportFile = resolve(resolvedCwd, env.PLAYWRIGHT_JSON_OUTPUT_FILE)
  } else if (env.PLAYWRIGHT_JSON_OUTPUT_DIR || env.PLAYWRIGHT_JSON_OUTPUT_NAME) {
    const jsonDirectory = env.PLAYWRIGHT_JSON_OUTPUT_DIR
      ? resolve(resolvedCwd, env.PLAYWRIGHT_JSON_OUTPUT_DIR)
      : resolvedCwd
    const fileName = env.PLAYWRIGHT_JSON_OUTPUT_NAME || 'results.json'
    jsonReportFile = resolve(jsonDirectory, fileName)
  }

  const htmlOutput = env.PLAYWRIGHT_HTML_OUTPUT_DIR || env.PLAYWRIGHT_HTML_REPORT
  const htmlReportDirectory = htmlOutput
    ? resolve(resolvedCwd, htmlOutput)
    : runPaths.htmlDirectory
  const explicitLastRunFile = options.lastRunFile ?? env.PLAYWRIGHT_LAST_RUN_OUTPUT_FILE
  const lastRunFileExplicit = Boolean(explicitLastRunFile)
  const lastRunFile = explicitLastRunFile
    ? resolve(resolvedCwd, explicitLastRunFile)
    : resolve(outputDirectory, '.last-run.json')

  return {
    ...runPaths,
    outputDirectory,
    jsonReportFile,
    jsonWriteFile: jsonReportFile ?? runPaths.resultsFile,
    htmlReportDirectory,
    lastRunFile,
    lastRunFileExplicit,
    jsonReporterRequested,
  }
}

/**
 * Initialize one invocation's paths and publish an exclusive manifest for its Playwright
 * children. A descriptor is adopted only by a same-process reload or an immediate IPC child.
 *
 * @param {{ env?: NodeJS.ProcessEnv, args?: string[], cwd?: string, configFile: string }} options
 * @returns {ResolvedPlaywrightOutput}
 */
export function initializePlaywrightOutput({
  env = process.env,
  args = process.argv.slice(2),
  cwd = process.cwd(),
  configFile,
}) {
  const resolvedCwd = resolve(cwd)
  const resolvedConfigFile = resolve(resolvedCwd, configFile)
  if (env[PLAYWRIGHT_OUTPUT_OWNERSHIP_ENV] !== undefined) {
    const adopted = adoptPlaywrightOutput(env[PLAYWRIGHT_OUTPUT_OWNERSHIP_ENV], {
      env,
      args,
      cwd: resolvedCwd,
      configFile: resolvedConfigFile,
    })
    publishOutputEnvironment(env, adopted)
    return adopted
  }

  const output = resolvePlaywrightOutput({ env, args, cwd: resolvedCwd })
  assertFreshPlaywrightOutputs(output, { cwd: resolvedCwd })

  const nonce = randomUUID()
  const manifestPath = resolve(
    dirname(output.runRoot),
    `.${basename(output.runRoot)}-${process.pid}-${nonce}${ownershipFileSuffix}`,
  )
  assertNoSymbolicLinkComponents(manifestPath)
  assertTargetIsFresh(manifestPath, 'file', 'Playwright ownership manifest')
  assertManifestDisjoint(manifestPath, output)
  mkdirSync(dirname(manifestPath), { recursive: true })

  const manifest = {
    formatVersion: ownershipSchemaVersion,
    nonce,
    issuerPid: process.pid,
    cwd: resolvedCwd,
    configIdentity: resolvedConfigFile,
    argumentsHash: hashArguments(args),
    paths: manifestPaths(output),
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`, { flag: 'wx', mode: 0o600 })

  const descriptor = { formatVersion: ownershipSchemaVersion, manifestPath, nonce }
  env[PLAYWRIGHT_OUTPUT_OWNERSHIP_ENV] = JSON.stringify(descriptor)
  const owned = { ...output, ownershipManifestPath: manifestPath }
  publishOutputEnvironment(env, owned)
  registerManifestCleanup(manifestPath, manifest)
  return owned
}

/**
 * Verify destinations before Playwright or a reporter can clear them. This function is
 * read-only so a rejected destination preserves every existing byte.
 *
 * @param {Partial<ResolvedPlaywrightOutput> & { outputDirectory: string }} output
 * @param {{ cwd?: string }} [options]
 */
export function assertFreshPlaywrightOutputs(output, { cwd = process.cwd() } = {}) {
  const jsonReportFile = output.jsonWriteFile ?? output.jsonReportFile ?? output.resultsFile
  const targets = [
    { path: resolve(output.outputDirectory), kind: 'directory', label: 'Playwright artifact directory' },
    ...(jsonReportFile
      ? [{ path: resolve(jsonReportFile), kind: 'file', label: 'Playwright JSON report' }]
      : []),
    ...(output.htmlReportDirectory
      ? [{ path: resolve(output.htmlReportDirectory), kind: 'directory', label: 'Playwright HTML report directory' }]
      : []),
    ...(output.lastRunFileExplicit && output.lastRunFile
      ? [{ path: resolve(output.lastRunFile), kind: 'file', label: 'Playwright last-run file' }]
      : []),
  ]

  for (const target of targets) {
    if (isDestructiveAncestor(target.path, resolve(cwd))) {
      throw new Error(`${target.label} cannot be a filesystem root, workspace root, or ancestor of the workspace.`)
    }
    assertNoSymbolicLinkComponents(target.path)
    assertTargetIsFresh(target.path, target.kind, target.label)
  }

  assertNoOverlappingTargets(targets)

  if (output.lastRunFile && !output.lastRunFileExplicit) {
    const expectedLastRunFile = resolve(output.outputDirectory, '.last-run.json')
    if (!samePath(output.lastRunFile, expectedLastRunFile)) {
      throw new Error('The implicit Playwright last-run file must stay inside the owned artifact directory.')
    }
  }
}

/** @param {string} descriptorText @param {{ env: NodeJS.ProcessEnv, args: string[], cwd: string, configFile: string }} identity */
function adoptPlaywrightOutput(descriptorText, identity) {
  let descriptor
  try {
    descriptor = JSON.parse(descriptorText)
  } catch {
    throw new Error('The Playwright output ownership descriptor is invalid; start a new test invocation.')
  }
  assertExactKeys(descriptor, ['formatVersion', 'manifestPath', 'nonce'], 'Playwright output ownership descriptor')
  if (descriptor.formatVersion !== ownershipSchemaVersion
    || typeof descriptor.manifestPath !== 'string'
    || !isAbsolute(descriptor.manifestPath)
    || typeof descriptor.nonce !== 'string') {
    throw new Error('The Playwright output ownership descriptor is invalid; start a new test invocation.')
  }

  const manifestPath = resolve(descriptor.manifestPath)
  assertNoSymbolicLinkComponents(manifestPath)
  const manifest = parseOwnershipManifest(readFileSync(manifestPath, 'utf8'))
  if (manifest.nonce !== descriptor.nonce
    || manifest.cwd !== identity.cwd
    || manifest.configIdentity !== identity.configFile) {
    throw new Error('The Playwright output ownership manifest does not match this config and working directory.')
  }

  const isCoordinatorReload = process.pid === manifest.issuerPid
  const isImmediateIpcChild = process.pid !== manifest.issuerPid
    && process.ppid === manifest.issuerPid
    && process.connected === true
    && typeof process.send === 'function'
  if (!isCoordinatorReload && !isImmediateIpcChild) {
    throw new Error('A Playwright output ownership descriptor can only be reused by its coordinator or immediate IPC child.')
  }
  if (isCoordinatorReload && manifest.argumentsHash !== hashArguments(identity.args)) {
    throw new Error('The Playwright output ownership manifest belongs to different command arguments.')
  }

  const output = outputFromManifest(manifest)
  assertFreshManifestIdentity(manifestPath, manifest, identity.env, output)
  return { ...output, ownershipManifestPath: manifestPath }
}

/** @param {string} value @returns {Record<string, any>} */
function parseOwnershipManifest(value) {
  let manifest
  try {
    manifest = JSON.parse(value)
  } catch {
    throw new Error('The Playwright output ownership manifest is invalid; start a new test invocation.')
  }
  assertExactKeys(manifest, [
    'formatVersion', 'nonce', 'issuerPid', 'cwd', 'configIdentity', 'argumentsHash', 'paths',
  ], 'Playwright output ownership manifest')
  if (manifest.formatVersion !== ownershipSchemaVersion
    || typeof manifest.nonce !== 'string'
    || !Number.isSafeInteger(manifest.issuerPid)
    || manifest.issuerPid < 1
    || typeof manifest.cwd !== 'string'
    || !isAbsolute(manifest.cwd)
    || typeof manifest.configIdentity !== 'string'
    || !isAbsolute(manifest.configIdentity)
    || typeof manifest.argumentsHash !== 'string') {
    throw new Error('The Playwright output ownership manifest is invalid; start a new test invocation.')
  }
  assertExactKeys(manifest.paths, [
    'runRoot', 'artifactsDirectory', 'resultsFile', 'outputDirectory', 'jsonReportFile',
    'jsonWriteFile', 'htmlDirectory', 'htmlReportDirectory', 'lastRunFile',
    'lastRunFileExplicit', 'jsonReporterRequested',
  ], 'Playwright output ownership paths')
  for (const key of [
    'runRoot', 'artifactsDirectory', 'resultsFile', 'outputDirectory', 'jsonWriteFile',
    'htmlDirectory', 'htmlReportDirectory', 'lastRunFile',
  ]) {
    if (typeof manifest.paths[key] !== 'string' || !isAbsolute(manifest.paths[key])) {
      throw new Error('The Playwright output ownership manifest contains an invalid path.')
    }
  }
  if ((manifest.paths.jsonReportFile !== null && typeof manifest.paths.jsonReportFile !== 'string')
    || typeof manifest.paths.lastRunFileExplicit !== 'boolean'
    || typeof manifest.paths.jsonReporterRequested !== 'boolean') {
    throw new Error('The Playwright output ownership manifest contains invalid reporter settings.')
  }
  if (!samePath(manifest.paths.artifactsDirectory, join(manifest.paths.runRoot, 'artifacts'))
    || !samePath(manifest.paths.resultsFile, join(manifest.paths.runRoot, 'results.json'))
    || !samePath(manifest.paths.htmlDirectory, join(manifest.paths.runRoot, 'html'))
    || manifest.paths.jsonReporterRequested !== (manifest.paths.jsonReportFile !== null)
    || (manifest.paths.jsonReportFile !== null
      && !samePath(manifest.paths.jsonWriteFile, manifest.paths.jsonReportFile))
    || (manifest.paths.jsonReportFile === null
      && !samePath(manifest.paths.jsonWriteFile, manifest.paths.resultsFile))
    || (!manifest.paths.lastRunFileExplicit
      && !samePath(manifest.paths.lastRunFile, join(manifest.paths.outputDirectory, '.last-run.json')))) {
    throw new Error('The Playwright output ownership manifest contains inconsistent paths.')
  }
  for (const key of Object.keys(manifest.paths)) {
    const value = manifest.paths[key]
    if (typeof value === 'string' && !isAbsolute(value)) {
      throw new Error('The Playwright output ownership manifest contains a non-absolute path.')
    }
  }
  return manifest
}

/** @param {string} manifestPath @param {any} manifest @param {NodeJS.ProcessEnv} env @param {ResolvedPlaywrightOutput} output */
function assertFreshManifestIdentity(manifestPath, manifest, env, output) {
  if (!samePath(manifestPath, ownershipManifestPathFor(output.runRoot, manifest.issuerPid, manifest.nonce))) {
    throw new Error('The Playwright output ownership manifest path does not match its run root.')
  }
  assertNoSymbolicLinkComponents(manifestPath)
  assertManifestDisjoint(manifestPath, output)
  if (env[PLAYWRIGHT_OUTPUT_RUN_ROOT_ENV] !== output.runRoot
    || env.PLAYWRIGHT_OUTPUT_DIR !== output.outputDirectory
    || env.PLAYWRIGHT_JSON_OUTPUT_FILE !== output.jsonWriteFile
    || env.PLAYWRIGHT_HTML_OUTPUT_DIR !== output.htmlReportDirectory
    || env.PLAYWRIGHT_LAST_RUN_OUTPUT_FILE !== output.lastRunFile) {
    throw new Error('The Playwright output ownership environment no longer matches its manifest.')
  }
}

/** @param {any} manifest @returns {ResolvedPlaywrightOutput} */
function outputFromManifest(manifest) {
  const paths = manifest.paths
  return {
    runRoot: paths.runRoot,
    artifactsDirectory: paths.artifactsDirectory,
    resultsFile: paths.resultsFile,
    outputDirectory: paths.outputDirectory,
    jsonReportFile: paths.jsonReportFile ?? undefined,
    jsonWriteFile: paths.jsonWriteFile,
    htmlDirectory: paths.htmlDirectory,
    htmlReportDirectory: paths.htmlReportDirectory,
    lastRunFile: paths.lastRunFile,
    lastRunFileExplicit: paths.lastRunFileExplicit,
    jsonReporterRequested: paths.jsonReporterRequested,
  }
}

/** @param {ResolvedPlaywrightOutput} output */
function manifestPaths(output) {
  return {
    runRoot: output.runRoot,
    artifactsDirectory: output.artifactsDirectory,
    resultsFile: output.resultsFile,
    outputDirectory: output.outputDirectory,
    jsonReportFile: output.jsonReportFile ?? null,
    jsonWriteFile: output.jsonWriteFile,
    htmlDirectory: output.htmlDirectory,
    htmlReportDirectory: output.htmlReportDirectory,
    lastRunFile: output.lastRunFile,
    lastRunFileExplicit: output.lastRunFileExplicit,
    jsonReporterRequested: output.jsonReporterRequested,
  }
}

/** @param {NodeJS.ProcessEnv} env @param {ResolvedPlaywrightOutput} output */
function publishOutputEnvironment(env, output) {
  env[PLAYWRIGHT_OUTPUT_RUN_ROOT_ENV] = output.runRoot
  env.PLAYWRIGHT_OUTPUT_DIR = output.outputDirectory
  env.PLAYWRIGHT_JSON_OUTPUT_FILE = output.jsonWriteFile
  env.PLAYWRIGHT_HTML_OUTPUT_DIR = output.htmlReportDirectory
  env.PLAYWRIGHT_LAST_RUN_OUTPUT_FILE = output.lastRunFile
}

/** @param {string} runRoot @param {number} issuerPid @param {string} nonce */
function ownershipManifestPathFor(runRoot, issuerPid, nonce) {
  return resolve(dirname(runRoot), `.${basename(runRoot)}-${issuerPid}-${nonce}${ownershipFileSuffix}`)
}

/** @param {string} manifestPath @param {ResolvedPlaywrightOutput} output */
function assertManifestDisjoint(manifestPath, output) {
  assertNoOverlappingTargets([
    { path: manifestPath, label: 'Playwright ownership manifest' },
    { path: output.outputDirectory, label: 'Playwright artifact directory' },
    { path: output.htmlReportDirectory, label: 'Playwright HTML report directory' },
    { path: output.jsonWriteFile, label: 'Playwright JSON report' },
    ...(output.lastRunFileExplicit ? [{ path: output.lastRunFile, label: 'Playwright last-run file' }] : []),
  ])
}

/** @param {string} manifestPath @param {any} manifest */
function registerManifestCleanup(manifestPath, manifest) {
  process.once('exit', () => {
    if (process.pid !== manifest.issuerPid) return
    try {
      const existing = parseOwnershipManifest(readFileSync(manifestPath, 'utf8'))
      if (existing.nonce === manifest.nonce && existing.issuerPid === manifest.issuerPid) unlinkSync(manifestPath)
    } catch (error) {
      process.stderr.write(`Could not remove the Playwright ownership manifest: ${error.message}\n`)
    }
  })
}

/** @param {string[]} args */
function parseInitialOwnershipOptions(args) {
  const start = args[0] === 'test' ? 1 : 0
  /** @type {{ outputDirectory?: string, lastRunFile?: string }} */
  const parsed = {}
  let index = start
  while (index < args.length) {
    const argument = args[index]
    if (argument === '--') break
    const option = ownershipOption(argument)
    if (option) {
      if (parsed[option.key] !== undefined) throw new Error(`${option.name} may be supplied only once.`)
      let value = option.inlineValue
      if (value === undefined) {
        value = args[index + 1]
        if (!value || value.startsWith('--') || value === '--') {
          throw new Error(`${option.name} requires a path in the initial Playwright option prefix.`)
        }
        index += 1
      }
      if (!value) throw new Error(`${option.name} requires a path in the initial Playwright option prefix.`)
      parsed[option.key] = value
      index += 1
      continue
    }
    break
  }

  for (; index < args.length; index += 1) {
    const argument = args[index]
    const option = ownershipOption(argument)
    if (option) {
      throw new Error(`${option.name} must appear before test filters and other Playwright flags.`)
    }
  }
  return parsed
}

/** @param {string} argument @returns {{name: string, key: 'outputDirectory' | 'lastRunFile', inlineValue?: string} | undefined} */
function ownershipOption(argument) {
  for (const [name, key] of [
    ['--output', 'outputDirectory'],
    ['--last-failed-file', 'lastRunFile'],
  ]) {
    if (argument === name) return { name, key }
    if (argument.startsWith(`${name}=`)) {
      return { name, key, inlineValue: argument.slice(name.length + 1) }
    }
  }
  return undefined
}

/** @param {string} target */
function assertNoSymbolicLinkComponents(target) {
  const root = parse(target).root
  let current = root
  for (const segment of relative(root, target).split(sep).filter(Boolean)) {
    current = join(current, segment)
    try {
      if (lstatSync(current).isSymbolicLink()) {
        throw new Error('Playwright output paths cannot pass through a symbolic link.')
      }
    } catch (error) {
      if (error?.code === 'ENOENT') break
      throw error
    }
  }
}

/** @param {string} target @param {'directory' | 'file'} kind @param {string} label */
function assertTargetIsFresh(target, kind, label) {
  let stat
  try {
    stat = lstatSync(target)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
  if (kind === 'file') throw new Error(`${label} already exists; choose a new, isolated path.`)
  if (!stat.isDirectory()) throw new Error(`${label} must be a directory path.`)
  if (readdirSync(target).length > 0) {
    throw new Error(`${label} already contains retained data; choose a new, isolated output path.`)
  }
}

/** @param {Array<{path: string, label: string}>} targets */
function assertNoOverlappingTargets(targets) {
  for (let leftIndex = 0; leftIndex < targets.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < targets.length; rightIndex += 1) {
      const left = targets[leftIndex]
      const right = targets[rightIndex]
      if (pathsOverlap(left.path, right.path)) {
        throw new Error(`${left.label} and ${right.label} must use separate, non-overlapping paths.`)
      }
    }
  }
}

/** @param {string} parent @param {string} child */
function containsPath(parent, child) {
  const childRelative = relative(normalizeForComparison(parent), normalizeForComparison(child))
  return childRelative === ''
    || (!isAbsolute(childRelative) && childRelative !== '..' && !childRelative.startsWith(`..${sep}`))
}

/** @param {string} left @param {string} right */
function pathsOverlap(left, right) {
  return containsPath(left, right) || containsPath(right, left)
}

/** @param {string} path */
function normalizeForComparison(path) {
  const absolute = resolve(path)
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute
}

/** @param {string} target @param {string} cwd */
function isDestructiveAncestor(target, cwd) {
  return samePath(target, parse(target).root) || containsPath(target, cwd)
}

/** @param {string} left @param {string} right */
function samePath(left, right) {
  return normalizeForComparison(left) === normalizeForComparison(right)
}

/** @param {string[]} args */
function hashArguments(args) {
  return createHash('sha256').update(JSON.stringify(args)).digest('hex')
}

/** @param {unknown} value @param {string[]} expectedKeys @param {string} label */
function assertExactKeys(value, expectedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} has an invalid schema.`)
  }
  const actual = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has an invalid schema.`)
  }
}
