import { appendFile, lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDocumentationPath } from '../verification-inputs.mjs'

const WORKFLOW_PATH = '.github/workflows/ci.yml'
const PROOF_NAME = 'verification-witness.json'
const PROOF_ARTIFACT_PREFIX = 'ci-full-witness-'
const MAX_DIFF_BYTES = 8 * 1024 * 1024
const MAX_API_BODY_BYTES = 1_000_000
const MAX_PROOF_BYTES = 16 * 1024
const MAX_STATE_BYTES = MAX_DIFF_BYTES * 3
const FULL_SHA = /^[a-f0-9]{40}$/i
const API_ORIGIN_FALLBACK = 'https://api.github.com'

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFullSha(value) {
  return typeof value === 'string' && FULL_SHA.test(value)
}

function isCommitSha(value) {
  return isFullSha(value) && !/^0+$/.test(value)
}

function validRepository(value) {
  return typeof value === 'string'
    && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)
    && value.split('/').every(part => part !== '.' && part !== '..')
}

function decodeUtf8(value) {
  return new TextDecoder('utf-8', { fatal: true }).decode(value)
}

/**
 * Parses `git diff --raw --no-renames -z` output without losing unusual filenames.
 * @param {Buffer | Uint8Array} value
 * @returns {Array<{ status: string, path: string, oldMode: string, newMode: string }>}
 */
export function parseRawDiffZ(value) {
  if (!(value instanceof Uint8Array) || value.byteLength === 0 || value.byteLength > MAX_DIFF_BYTES) {
    throw new Error('The Git diff is empty or exceeds its supported size.')
  }

  const bytes = Buffer.from(value)
  if (bytes[bytes.length - 1] !== 0) throw new Error('The Git diff is incomplete.')

  const fields = []
  let start = 0
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 0) {
      fields.push(bytes.subarray(start, index))
      start = index + 1
    }
  }
  if (start !== bytes.length || fields.length === 0) throw new Error('The Git diff is malformed.')

  const changes = []
  for (let index = 0; index < fields.length;) {
    const metadata = decodeUtf8(fields[index] ?? Buffer.alloc(0))
    const match = /^:([0-7]{6}) ([0-7]{6}) ([a-f0-9]{40}|[a-f0-9]{64}) ([a-f0-9]{40}|[a-f0-9]{64}) ([A-Z])$/i.exec(metadata)
    if (!match || !['A', 'D', 'M'].includes(match[5] ?? '')) {
      throw new Error('The Git diff contains an unsupported or malformed change record.')
    }

    const pathBytes = fields[index + 1]
    if (!pathBytes || pathBytes.byteLength === 0) throw new Error('The Git diff has a change without a path.')
    const path = decodeUtf8(pathBytes)
    if (path.length === 0) throw new Error('The Git diff has an empty path.')

    changes.push({
      status: match[5] ?? '',
      path,
      oldMode: match[1] ?? '',
      newMode: match[2] ?? '',
    })
    index += 2
  }

  if (changes.length === 0) throw new Error('The Git diff contains no changes.')
  return changes
}

/**
 * Classifies a complete raw Git diff. Any unsupported, unsafe, or unavailable input is full.
 * @param {Buffer | Uint8Array} diff
 * @returns {'docs' | 'full'}
 */
export function classifyDiff(diff) {
  try {
    const changes = parseRawDiffZ(diff)
    return changes.every(change => isDocumentationPath(change.path)
      && ['000000', '100644'].includes(change.oldMode)
      && ['000000', '100644'].includes(change.newMode)
      && (change.status === 'M'
        ? change.oldMode === '100644' && change.newMode === '100644'
        : change.status === 'A'
          ? change.oldMode === '000000' && change.newMode === '100644'
          : change.oldMode === '100644' && change.newMode === '000000'))
      ? 'docs'
      : 'full'
  } catch {
    return 'full'
  }
}

