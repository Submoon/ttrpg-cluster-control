import { expect, test } from '@playwright/test'
import {
  acquirePreviewCookies,
  type PreviewCookie,
  type PreviewRequestContextFactory,
} from './vercel-preview-auth'

const previewURL = 'https://ttrpg-cluster-control-a1-submoon.vercel.app/'
const secret = 'test-secret-never-log'

function response(
  status: number,
  url = previewURL,
  headers: Array<{ name: string; value: string }> = [],
) {
  return { status: () => status, url: () => url, headersArray: () => headers }
}

function cookie(domain = 'ttrpg-cluster-control-a1-submoon.vercel.app'): PreviewCookie {
  return {
    name: 'vercel-preview-bypass',
    value: 'in-memory-only',
    domain,
    path: '/',
    expires: -1,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  }
}

test('local mode does not request preview authentication even when a secret exists @pure', async () => {
  let requestCount = 0
  const createContext: PreviewRequestContextFactory = async () => {
    requestCount += 1
    throw new Error('Local mode must not create an API context.')
  }

  await expect(acquirePreviewCookies(undefined, secret, createContext)).resolves.toEqual([])
  expect(requestCount).toBe(0)
})

test('a foreign preview login redirect is rejected before credentials can be forwarded @pure', async () => {
  let disposeCount = 0
  let requestURL = ''
  const createContext: PreviewRequestContextFactory = async options => {
    expect(options.baseURL).toBe(new URL(previewURL).origin)
    expect(options.maxRedirects).toBe(0)
    expect(options.extraHTTPHeaders).toEqual({
      'x-vercel-protection-bypass': secret,
      'x-vercel-set-bypass-cookie': 'true',
    })
    return {
      get: async (url, options) => {
        requestURL = url
        expect(options.maxRedirects).toBe(0)
        return response(302, previewURL, [{ name: 'Location', value: 'https://vercel.com/login' }])
      },
      cookies: async () => {
        throw new Error('Cookies must not be read after a foreign redirect.')
      },
      dispose: async () => { disposeCount += 1 },
    }
  }

  let failure: Error | undefined
  try {
    await acquirePreviewCookies(previewURL, secret, createContext)
  } catch (error) {
    failure = error as Error
  }
  expect(failure?.message).toContain('Could not authenticate')
  expect(failure?.message).not.toContain(secret)
  expect(requestURL).toBe(previewURL)
  expect(disposeCount).toBe(1)
})

test('a broad-domain bypass cookie is rejected and its request context is disposed @pure', async () => {
  let disposeCount = 0
  const createContext: PreviewRequestContextFactory = async () => ({
    get: async () => response(302, previewURL, [
      { name: 'Location', value: '/' },
      { name: 'Set-Cookie', value: 'bypass=value; Domain=.vercel.app; Path=/; Secure' },
    ]),
    cookies: async () => [cookie()],
    dispose: async () => { disposeCount += 1 },
  })

  await expect(acquirePreviewCookies(previewURL, secret, createContext))
    .rejects.toThrow('Could not authenticate')
  expect(disposeCount).toBe(1)
})

test('a valid host-scoped bypass cookie is returned in memory after disposing the request context @pure', async () => {
  const validCookie = cookie()
  let disposeCount = 0
  let requestCount = 0
  const createContext: PreviewRequestContextFactory = async options => {
    expect(options.maxRedirects).toBe(0)
    return {
      get: async () => {
        requestCount += 1
        return response(302, previewURL, [
          { name: 'Location', value: '/' },
          {
            name: 'Set-Cookie',
            value: 'vercel-preview-bypass=in-memory-only; Domain=ttrpg-cluster-control-a1-submoon.vercel.app; Path=/; Secure; HttpOnly',
          },
        ])
      },
      cookies: async origin => {
        expect(origin).toBe(new URL(previewURL).origin)
        return [validCookie]
      },
      dispose: async () => { disposeCount += 1 },
    }
  }

  const cookies = await acquirePreviewCookies(previewURL, secret, createContext)
  expect(cookies).toEqual([validCookie])
  expect(requestCount).toBe(1)
  expect(disposeCount).toBe(1)
})

test('failed preview authentication reports a redacted error @pure', async () => {
  let disposeCount = 0
  const createContext: PreviewRequestContextFactory = async () => ({
    get: async () => { throw new Error(`request failed with secret ${secret}`) },
    cookies: async () => [],
    dispose: async () => { disposeCount += 1 },
  })

  let failure: Error | undefined
  try {
    await acquirePreviewCookies(previewURL, secret, createContext)
  } catch (error) {
    failure = error as Error
  }
  expect(failure?.message).toContain('Could not authenticate')
  expect(failure?.message).not.toContain(secret)
  expect(disposeCount).toBe(1)
})
