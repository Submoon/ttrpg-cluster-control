import { appendFile } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import { pathToFileURL } from 'node:url'

const GITHUB_API_ORIGIN = 'https://api.github.com'
const VERCEL_BOT_LOGIN = 'vercel[bot]'
const POLL_INTERVAL_MS = 5_000
const PREVIEW_HOSTNAME = /^ttrpg-cluster-control-[a-z0-9]+-submoon\.vercel\.app$/
const FULL_GIT_SHA = /^[a-f0-9]{40}$/i

/**
 * Validates a stable, immutable Vercel preview URL for this project.
 * @param {string} value URL supplied by Vercel or workflow configuration.
 * @returns {URL} Parsed URL on the trusted deployment host.
 */
export function validatePreviewUrl(value) {
  if (typeof value !== 'string' || value.trim() !== value || /[\r\n?#]/.test(value)) {
    throw new Error('Preview URL must be a clean HTTPS URL on the immutable Vercel preview host.')
  }

  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('Preview URL must be a clean HTTPS URL on the immutable Vercel preview host.')
  }

  const rawAuthority = value.match(/^https:\/\/([^/?#]*)/i)?.[1]
  if (url.protocol !== 'https:'
    || !rawAuthority
    || rawAuthority !== url.hostname
    || url.username !== ''
    || url.password !== ''
    || url.port !== ''
    || url.search !== ''
    || url.hash !== ''
    || !PREVIEW_HOSTNAME.test(url.hostname)) {
    throw new Error('Preview URL must be a clean HTTPS URL on the immutable Vercel preview host.')
  }

  return url
}

/** @param {unknown} value */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** @param {{ created_at?: unknown, id?: unknown }} left @param {{ created_at?: unknown, id?: unknown }} right */
function newestFirst(left, right) {
  const leftTime = typeof left.created_at === 'string' ? Date.parse(left.created_at) : 0
  const rightTime = typeof right.created_at === 'string' ? Date.parse(right.created_at) : 0
  const leftTimestamp = Number.isFinite(leftTime) ? leftTime : 0
  const rightTimestamp = Number.isFinite(rightTime) ? rightTime : 0
  if (leftTimestamp !== rightTimestamp) return rightTimestamp - leftTimestamp

  const leftId = typeof left.id === 'number' ? left.id : 0
  const rightId = typeof right.id === 'number' ? right.id : 0
  return rightId - leftId
}

function timeoutError() {
  return new Error('Timed out waiting for a successful Vercel Preview deployment.')
}

/** @param {string | URL} url @param {typeof fetch} fetchImpl @param {number} deadline */
async function fetchJson(url, fetchImpl, deadline) {
  const remainingMs = deadline - Date.now()
  if (remainingMs <= 0) throw timeoutError()

  let response
  try {
    response = await fetchImpl(url, {
      headers: {
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
      signal: AbortSignal.timeout(Math.max(1, Math.ceil(remainingMs))),
    })
  } catch (error) {
    if (Date.now() >= deadline || (isRecord(error) && error.name === 'TimeoutError')) {
      throw timeoutError()
    }
    throw new Error('GitHub API request failed before the Vercel Preview could be verified.', { cause: error })
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(`GitHub API denied access while resolving the Vercel Preview (HTTP ${response.status}).`)
  }
  if (!response.ok) {
    throw new Error(`GitHub API request failed while resolving the Vercel Preview (HTTP ${response.status}).`)
  }

  let body
  try {
    body = await response.json()
  } catch {
    throw new Error('GitHub API returned an invalid response while resolving the Vercel Preview.')
  }
  if (Date.now() >= deadline) throw timeoutError()
  return body
}

/** @param {number} milliseconds */
function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

/**
 * Polls GitHub's deployment API for the newest Vercel Preview created for one exact commit.
 * A newer failed deployment is authoritative; the resolver never falls back to an older success.
 * @param {{ repository: string, headSha: string, timeoutMs: number, fetch: typeof globalThis.fetch }} options
 * @returns {Promise<{ deploymentId: number, sha: string, url: string }>}
 */
export async function resolvePreview({ repository, headSha, timeoutMs, fetch: fetchImpl }) {
  if (typeof repository !== 'string'
    || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)
    || repository.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('GitHub repository must use the owner/repository form.')
  }
  if (typeof headSha !== 'string' || !FULL_GIT_SHA.test(headSha)) {
    throw new Error('A full 40-character commit SHA is required to resolve the Vercel Preview.')
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Preview resolution timeout must be a positive finite number of milliseconds.')
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required to resolve the Vercel Preview.')
  }

  const [owner, repositoryName] = repository.split('/')
  const deadline = Date.now() + timeoutMs
  const deploymentsUrl = new URL(`/repos/${owner}/${repositoryName}/deployments`, GITHUB_API_ORIGIN)
  deploymentsUrl.searchParams.set('sha', headSha)
  deploymentsUrl.searchParams.set('per_page', '100')

  while (true) {
    const deployments = await fetchJson(deploymentsUrl, fetchImpl, deadline)
    if (!Array.isArray(deployments)) {
      throw new Error('GitHub API returned an invalid deployments list.')
    }

    const matching = deployments.filter(deployment => isRecord(deployment)
      && typeof deployment.sha === 'string'
      && deployment.sha.toLowerCase() === headSha.toLowerCase()
      && typeof deployment.environment === 'string'
      && deployment.environment.toLowerCase() === 'preview')
    matching.sort(newestFirst)

    const deployment = matching[0]
    if (deployment) {
      if (!isRecord(deployment.creator) || deployment.creator.login !== VERCEL_BOT_LOGIN) {
        throw new Error('The newest matching Preview deployment was not created by vercel[bot].')
      }
      if (!Number.isSafeInteger(deployment.id) || deployment.id <= 0) {
        throw new Error('The newest matching Preview deployment has an invalid deployment ID.')
      }

      const statusesUrl = new URL(
        `/repos/${owner}/${repositoryName}/deployments/${deployment.id}/statuses`,
        GITHUB_API_ORIGIN,
      )
      statusesUrl.searchParams.set('per_page', '100')
      const statuses = await fetchJson(statusesUrl, fetchImpl, deadline)
      if (!Array.isArray(statuses)) {
        throw new Error('GitHub API returned an invalid deployment status list.')
      }

      const newestStatus = statuses.filter(isRecord).sort(newestFirst)[0]
      if (newestStatus) {
        if (!isRecord(newestStatus.creator) || newestStatus.creator.login !== VERCEL_BOT_LOGIN) {
          throw new Error('The newest Preview deployment status was not created by vercel[bot].')
        }

        const state = newestStatus.state
        if (state === 'success') {
          if (typeof newestStatus.environment_url !== 'string') {
            throw new Error('Vercel reported success without a Preview environment URL.')
          }
          let url
          try {
            url = validatePreviewUrl(newestStatus.environment_url)
          } catch {
            throw new Error('Vercel returned a Preview URL outside the trusted immutable project domain.')
          }
          return {
            deploymentId: deployment.id,
            sha: deployment.sha,
            url: url.toString(),
          }
        }
        if (['error', 'failure', 'inactive', 'canceled', 'cancelled'].includes(String(state))) {
          throw new Error(`The newest Vercel Preview deployment finished with state "${String(state)}".`)
        }
      }
    }

    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) throw timeoutError()
    await delay(Math.min(POLL_INTERVAL_MS, remainingMs))
  }
}

/** Runs the GitHub Actions CLI entry point. Credentials are used only by this process and never logged. */
async function runCli() {
  const token = process.env.GITHUB_TOKEN
  const repository = process.env.GITHUB_REPOSITORY
  const headSha = process.env.VERCEL_PREVIEW_HEAD_SHA
  const outputPath = process.env.GITHUB_OUTPUT
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!token || !repository || !headSha || !outputPath || !summaryPath) {
    throw new Error('Missing GitHub Actions environment needed to resolve the Vercel Preview.')
  }

  const result = await resolvePreview({
    repository,
    headSha,
    timeoutMs: Number(process.env.VERCEL_PREVIEW_TIMEOUT_MS ?? 600_000),
    fetch: (input, init = {}) => {
      const headers = new Headers(init.headers)
      headers.set('authorization', `Bearer ${token}`)
      return globalThis.fetch(input, { ...init, headers })
    },
  })

  await appendFile(outputPath,
    `deployment_id=${result.deploymentId}\nsha=${result.sha}\npreview_url=${result.url}\n`,
    'utf8',
  )
  await appendFile(summaryPath,
    `## Vercel Preview\n\n- Deployment: ${result.deploymentId}\n- Commit: ${result.sha}\n- URL: ${result.url}\n`,
    'utf8',
  )
  console.log(`Resolved Vercel Preview deployment ${result.deploymentId} for ${result.sha}: ${result.url}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolvePath(process.argv[1])).href) {
  runCli().catch(error => {
    console.error(error instanceof Error ? error.message : 'Vercel Preview resolution failed.')
    process.exitCode = 1
  })
}