function exactKeys(value, expected) {
  return isRecord(value)
    && Object.keys(value).length === expected.length
    && expected.every(key => Object.hasOwn(value, key))
}

/**
 * Reads and validates the exact, inert JSON schema used as full qualification evidence.
 * @param {unknown} value
 * @param {{ repository: string, pullRequestNumber: number, baseSha: string, headSha: string, runId: number, runAttempt: number,
 *   workflow: { id: number, path: string, ref: string, blob: string } }} expected
 */
export function isFullWitness(value, expected) {
  if (!exactKeys(value, ['schemaVersion', 'qualification', 'repository', 'pullRequestNumber', 'baseSha', 'headSha', 'runId', 'runAttempt', 'workflow'])) {
    return false
  }
  if (value.schemaVersion !== 1
    || value.qualification !== 'full'
    || value.repository !== expected.repository
    || value.pullRequestNumber !== expected.pullRequestNumber
    || value.baseSha !== expected.baseSha
    || value.headSha !== expected.headSha
    || value.runId !== expected.runId
    || value.runAttempt !== expected.runAttempt
    || !exactKeys(value.workflow, ['id', 'path', 'ref', 'blob'])) {
    return false
  }

  return value.workflow.id === expected.workflow.id
    && value.workflow.path === WORKFLOW_PATH
    && value.workflow.path === expected.workflow.path
    && value.workflow.ref === expected.workflow.ref
    && value.workflow.blob === expected.workflow.blob
    && Number.isSafeInteger(value.workflow.id)
    && value.workflow.id > 0
    && Number.isSafeInteger(value.runAttempt)
    && value.runAttempt > 0
    && Number.isSafeInteger(value.runId)
    && value.runId > 0
    && isCommitSha(value.baseSha)
    && isCommitSha(value.headSha)
    && isCommitSha(value.workflow.blob)
    && typeof value.workflow.ref === 'string'
    && value.workflow.ref.length > 0
    && value.workflow.ref.length <= 512
}

/**
 * Selects the conservative CI mode using complete PR/push diffs and an exact predecessor witness.
 * @param {{ eventName: string, eventAction?: string, repository: string, headRepository: string, pullRequestNumber?: number,
 *   baseSha?: string, headSha?: string, beforeSha?: string, beforeIsAncestor?: boolean, fullDiff: Uint8Array,
 *   commitDiff?: Uint8Array, witness?: unknown, witnessDownloadSucceeded?: boolean,
 *   witnessRunId?: number, witnessRunAttempt?: number,
 *   workflow?: { id: number, path: string, ref: string, blob: string } }} input
 * @returns {'docs' | 'full' | 'reuse'}
 */
export function selectVerificationMode(input) {
  if (!isRecord(input)
    || !['pull_request', 'push'].includes(input.eventName)
    || !validRepository(input.repository)) {
    return 'full'
  }

  if (input.eventName === 'pull_request'
    && (!validRepository(input.headRepository)
      || !Number.isSafeInteger(input.pullRequestNumber)
      || input.pullRequestNumber <= 0
      || !isCommitSha(input.baseSha)
      || !isCommitSha(input.headSha))) {
    return 'full'
  }

  try {
    parseRawDiffZ(input.fullDiff)
  } catch {
    return 'full'
  }

  if (input.eventName === 'push') {
    return classifyDiff(input.fullDiff) === 'docs'
      && isCommitSha(input.beforeSha)
      && isCommitSha(input.headSha)
      ? 'docs'
      : 'full'
  }

  if (classifyDiff(input.fullDiff) === 'docs') return 'docs'
  if (input.headRepository !== input.repository
    || input.eventAction !== 'synchronize'
    || !Number.isSafeInteger(input.pullRequestNumber)
    || !isCommitSha(input.baseSha)
    || !isCommitSha(input.headSha)
    || !isCommitSha(input.beforeSha)
    || input.beforeIsAncestor !== true
    || classifyDiff(input.commitDiff) !== 'docs'
    || input.witnessDownloadSucceeded !== true
    || !isRecord(input.workflow)) {
    return 'full'
  }

  const expected = {
    repository: input.repository,
    pullRequestNumber: input.pullRequestNumber,
    baseSha: input.baseSha,
    headSha: input.beforeSha,
    runId: input.witnessRunId,
    runAttempt: input.witnessRunAttempt,
    workflow: input.workflow,
  }
  return isFullWitness(input.witness, expected) ? 'reuse' : 'full'
}

