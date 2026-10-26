import {
  test as playwrightTest,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  type WorkerInfo,
} from '@playwright/test'
import { acquirePreviewCookies, type PreviewCookie } from './vercel-preview-auth'
import {
  importCampaignWorkspace,
  openImportedCampaignWorkspace,
} from './scenarios/campaign-workspace'

export { expect, type Locator, type Page }

type PreviewWorkerFixtures = {
  previewCookies: PreviewCookie[]
}

/**
 * Shared browser test fixture. Preview cookies are requested only by the remote browser project;
 * context creation remains lazy, so pure tests do not launch a browser or request authentication.
 */
export const test = playwrightTest.extend<object, PreviewWorkerFixtures>({
  previewCookies: [async (
    // Playwright requires this worker fixture's empty dependency map to be destructured.
    // eslint-disable-next-line no-empty-pattern
    {}, use, workerInfo,
  ) => {
    const previewURL = workerInfo.project.name === 'browser'
      ? process.env.PLAYWRIGHT_PRODUCTION_URL
      : undefined
    const cookies = await acquirePreviewCookies(
      previewURL,
      previewURL ? process.env.VERCEL_AUTOMATION_BYPASS_SECRET : undefined,
    )
    await use(cookies)
  }, { scope: 'worker' }],
  context: async ({ context, previewCookies }, use) => {
    if (previewCookies.length) await context.addCookies(previewCookies)
    await use(context)
  },
})

type CampaignPreparation = 'public-import' | 'prepared-snapshot'
type CampaignViewport = { width: number; height: number } | undefined
type CampaignFixtures = {
  campaignPreparation: CampaignPreparation
  campaignViewport: CampaignViewport
  campaignWorkspacePage: Page
}
type CampaignWorkerFixtures = {
  campaignSnapshotProvider: () => Promise<Awaited<ReturnType<BrowserContext['storageState']>>>
}

function projectBaseURL(workerInfo: WorkerInfo): string {
  const baseURL = workerInfo.project.use.baseURL
  if (typeof baseURL !== 'string') {
    throw new Error('Campaign workspace preparation requires a configured Playwright baseURL.')
  }
  return baseURL
}

/**
 * Baseline route scenarios can opt into a per-worker immutable IndexedDB snapshot while each
 * test still receives its own context and reopens the public app before running.
 */
export const campaignTest = test.extend<CampaignFixtures, CampaignWorkerFixtures>({
  campaignPreparation: ['public-import', { option: true }],
  campaignViewport: [undefined, { option: true }],
  campaignSnapshotProvider: [async ({ browser, previewCookies }, use, workerInfo) => {
    let snapshot: Promise<Awaited<ReturnType<BrowserContext['storageState']>>> | undefined
    const provideSnapshot = () => {
      snapshot ??= (async () => {
        const context = await browser.newContext({ baseURL: projectBaseURL(workerInfo) })
        try {
          if (previewCookies.length) await context.addCookies(previewCookies)
          await importCampaignWorkspace(await context.newPage())
          return await context.storageState({ indexedDB: true })
        } finally {
          await context.close()
        }
      })()
      return snapshot
    }
    await use(provideSnapshot)
  }, { scope: 'worker' }],
  storageState: async ({ storageState, campaignPreparation, campaignSnapshotProvider }, use) => {
    if (campaignPreparation === 'prepared-snapshot') {
      await use(structuredClone(await campaignSnapshotProvider()))
      return
    }
    await use(storageState)
  },
  campaignWorkspacePage: async ({ page, campaignPreparation, campaignViewport }, use) => {
    if (campaignPreparation === 'prepared-snapshot') {
      await openImportedCampaignWorkspace(page, campaignViewport)
    } else {
      await importCampaignWorkspace(page, undefined, campaignViewport)
    }
    await use(page)
  },
})
