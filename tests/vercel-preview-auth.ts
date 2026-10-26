import { request, type APIRequestContext } from '@playwright/test'
import { validatePreviewUrl } from '../scripts/ci/vercel-preview.mjs'

export type PreviewCookie = Awaited<ReturnType<APIRequestContext['cookies']>>[number]

interface PreviewResponse {
  status(): number
  url(): string
  headersArray(): Array<{ name: string; value: string }>
}

interface PreviewRequestContext {
  get(url: string, options: { maxRedirects: 0 }): Promise<PreviewResponse>
  cookies(urls: string | string[]): Promise<PreviewCookie[]>
  dispose(): Promise<void>
}

export interface PreviewRequestContextOptions {
  baseURL: string
  extraHTTPHeaders: Record<string, string>
  maxRedirects: 0
}

export type PreviewRequestContextFactory = (
  options: PreviewRequestContextOptions,
) => Promise<PreviewRequestContext>

const safeFailure = 'Could not authenticate to the configured Vercel Preview. Check its bypass secret and protection settings.'

function normalizedCookieDomain(domain: string): string {
  return domain.toLowerCase().replace(/^\./, '')
}

function assertResponseCookieDomains(
  headers: Array<{ name: string; value: string }>,
  hostname: string,
): void {
  const setCookieHeaders = headers.filter(header => header.name.toLowerCase() === 'set-cookie')
  if (setCookieHeaders.length === 0) throw new Error(safeFailure)

  for (const header of setCookieHeaders) {
    const domainAttribute = header.value
      .split(';')
      .slice(1)
      .map(attribute => attribute.trim())
      .find(attribute => attribute.toLowerCase().startsWith('domain='))
    if (!domainAttribute) continue

    const domain = domainAttribute.slice('domain='.length).trim()
    if (normalizedCookieDomain(domain) !== hostname) throw new Error(safeFailure)
  }
}

/**
 * Exchanges a bypass secret for a host-only preview cookie without following redirects.
 * The secret is sent to the validated preview origin once; only validated cookies leave this helper.
 */
export async function acquirePreviewCookies(
  previewURL: string | undefined,
  bypassSecret: string | undefined,
  createContext: PreviewRequestContextFactory = options => request.newContext(options),
): Promise<PreviewCookie[]> {
  if (!previewURL) return []
  if (!bypassSecret || bypassSecret.trim().length === 0) {
    throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is required for the configured Vercel Preview.')
  }

  let preview: URL
  try {
    preview = validatePreviewUrl(previewURL)
  } catch {
    throw new Error('PLAYWRIGHT_PRODUCTION_URL must be a valid immutable Vercel Preview URL.')
  }

  let context: PreviewRequestContext
  try {
    context = await createContext({
      baseURL: preview.origin,
      extraHTTPHeaders: {
        'x-vercel-protection-bypass': bypassSecret,
        'x-vercel-set-bypass-cookie': 'true',
      },
      maxRedirects: 0,
    })
  } catch {
    throw new Error(safeFailure)
  }

  let cookies: PreviewCookie[] | undefined
  try {
    const response = await context.get(preview.toString(), { maxRedirects: 0 })
    const responseURL = new URL(response.url())
    if (responseURL.origin !== preview.origin) throw new Error(safeFailure)

    const headers = response.headersArray()
    const status = response.status()
    if (status < 300 || status >= 400) throw new Error(safeFailure)

    const location = headers.find(header => header.name.toLowerCase() === 'location')?.value
    if (!location) throw new Error(safeFailure)
    const redirect = new URL(location, preview)
    if (redirect.origin !== preview.origin) throw new Error(safeFailure)

    assertResponseCookieDomains(headers, preview.hostname)
    cookies = await context.cookies(preview.origin)
    if (cookies.length === 0 || cookies.some(cookie =>
      normalizedCookieDomain(cookie.domain) !== preview.hostname || !cookie.secure)) {
      throw new Error(safeFailure)
    }
  } catch {
    // API errors can include request metadata. Never expose their message or response contents.
    cookies = undefined
  }

  try {
    await context.dispose()
  } catch {
    cookies = undefined
  }

  if (!cookies) throw new Error(safeFailure)
  return cookies
}