const QUALITY_REQUIRED_JOBS = Object.freeze({
  full: Object.freeze(['checks', 'browserSmoke', 'browser', 'previewWhenRequired']),
  docs: Object.freeze(['docs']),
  reuse: Object.freeze(['docs', 'predecessorWitness']),
})

/** Returns the job classes required for a CI mode. */
export function requiredQualityJobs(mode) {
  return QUALITY_REQUIRED_JOBS[mode] ?? null
}

/**
 * Evaluates the explicit job-result matrix consumed by the required quality gate.
 * @param {{ mode: string, verification: string, checks: string, docs: string, preview: string, previewRequired: boolean,
 *   browserSmoke: string, browser: string, witness: boolean }} results
 */
export function evaluateQualityGate(results) {
  if (!isRecord(results) || !Object.hasOwn(QUALITY_REQUIRED_JOBS, results.mode)) {
    return { success: false, reason: 'Verification mode is missing or unsupported.' }
  }
  if (results.verification !== 'success') {
    return { success: false, reason: `Verification classification did not succeed: ${results.verification}.` }
  }
  const mode = results.mode
  if (mode === 'docs') {
    const fullJobsSkipped = results.checks === 'skipped'
      && results.preview === 'skipped'
      && results.browserSmoke === 'skipped'
      && results.browser === 'skipped'
    return results.docs === 'success' && fullJobsSkipped
      ? { success: true, reason: 'Documentation checks passed.' }
      : { success: false, reason: results.docs !== 'success'
        ? `Documentation checks did not succeed: ${results.docs}.`
        : 'Full qualification jobs were expected to be skipped for documentation mode.' }
  }
  if (mode === 'reuse') {
    if (results.docs !== 'success') {
      return { success: false, reason: `Documentation checks did not succeed: ${results.docs}.` }
    }
    if (results.checks !== 'skipped' || results.preview !== 'skipped'
      || results.browserSmoke !== 'skipped' || results.browser !== 'skipped') {
      return { success: false, reason: 'Full qualification jobs were expected to be skipped for reuse mode.' }
    }
    return results.witness === true
      ? { success: true, reason: 'Documentation checks and direct predecessor full witness passed.' }
      : { success: false, reason: 'The direct predecessor full witness was not validated.' }
  }

  if (results.docs !== 'skipped') return { success: false, reason: 'Documentation-only job was expected to be skipped for full mode.' }
  if (results.checks !== 'success') return { success: false, reason: `Full checks did not succeed: ${results.checks}.` }
  if (results.previewRequired ? results.preview !== 'success' : results.preview !== 'skipped') {
    return { success: false, reason: `Vercel Preview resolution result was unexpected: ${results.preview}.` }
  }
  if (results.browserSmoke !== 'success') {
    return { success: false, reason: `Preview smoke did not succeed: ${results.browserSmoke}.` }
  }
  if (results.browser !== 'success') return { success: false, reason: `Browser shards did not succeed: ${results.browser}.` }
  return { success: true, reason: 'Full CI checks passed.' }
}

function apiOrigin() {
  const value = process.env.GITHUB_API_URL ?? API_ORIGIN_FALLBACK
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('GitHub API URL is invalid.')
  }
  return url.origin
}

