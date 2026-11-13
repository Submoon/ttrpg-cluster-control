import { expect, test } from './fixtures'
import { GoogleDriveCancelledError, requestGoogleDriveAccessToken } from '../utils/google-drive-auth'

test('Google Drive authorization requests only appData access and validates the granted scope @pure', async () => {
  let optionsSeen: { scope: string, include_granted_scopes: false } | undefined
  const token = await withWindow({
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            scope: string
            include_granted_scopes: false
            callback: (response: { access_token: string, scope: string }) => void
          }) => {
            optionsSeen = options
            return { requestAccessToken: () => options.callback({
              access_token: 'short-lived-token',
              scope: 'https://www.googleapis.com/auth/drive.appdata',
            }) }
          },
        },
      },
    },
  }, () => requestGoogleDriveAccessToken('client-id'))

  expect(token).toBe('short-lived-token')
  expect(optionsSeen).toMatchObject({
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    include_granted_scopes: false,
  })
})

test('canceling Google authorization settles the pending request and ignores late callbacks @pure', async () => {
  let callback: ((response: { access_token: string, scope: string }) => void) | undefined
  const error = await withWindow({
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (options: { callback: (response: { access_token: string, scope: string }) => void }) => {
            callback = options.callback
            return { requestAccessToken: () => undefined }
          },
        },
      },
    },
  }, async () => {
    const abort = new AbortController()
    const pending = requestGoogleDriveAccessToken('client-id', abort.signal).catch(reason => reason)
    abort.abort()
    const result = await pending
    callback?.({ access_token: 'late-token', scope: 'https://www.googleapis.com/auth/drive.appdata' })
    return result
  })

  expect(error).toBeInstanceOf(GoogleDriveCancelledError)
})

async function withWindow<T>(fakeWindow: object, run: () => Promise<T>): Promise<T> {
  const oldDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { setTimeout: globalThis.setTimeout.bind(globalThis), clearTimeout: globalThis.clearTimeout.bind(globalThis), ...fakeWindow },
  })
  try {
    return await run()
  } finally {
    if (oldDescriptor) Object.defineProperty(globalThis, 'window', oldDescriptor)
    else Reflect.deleteProperty(globalThis, 'window')
  }
}
