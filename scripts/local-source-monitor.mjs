import { watch } from 'node:fs'
import { lstat, readdir, realpath } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
import { isDocumentationPath } from './verification-inputs.mjs'

const ignoredDirectories = new Set([
  '.git', '.nuxt', '.output', '.vercel', 'coverage', 'dist', 'node_modules', 'playwright-report',
  'test-results',
])
const ignoredRootRelativeDirectories = new Set(['.codex/environments'])

/** @typedef {{ invalidated: Promise<string>, check: () => Promise<string | undefined>, close: () => Promise<void> }} LocalSourceMonitor */

/**
 * Watches bounded source, test, documentation-policy, and config roots. Generated output and
 * dependencies are pruned before traversal; unclassified file changes remain relevant.
 * @param {{ rootDirectory: string, intervalMs?: number, scan?: typeof scanRelevantInputs, ignoreFile?: (relativePath: string) => boolean, onIgnoredFileChange?: (relativePath: string) => void }} options
 * @returns {Promise<LocalSourceMonitor>}
 */
export async function createLocalSourceMonitor({ rootDirectory, intervalMs = 250, scan = scanRelevantInputs, ignoreFile = () => false, onIgnoredFileChange = () => {} }) {
  // libuv's Windows directory watcher requires a canonical path prefix for its event filter.
  const root = await realpath(resolve(rootDirectory))
  let closed = false
  /** @type {{ files: Map<string, string>, directories: string[] }} */
  let baseline
  let baselineReady = false
  let deferredDirectoryCheck = false
  /** @type {NodeJS.Timeout | undefined} */
  let timer
  /** @type {Promise<string | undefined> | undefined} */
  let scanInProgress
  const pendingWatchEvents = new Set()
  /** @type {string | undefined} */
  let invalidation
  /** @type {(reason: string) => void} */
  let resolveInvalidated
  /** @type {Promise<string>} */
  const invalidated = new Promise(resolveReason => { resolveInvalidated = resolveReason })
  const watchers = []
  const watchedDirectories = new Set()

  /** @param {string} reason */
  const invalidate = reason => {
    if (invalidation) return invalidation
    invalidation = reason
    resolveInvalidated(reason)
    return reason
  }

  /** @param {string} directory */
  const watchDirectory = directory => {
    if (watchedDirectories.has(directory)) return
    watchedDirectories.add(directory)
    try {
      const watcher = watch(directory, (_eventType, filename) => observeFilesystemEvent(directory, filename))
      watcher.on('error', error => {
        if (!closed) invalidate(`Could not monitor local verification inputs: ${error.message}`)
      })
      watchers.push(watcher)
    } catch (error) {
      invalidate(`Could not monitor local verification inputs in ${toPosixPath(relative(root, directory))}: ${error.message}`)
    }
  }

  /** @param {string} directory @param {string | Buffer | null} filename */
  const observeFilesystemEvent = (directory, filename) => {
    if (closed) return
    if (!filename) {
      invalidate('A local verification input changed and its path could not be identified.')
      return
    }
    const path = resolve(directory, filename.toString())
    const relativePath = toPosixPath(relative(root, path))
    if (isIgnoredInputPath(relativePath) || isDocumentationPath(relativePath)) return
    const observation = (async () => {
      try {
        const metadata = await lstat(path)
        if (closed) return
        if (metadata.isSymbolicLink()) {
          invalidate(`Cannot safely monitor symbolic link input: ${relativePath}.`)
          return
        }
        if (!metadata.isDirectory()) {
          if (isDocumentationPath(relativePath)) return
          const currentFingerprint = fileFingerprint(metadata)
          const previousFingerprint = baselineReady ? baseline.files.get(relativePath) : undefined
          if (ignoreFile(relativePath)) {
            if (!baselineReady || previousFingerprint === undefined || previousFingerprint !== currentFingerprint) {
              onIgnoredFileChange(relativePath)
              if (baselineReady) baseline.files.set(relativePath, currentFingerprint)
            }
            return
          }
          if (previousFingerprint === undefined || previousFingerprint !== fileFingerprint(metadata)) {
            invalidate(`Local verification input changed during the run: ${relativePath}.`)
          }
          return
        }
        if (!baselineReady) {
          deferredDirectoryCheck = true
          return
        }
        if (!baseline.directories.includes(path)) {
          invalidate(`Local verification directory was added during the run: ${relativePath}.`)
          return
        }
        void check().catch(error => {
          if (!closed) invalidate(`Could not check local verification inputs: ${error.message}`)
        })
      } catch (error) {
        if (closed) return
        if (error?.code === 'ENOENT') {
          if (baselineReady && baseline.directories.includes(path)) {
            invalidate(`Local verification directory was removed during the run: ${relativePath}.`)
          } else if (ignoreFile(relativePath)) {
            onIgnoredFileChange(relativePath)
            if (baselineReady) baseline.files.delete(relativePath)
            return
          } else {
            invalidate(`Local verification input changed during the run: ${relativePath}.`)
          }
          return
        }
        invalidate(`Could not inspect local verification input ${relativePath}: ${error.message}`)
      }
    })()
    pendingWatchEvents.add(observation)
    void observation.finally(() => pendingWatchEvents.delete(observation))
  }

  try {
    baseline = await scan(root, watchDirectory)
    for (const directory of baseline.directories) watchDirectory(directory)
  } catch (error) {
    closed = true
    const cleanupErrors = []
    for (const watcher of watchers) {
      try {
        watcher.close()
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
    }
    if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], 'Could not initialize or clean up local input watchers.', { cause: error })
    throw error
  }

  /** @returns {Promise<string | undefined>} */
  const check = async () => {
    if (invalidation) return invalidation
    if (closed) return undefined
    if (scanInProgress) {
      const activeScan = scanInProgress
      const result = await activeScan
      if (result || invalidation || closed) return invalidation ?? result
      return check()
    }
    scanInProgress = (async () => {
      try {
        const next = await scan(root)
        if (closed) return undefined
        const fileChanges = changedInputPaths(baseline.files, next.files)
        const compatibleFileChanges = fileChanges.filter(path => ignoreFile(path))
        for (const path of compatibleFileChanges) onIgnoredFileChange(path)
        const changedPaths = fileChanges.filter(path => !ignoreFile(path))
        changedPaths.push(...changedDirectoryPaths(root, baseline.directories, next.directories))
        changedPaths.sort()
        baseline = next
        if (!changedPaths.length) return undefined
        const displayed = changedPaths.slice(0, 4).join(', ')
        const remainder = changedPaths.length > 4 ? `, and ${changedPaths.length - 4} more` : ''
        return invalidate(`Local verification inputs changed during the run: ${displayed}${remainder}.`)
      } catch (error) {
        if (closed) return undefined
        return invalidate(`Could not check local verification inputs: ${error.message}`)
      } finally {
        scanInProgress = undefined
      }
    })()
    const result = await scanInProgress
    if (closed) return undefined
    // Let filesystem notifications queued during the scan inspect their entries before the
    // caller makes a final result-validity decision.
    await new Promise(resolveImmediate => setImmediate(resolveImmediate))
    while (pendingWatchEvents.size) await Promise.all([...pendingWatchEvents])
    return invalidation ?? result
  }

  baselineReady = true
  if (deferredDirectoryCheck) {
    void check()
  }

  const poll = async () => {
    if (closed || invalidation) return
    await check()
    if (closed || invalidation) return
    timer = setTimeout(poll, intervalMs)
    timer.unref?.()
  }
  timer = setTimeout(poll, intervalMs)
  timer.unref?.()

  return {
    invalidated,
    check,
    async close() {
      if (closed) return
      closed = true
      clearTimeout(timer)
      const closeErrors = []
      for (const watcher of watchers) {
        try {
          watcher.close()
        } catch (error) {
          closeErrors.push(error)
        }
      }
      if (scanInProgress) await scanInProgress
      if (pendingWatchEvents.size) await Promise.all([...pendingWatchEvents])
      if (closeErrors.length) throw new AggregateError(closeErrors, 'Could not close all local input watchers.')
    },
  }
}