/** @param {string} path @param {string} token */
async function githubJson(path, token) {
  const base = new URL(process.env.GITHUB_API_URL ?? API_ORIGIN_FALLBACK)
  const url = new URL(path.replace(/^\//, ''), `${apiOrigin()}${base.pathname.replace(/\/$/, '')}/`)
  let response
  try {
    response = await fetch(url, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
      },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    throw new Error('GitHub Actions API request failed.', { cause: error })
  }
  if (!response.ok) throw new Error(`GitHub Actions API returned HTTP ${response.status}.`)
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isSafeInteger(declaredLength) && declaredLength > MAX_API_BODY_BYTES) {
    throw new Error('GitHub Actions API response exceeded its size limit.')
  }
  const body = await response.text()
  if (Buffer.byteLength(body, 'utf8') > MAX_API_BODY_BYTES) {
    throw new Error('GitHub Actions API response exceeded its size limit.')
  }
  try {
    return JSON.parse(body)
  } catch {
    throw new Error('GitHub Actions API returned malformed JSON.')
  }
}

function workflowPathFromRun(run) {
  if (typeof run.path !== 'string') return undefined
  return run.path.split('@', 1)[0]
}

function workflowIdentityFromRun(run, workflowRef, workflowBlob) {
  const path = workflowPathFromRun(run)
  if (!Number.isSafeInteger(run.workflow_id)
    || run.workflow_id <= 0
    || path !== WORKFLOW_PATH
    || !isCommitSha(workflowBlob)
    || typeof workflowRef !== 'string'
    || workflowRef.length === 0
    || workflowRef.length > 512) {
    throw new Error('Current workflow identity is unavailable or invalid.')
  }
  return { id: run.workflow_id, path, ref: workflowRef, blob: workflowBlob }
}

function pullRequestIncludesNumber(run, pullRequestNumber) {
  if (!Array.isArray(run.pull_requests)) return false
  return run.pull_requests.some(pr => isRecord(pr) && pr.number === pullRequestNumber)
}

/** Validates one successful full-run candidate for the exact PR head, base, and workflow. */
export function isReusablePredecessorRun(run, expected) {
  return isRecord(run)
    && Number.isSafeInteger(run.id)
    && run.id > 0
    && Number.isSafeInteger(run.run_attempt)
    && run.run_attempt > 0
    && run.workflow_id === expected.workflow.id
    && workflowPathFromRun(run) === WORKFLOW_PATH
    && run.event === 'pull_request'
    && run.head_sha === expected.predecessorSha
    && run.status === 'completed'
    && run.conclusion === 'success'
    && isRecord(run.head_repository)
    && run.head_repository.full_name === expected.repository
    && isRecord(run.repository)
    && run.repository.full_name === expected.repository
    && pullRequestIncludesNumber(run, expected.pullRequestNumber)
}

/** Validates the exact run-attempt proof artifact metadata before the official downloader is called. */
export function isReusableWitnessArtifact(artifact, runAttempt) {
  return isRecord(artifact)
    && artifact.name === `${PROOF_ARTIFACT_PREFIX}${runAttempt}`
    && artifact.expired === false
    && Number.isSafeInteger(artifact.id)
    && artifact.id > 0
    && Number.isSafeInteger(artifact.size_in_bytes)
    && artifact.size_in_bytes > 0
    && artifact.size_in_bytes <= MAX_PROOF_BYTES
    && Number.isSafeInteger(runAttempt)
    && runAttempt > 0
}

/** @param {{ repository: string, pullRequestNumber: number, baseSha: string, headSha: string,
 *   workflowRef: string, workflowBlob: string, runId: number, runAttempt: number, token: string }} input */
async function currentWorkflowIdentity(input) {
  const [owner, repo] = input.repository.split('/')
  const current = await githubJson(`/repos/${owner}/${repo}/actions/runs/${input.runId}`, input.token)
  if (!isRecord(current) || current.id !== input.runId) throw new Error('Current workflow run is unavailable.')
  if (current.event !== 'pull_request'
    || current.head_sha !== input.headSha
    || current.run_attempt !== input.runAttempt
    || !isRecord(current.repository)
    || current.repository.full_name !== input.repository
    || !isRecord(current.head_repository)
    || current.head_repository.full_name !== input.repository
    || !pullRequestIncludesNumber(current, input.pullRequestNumber)) {
    throw new Error('Current workflow run does not match the exact same-repository pull request.')
  }
  return workflowIdentityFromRun(current, input.workflowRef, input.workflowBlob)
}

/**
 * Finds one artifact on one successful run for the exact direct predecessor; it never searches ancestors.
 * @param {Parameters<typeof currentWorkflowIdentity>[0] & { predecessorSha: string,
 *   workflow: { id: number, path: string, ref: string, blob: string } }} input
 */
async function findPredecessorArtifact(input) {
  const [owner, repo] = input.repository.split('/')
  const workflow = input.workflow

  const runsBody = await githubJson(
    `/repos/${owner}/${repo}/actions/workflows/${workflow.id}/runs?head_sha=${input.predecessorSha}&event=pull_request&per_page=100`,
    input.token,
  )
  if (!isRecord(runsBody) || !Array.isArray(runsBody.workflow_runs)) {
    throw new Error('Predecessor workflow runs are unavailable.')
  }
  const eligibleRuns = runsBody.workflow_runs
    .filter(run => isReusablePredecessorRun(run, {
      repository: input.repository,
      pullRequestNumber: input.pullRequestNumber,
      baseSha: input.baseSha,
      predecessorSha: input.predecessorSha,
      workflow,
    }))
    .sort((left, right) => Number(right.id) - Number(left.id))
    .slice(0, 10)

  for (const run of eligibleRuns) {
    const artifactsBody = await githubJson(
      `/repos/${owner}/${repo}/actions/runs/${run.id}/artifacts?per_page=100`,
      input.token,
    )
    if (!isRecord(artifactsBody) || !Array.isArray(artifactsBody.artifacts)) continue
    const matches = artifactsBody.artifacts.filter(artifact => isReusableWitnessArtifact(artifact, run.run_attempt))
    if (matches.length !== 1) continue

    const artifact = matches[0]
    return {
      runId: run.id,
      artifactId: artifact.id,
      runAttempt: run.run_attempt,
      workflow,
    }
  }
  throw new Error('No successful direct-predecessor full witness artifact was found.')
}

function envSha(name) {
  const value = process.env[name]
  return isCommitSha(value) ? value : undefined
}

/** Run git using separate arguments so path data never passes through a shell. */
function gitBuffer(args) {
  return execFileSync('git', args, { encoding: 'buffer', maxBuffer: MAX_DIFF_BYTES })
}

function ensureCommit(sha) {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' })
    return
  } catch {
    const server = new URL(process.env.GITHUB_SERVER_URL ?? 'https://github.com')
    if (server.protocol !== 'https:' || server.username || server.password || server.search || server.hash
      || !validRepository(process.env.GITHUB_REPOSITORY)) {
      throw new Error('The exact base commit is unavailable and cannot be fetched safely.')
    }
    const remote = new URL(`${process.env.GITHUB_REPOSITORY}.git`, `${server.origin}/`).toString()
    const args = ['fetch', '--no-tags', remote, sha]
    const gitEnvironment = { ...process.env }
    const token = process.env.GITHUB_TOKEN
    if (token) {
      const authorization = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64')
      gitEnvironment.VERIFICATION_GIT_AUTH = `AUTHORIZATION: basic ${authorization}`
      args.unshift('--config-env=http.extraheader=VERIFICATION_GIT_AUTH')
    }
    try {
      execFileSync('git', args, { stdio: 'ignore', maxBuffer: MAX_DIFF_BYTES, env: gitEnvironment })
      execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' })
    } catch {
      throw new Error('The exact base commit is unavailable.')
    }
  }
}

