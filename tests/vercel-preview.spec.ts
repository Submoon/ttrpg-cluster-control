import { expect, test } from '@playwright/test'
import { resolvePreview, validatePreviewUrl } from '../scripts/ci/vercel-preview.mjs'

const repository = 'submoon/ttrpg-cluster-control'
const headSha = 'c366660c00000000000000000000000000000000'
const previewUrl = 'https://ttrpg-cluster-control-9vz4ptklt-submoon.vercel.app'
const vercelBot = { login: 'vercel[bot]' }

interface Deployment {
  id: number | string
  sha: string
  environment: string
  created_at: string
  creator: { login: string }
}

interface DeploymentStatus {
  id: number
  state: string
  created_at: string
  creator: { login: string }
  environment_url?: string
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function mockFetch(handler: (url: URL) => Response): typeof globalThis.fetch {
  return async input => {
    const url = input instanceof Request ? new URL(input.url) : new URL(String(input))
    return handler(url)
  }
}

function deployment(
  id: number | string,
  createdAt: string,
  changes: Partial<Omit<Deployment, 'id' | 'created_at'>> = {},
): Deployment {
  return {
    id,
    sha: headSha,
    environment: 'Preview',
    created_at: createdAt,
    creator: vercelBot,
    ...changes,
  }
}

function successfulStatus(createdAt: string, changes: Partial<DeploymentStatus> = {}): DeploymentStatus {
  return {
    id: 1,
    state: 'success',
    created_at: createdAt,
    creator: vercelBot,
    environment_url: previewUrl,
    ...changes,
  }
}

test.describe('Vercel preview resolver @pure', { tag: '@pure' }, () => {
  test('accepts only immutable trusted HTTPS preview URLs', () => {
    const trusted = validatePreviewUrl(previewUrl)
    expect(trusted.hostname).toBe('ttrpg-cluster-control-9vz4ptklt-submoon.vercel.app')

    const rejected = [
      previewUrl.replace('https:', 'http:'),
      `https://user:secret@${new URL(previewUrl).hostname}`,
      `${previewUrl}:443`,
      `${previewUrl}?token=secret`,
      `${previewUrl}#fragment`,
      'https://ttrpg-cluster-control-git-main-submoon.vercel.app',
      'https://ttrpg-cluster-control-9vz4ptklt-submoon.vercel.app.attacker.example',
    ]
    for (const value of rejected) expect(() => validatePreviewUrl(value)).toThrow()
  })

  test('resolves the newest exact-SHA Preview and verifies its status path and bot identity', async () => {
    const older = deployment(4, '2026-10-25T10:00:00Z')
    const newest = deployment(7_336_669_914, '2026-10-26T10:00:00Z')
    const wrongSha = deployment(90, '2026-10-27T10:00:00Z', { sha: 'a'.repeat(40) })
    const wrongEnvironment = deployment(91, '2026-10-28T10:00:00Z', { environment: 'Production' })
    const paths: string[] = []

    const resolved = await resolvePreview({
      repository,
      headSha,
      timeoutMs: 5_000,
      fetch: mockFetch(url => {
        paths.push(url.pathname)
        if (url.pathname === `/repos/${repository}/deployments`) {
          expect(url.searchParams.get('sha')).toBe(headSha)
          return response([older, wrongSha, wrongEnvironment, newest])
        }
        if (url.pathname === `/repos/${repository}/deployments/${newest.id}/statuses`) {
          return response([successfulStatus('2026-10-26T10:01:00Z')])
        }
        throw new Error(`Unexpected API path: ${url.pathname}`)
      }),
    })

    expect(resolved).toEqual({
      deploymentId: newest.id,
      sha: headSha,
      url: `${previewUrl}/`,
    })
    expect(paths).toEqual([
      `/repos/${repository}/deployments`,
      `/repos/${repository}/deployments/${newest.id}/statuses`,
    ])
  })

  test('fails on the newest failed deployment instead of falling back to an older success', async () => {
    const older = deployment(12, '2026-10-25T10:00:00Z')
    const newest = deployment(13, '2026-10-26T10:00:00Z')
    const statusPaths: string[] = []

    await expect(resolvePreview({
      repository,
      headSha,
      timeoutMs: 5_000,
      fetch: mockFetch(url => {
        if (url.pathname === `/repos/${repository}/deployments`) return response([older, newest])
        statusPaths.push(url.pathname)
        return response([successfulStatus('2026-10-26T10:01:00Z', { state: 'failure' })])
      }),
    })).rejects.toThrow('finished with state "failure"')

    expect(statusPaths).toEqual([`/repos/${repository}/deployments/${newest.id}/statuses`])
  })

  test('rejects a newer matching deployment that was not created by Vercel', async () => {
    const older = deployment(21, '2026-10-25T10:00:00Z')
    const newest = deployment(22, '2026-10-26T10:00:00Z', { creator: { login: 'other-user' } })
    let requestedStatus = false

    await expect(resolvePreview({
      repository,
      headSha,
      timeoutMs: 5_000,
      fetch: mockFetch(url => {
        if (url.pathname === `/repos/${repository}/deployments`) return response([older, newest])
        requestedStatus = true
        return response([successfulStatus('2026-10-26T10:01:00Z')])
      }),
    })).rejects.toThrow('was not created by vercel[bot]')

    expect(requestedStatus).toBe(false)
  })

  test('rejects a latest deployment status authored by another account', async () => {
    const newest = deployment(31, '2026-10-26T10:00:00Z')

    await expect(resolvePreview({
      repository,
      headSha,
      timeoutMs: 5_000,
      fetch: mockFetch(url => url.pathname === `/repos/${repository}/deployments`
        ? response([newest])
        : response([successfulStatus('2026-10-26T10:01:00Z', { creator: { login: 'other-user' } })])),
    })).rejects.toThrow('status was not created by vercel[bot]')
  })

  test('fails immediately when GitHub denies deployment API access', async () => {
    await expect(resolvePreview({
      repository,
      headSha,
      timeoutMs: 5_000,
      fetch: mockFetch(() => response({ message: 'denied' }, 403)),
    })).rejects.toThrow('GitHub API denied access')
  })

  test('times out when no matching Preview deployment appears', async () => {
    let deploymentPolls = 0
    await expect(resolvePreview({
      repository,
      headSha,
      timeoutMs: 10,
      fetch: mockFetch(() => {
        deploymentPolls += 1
        return response([])
      }),
    })).rejects.toThrow('Timed out waiting for a successful Vercel Preview deployment')
    expect(deploymentPolls).toBeGreaterThan(0)
  })
})