/** @param {string} root @param {(directory: string) => void} [onDirectory] @param {(relativePath: string) => boolean} [ignoreFile] @returns {Promise<{ files: Map<string, string>, directories: string[] }>} */
async function scanRelevantInputs(root, onDirectory = () => {}) {
  const files = new Map()
  const directories = [root]
  onDirectory(root)
  const rootEntries = await readdir(root, { withFileTypes: true })
  // Bound traversal to immediate project roots while excluding known dependency/build/artifact trees.
  const sourceRoots = rootEntries
    .filter(entry => entry.isDirectory() && !isIgnoredInputPath(entry.name))
    .map(entry => entry.name)

  for (const entry of rootEntries) {
    if (entry.isDirectory()) continue
    await addFile(root, resolve(root, entry.name), files)
  }
  for (const sourceRoot of sourceRoots) {
    await scanDirectory(root, resolve(root, sourceRoot), files, directories, onDirectory)
  }
  return { files, directories }
}

/** @param {string} root @param {string} directory @param {Map<string, string>} files @param {string[]} directories @param {(directory: string) => void} onDirectory */
async function scanDirectory(root, directory, files, directories, onDirectory) {
  directories.push(directory)
  onDirectory(directory)
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name)
    const relativePath = toPosixPath(relative(root, entryPath))
    if (entry.isDirectory()) {
      if (!isIgnoredInputPath(relativePath)) {
        await scanDirectory(root, entryPath, files, directories, onDirectory)
      }
    } else {
      await addFile(root, entryPath, files)
    }
  }
}

/** @param {string} root @param {string} path @param {Map<string, string>} files */
async function addFile(root, path, files) {
  const relativePath = toPosixPath(relative(root, path))
  if (isIgnoredInputPath(relativePath)) return
  if (isDocumentationPath(relativePath)) return
  const metadata = await lstat(path)
  if (metadata.isSymbolicLink()) {
    throw new Error(`Cannot safely monitor symbolic link input: ${relativePath}.`)
  }
  files.set(relativePath, fileFingerprint(metadata))
}

/** @param {import('node:fs').Stats} metadata */
function fileFingerprint(metadata) {
  return `${metadata.mode}:${metadata.size}:${metadata.mtimeMs}:${metadata.ctimeMs}:${metadata.ino}`
}

/** @param {Map<string, string>} before @param {Map<string, string>} after @returns {string[]} */
function changedInputPaths(before, after) {
  const paths = new Set([...before.keys(), ...after.keys()])
  return [...paths].filter(path => before.get(path) !== after.get(path)).sort()
}

/** @param {string} root @param {string[]} before @param {string[]} after @returns {string[]} */
function changedDirectoryPaths(root, before, after) {
  const previous = new Set(before)
  const current = new Set(after)
  return [...new Set([...before, ...after])]
    .filter(path => previous.has(path) !== current.has(path))
    .map(path => toPosixPath(relative(root, path)))
}

/** @param {string} path */
function toPosixPath(path) {
  return path.split(sep).join('/')
}

/** @param {string} path */
function isIgnoredInputPath(path) {
  if (path.split('/').some(segment => ignoredDirectories.has(segment))) return true
  for (const directory of ignoredRootRelativeDirectories) {
    if (path === directory || path.startsWith(`${directory}/`)) return true
  }
  return false
}