function outputValue(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error(`${label} is not safe for a GitHub Actions output.`)
  }
  return value
}

async function appendOutput(entries) {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) throw new Error('GITHUB_OUTPUT is unavailable.')
  const lines = Object.entries(entries).map(([key, value]) => `${outputValue(key, 'Output name')}=${outputValue(value, key)}\n`)
  await appendFile(outputPath, lines.join(''), 'utf8')
}

function logFallback(reason) {
  const safeReason = typeof reason === 'string' ? reason.replace(/[\r\n]/g, ' ').slice(0, 180) : 'unavailable data'
  console.log(`Prior full qualification reuse unavailable; selecting full mode (${safeReason}).`)
}

function workflowBlobAt(commitSha) {
  const blob = decodeUtf8(gitBuffer(['rev-parse', `${commitSha}:${WORKFLOW_PATH}`])).trim()
  if (!isFullSha(blob)) throw new Error('The workflow file blob is unavailable.')
  return blob
}

function isAncestor(beforeSha, headSha) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', beforeSha, headSha], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function decodeStoredDiff(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_DIFF_BYTES * 4 / 3)) {
    throw new Error('Stored Git diff is unavailable or exceeds its supported size.')
  }
  const diff = Buffer.from(value, 'base64')
  if (diff.byteLength > MAX_DIFF_BYTES || diff.toString('base64') !== value) {
    throw new Error('Stored Git diff is malformed.')
  }
  return diff
}

async function saveVerificationState(state) {
  const path = process.env.VERIFICATION_STATE_PATH
  if (!path) throw new Error('Verification state path is unavailable.')
  const contents = `${JSON.stringify(state)}\n`
  if (Buffer.byteLength(contents, 'utf8') > MAX_STATE_BYTES) {
    throw new Error('Verification state exceeded its size limit.')
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents, { encoding: 'utf8', flag: 'w' })
}

async function readVerificationState() {
  const path = process.env.VERIFICATION_STATE_PATH
  if (!path) throw new Error('Verification state path is unavailable.')
  const info = await lstat(path)
  if (!info.isFile() || info.size === 0 || info.size > MAX_STATE_BYTES) {
    throw new Error('Verification state file is invalid.')
  }
  const state = JSON.parse(await readFile(path, 'utf8'))
  if (!isRecord(state) || state.schemaVersion !== 1) throw new Error('Verification state is malformed.')
  return {
    state,
    fullDiff: decodeStoredDiff(state.fullDiffBase64),
    commitDiff: decodeStoredDiff(state.commitDiffBase64),
  }
}

async function prepareMode() {
  const eventName = process.env.GITHUB_EVENT_NAME ?? ''
  const repository = process.env.GITHUB_REPOSITORY ?? ''
  const headSha = envSha('VERIFICATION_HEAD_SHA')
  const baseSha = envSha('VERIFICATION_BASE_SHA')
  const beforeSha = envSha('VERIFICATION_BEFORE_SHA')
  const state = {
    schemaVersion: 1,
    eventName,
    eventAction: process.env.VERIFICATION_EVENT_ACTION ?? '',
    repository,
    headRepository: process.env.VERIFICATION_HEAD_REPOSITORY ?? repository,
    pullRequestNumber: Number(process.env.VERIFICATION_PR_NUMBER),
    baseSha,
    headSha,
    beforeSha,
    beforeIsAncestor: false,
    fullDiffBase64: '',
    commitDiffBase64: '',
    workflow: undefined,
  }
  let candidate = undefined

  if (eventName === 'push' && headSha && isCommitSha(process.env.VERIFICATION_BEFORE_SHA)) {
    try {
      ensureCommit(process.env.VERIFICATION_BEFORE_SHA)
      const diff = gitBuffer(['diff', '--raw', '--no-renames', '--no-abbrev', '-z', process.env.VERIFICATION_BEFORE_SHA, headSha])
      state.fullDiffBase64 = diff.toString('base64')
    } catch {
      state.fullDiffBase64 = ''
    }
  } else if (eventName === 'pull_request' && headSha && baseSha && validRepository(repository)) {
    try {
      ensureCommit(headSha)
      ensureCommit(baseSha)
      const fullDiff = gitBuffer(['diff', '--raw', '--no-renames', '--no-abbrev', '-z', baseSha, headSha])
      state.fullDiffBase64 = fullDiff.toString('base64')
      if (classifyDiff(fullDiff) === 'full' && state.headRepository === repository) {
        const token = process.env.GITHUB_TOKEN
        const pullRequestNumber = Number(process.env.VERIFICATION_PR_NUMBER)
        const workflowRef = process.env.VERIFICATION_WORKFLOW_REF
        const workflowBlob = workflowBlobAt(headSha)
        const runId = Number(process.env.GITHUB_RUN_ID)
        const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT)
        let workflow
        if (token && Number.isSafeInteger(pullRequestNumber) && pullRequestNumber > 0
          && workflowRef && Number.isSafeInteger(runId) && runId > 0
          && Number.isSafeInteger(runAttempt) && runAttempt > 0) {
          try {
            workflow = await currentWorkflowIdentity({
              repository,
              pullRequestNumber,
              baseSha,
              headSha,
              workflowRef,
              workflowBlob,
              runId,
              runAttempt,
              token,
            })
            state.workflow = workflow
          } catch (error) {
            logFallback(error instanceof Error ? error.message : 'current workflow API data unavailable')
          }
        }
        if (state.eventAction === 'synchronize' && beforeSha && isCommitSha(headSha)) {
          try {
            ensureCommit(beforeSha)
            state.beforeIsAncestor = isAncestor(beforeSha, headSha)
            if (state.beforeIsAncestor) {
              const commitDiff = gitBuffer(['diff', '--raw', '--no-renames', '--no-abbrev', '-z', beforeSha, headSha])
              state.commitDiffBase64 = commitDiff.toString('base64')
              if (classifyDiff(fullDiff) !== 'docs' && classifyDiff(commitDiff) === 'docs' && workflow) {
                candidate = await findPredecessorArtifact({
                  repository,
                  pullRequestNumber,
                  baseSha,
                  headSha,
                  predecessorSha: beforeSha,
                  workflowRef,
                  workflowBlob,
                  runId,
                  runAttempt,
                  token,
                  workflow,
                })
              }
            }
          } catch (error) {
            logFallback(error instanceof Error ? error.message : 'synchronize delta unavailable')
            state.beforeIsAncestor = false
          }
        }
      }
    } catch {
      state.fullDiffBase64 = ''
      state.commitDiffBase64 = ''
      state.beforeIsAncestor = false
    }
  }

  await saveVerificationState(state)

  const entries = { candidate: candidate ? 'true' : 'false' }
  if (candidate) {
    entries.candidate_artifact_id = String(candidate.artifactId)
    entries.candidate_run_attempt = String(candidate.runAttempt)
    entries.candidate_run_id = String(candidate.runId)
  }
  if (state.workflow) {
    entries.workflow_id = String(state.workflow.id)
    entries.workflow_blob = state.workflow.blob
  }
  await appendOutput(entries)
}

async function finalizeMode() {
  let prepared
  try {
    prepared = await readVerificationState()
  } catch (error) {
    logFallback(error instanceof Error ? error.message : 'verification state unavailable')
    await appendOutput({ mode: 'full', witness_valid: 'false' })
    return
  }

  let witness = undefined
  let witnessRunId = undefined
  let witnessRunAttempt = undefined
  const candidate = process.env.VERIFICATION_CANDIDATE === 'true'
  if (candidate) {
    try {
      if (process.env.VERIFICATION_DOWNLOAD_OUTCOME !== 'success') {
        throw new Error('The validated witness artifact download did not succeed.')
      }
      const filePath = process.env.VERIFICATION_WITNESS_PATH
      if (!filePath) throw new Error('Downloaded witness path is unavailable.')
      const fileInfo = await lstat(filePath)
      if (!fileInfo.isFile() || fileInfo.size === 0 || fileInfo.size > MAX_PROOF_BYTES) {
        throw new Error('Downloaded witness size is invalid.')
      }
      const proofText = await readFile(filePath, 'utf8')
      witness = JSON.parse(proofText)
      witnessRunId = Number(process.env.VERIFICATION_PARENT_RUN_ID)
      witnessRunAttempt = Number(process.env.VERIFICATION_PARENT_RUN_ATTEMPT)
    } catch (error) {
      logFallback(error instanceof Error ? error.message : 'artifact validation failed')
    }
  }

  const state = prepared.state
  const mode = selectVerificationMode({
    eventName: state.eventName,
    eventAction: state.eventAction,
    repository: state.repository,
    headRepository: state.headRepository,
    pullRequestNumber: state.pullRequestNumber,
    baseSha: state.baseSha,
    headSha: state.headSha,
    beforeSha: state.beforeSha,
    beforeIsAncestor: state.beforeIsAncestor,
    fullDiff: prepared.fullDiff,
    commitDiff: prepared.commitDiff,
    witness,
    witnessDownloadSucceeded: process.env.VERIFICATION_DOWNLOAD_OUTCOME === 'success' && witness !== undefined,
    witnessRunId,
    witnessRunAttempt,
    workflow: state.workflow,
  })
  await appendOutput({ mode, witness_valid: mode === 'reuse' ? 'true' : 'false' })
}

async function writeWitness() {
  const workflowId = Number(process.env.CI_WORKFLOW_ID)
  const pullRequestNumber = Number(process.env.CI_PR_NUMBER)
  const proof = {
    schemaVersion: 1,
    qualification: 'full',
    repository: process.env.GITHUB_REPOSITORY,
    pullRequestNumber,
    baseSha: process.env.CI_BASE_SHA,
    headSha: process.env.CI_HEAD_SHA,
    runId: Number(process.env.CI_RUN_ID),
    runAttempt: Number(process.env.CI_RUN_ATTEMPT),
    workflow: {
      id: workflowId,
      path: WORKFLOW_PATH,
      ref: process.env.VERIFICATION_WORKFLOW_REF,
      blob: process.env.CI_WORKFLOW_BLOB,
    },
  }
  if (!isFullWitness(proof, proof)) throw new Error('Refusing to write an invalid full CI witness.')
  const filePath = resolve(process.env.CI_WITNESS_OUTPUT ?? PROOF_NAME)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(proof)}\n`, { encoding: 'utf8', flag: 'wx' })
}

function qualityFromEnvironment() {
  const result = evaluateQualityGate({
    mode: process.env.QUALITY_MODE,
    verification: process.env.QUALITY_VERIFICATION_RESULT,
    checks: process.env.QUALITY_CHECKS_RESULT,
    docs: process.env.QUALITY_DOCS_RESULT,
    preview: process.env.QUALITY_PREVIEW_RESULT,
    previewRequired: process.env.QUALITY_PREVIEW_REQUIRED === 'true',
    browserSmoke: process.env.QUALITY_SMOKE_RESULT,
    browser: process.env.QUALITY_BROWSER_RESULT,
    witness: process.env.QUALITY_WITNESS_VALID === 'true',
  })
  console.log(result.reason)
  if (!result.success) process.exitCode = 1
}

async function main(command) {
  if (command === 'prepare') return prepareMode()
  if (command === 'finalize') return finalizeMode()
  if (command === 'write-witness') return writeWitness()
  if (command === 'quality') return qualityFromEnvironment()
  throw new Error('Usage: verification.mjs <prepare|finalize|write-witness|quality>')
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main(process.argv[2] ?? '').catch(error => {
    console.error(error instanceof Error ? error.message : 'Verification mode selection failed.')
    process.exitCode = 1
  })
}

export const verificationInternals = Object.freeze({
  workflowPath: WORKFLOW_PATH,
  proofArtifactPrefix: PROOF_ARTIFACT_PREFIX,
  maxProofBytes: MAX_PROOF_BYTES,
})
