import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { unzipSync, zipSync } from 'fflate'
import {
  resolvePlaywrightArtifactPaths,
  sanitizePlaywrightArtifactPaths,
  supportsPreviewReporters,
  verifyPlaywrightArtifactsSanitized,
} from '../scripts/ci/playwright-artifacts.mjs'
import { expect, test } from './fixtures'

const previewHost = 'ttrpg-cluster-control-a1-submoon.vercel.app'

function toText(bytes: Uint8Array): string | undefined {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return undefined
  }
}

function archiveEntry(archive: Record<string, Uint8Array | undefined>, name: string): Uint8Array {
  const entry = archive[name]
  if (entry === undefined) throw new Error(`The diagnostic archive is missing ${name}.`)
  return entry
}

function archiveEntryText(archive: Record<string, Uint8Array | undefined>, name: string): string {
  const text = toText(archiveEntry(archive, name))
  if (text === undefined) throw new Error(`The diagnostic archive entry ${name} is not UTF-8 text.`)
  return text
}

function expectCredentialsAbsentFromArchive(
  archive: Uint8Array,
  credentials: string[],
): void {
  for (const [name, contents] of Object.entries(unzipSync(archive))) {
    if (name.endsWith('.zip')) {
      expectCredentialsAbsentFromArchive(contents, credentials)
      continue
    }
    const text = toText(contents)
    if (text === undefined) continue
    for (const credential of credentials) expect(text).not.toContain(credential)
  }
}

test('Preview credentials are redacted from traces and copied HTML report data @pure', { tag: '@pure' }, () => {
  const repositoryTestResults = join(process.cwd(), 'test-results')
  mkdirSync(repositoryTestResults, { recursive: true })
  const root = mkdtempSync(join(repositoryTestResults, 'playwright-artifact-redaction-'))
  const output = join(root, 'test-results')
  const report = join(root, 'playwright-report')
  const cookieValue = `cookie-${randomUUID()}`
  const opaqueCookieValue = randomUUID().slice(0, 6)
  const numericCookieValue = '1793395800'
  const bypassSecret = `secret-${randomUUID()}`
  const screenshot = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff])
  const inlineSecretAttachment = {
    name: 'inline-secret.txt',
    contentType: 'text/plain',
    encoding: 'base64',
    body: Buffer.from(`preview credential ${bypassSecret}`, 'utf8').toString('base64'),
  }
  const inlineBinaryAttachment = {
    name: 'opaque-payload.bin',
    contentType: 'application/octet-stream',
    encoding: 'base64',
    body: Buffer.from([0x00, 0xff, 0x19, 0x80, 0x42]).toString('base64'),
  }
  const pathOnlyTraceAttachment = { name: 'path-only-trace.zip', contentType: 'application/zip', path: 'trace.zip' }
  const inlineAttachments = [inlineSecretAttachment, inlineBinaryAttachment, pathOnlyTraceAttachment]

  try {
    mkdirSync(output, { recursive: true })
    mkdirSync(report, { recursive: true })

    const traceEvents = [
      {
        type: 'call',
        method: 'browserContext.addCookies',
        params: { cookies: [
          { name: 'vercel-preview-bypass', value: cookieValue, domain: previewHost },
          { name: 'edge_gate', value: opaqueCookieValue, domain: previewHost },
          { name: 'numeric-session', value: numericCookieValue, expires: 1793395800, domain: previewHost },
          { name: 'single-value', value: '1', domain: previewHost },
        ] },
      },
      {
        type: 'call',
        method: 'APIRequestContext.newContext',
        params: { extraHTTPHeaders: { 'x-vercel-protection-bypass': bypassSecret } },
      },
      {
        type: 'error',
        error: { message: `API failed with edge_gate=${opaqueCookieValue}, cookie=${cookieValue}, bypass=${bypassSecret}` },
      },
      {
        type: 'log',
        message: `Native log included edge_gate=${opaqueCookieValue}`,
      },
      {
        type: 'console',
        text: `Console text included edge_gate=${opaqueCookieValue}`,
        args: [`Console argument included edge_gate=${opaqueCookieValue}`],
      },
      {
        type: 'resource-snapshot',
        snapshot: {
          request: {
            url: `https://${previewHost}/`,
            headers: [{ name: 'Cookie', value: `vercel-preview-bypass=${cookieValue}; edge_gate=${opaqueCookieValue}; numeric-session=${numericCookieValue}; single-value=1; theme=1` }],
          },
        },
      },
      {
        type: 'before',
        method: 'fetch',
        params: {
          url: '/drop',
          headers: [
            { name: 'Accept', value: '*/*' },
            { name: 'Cookie', value: `edge_gate=${opaqueCookieValue}` },
          ],
        },
      },
      {
        type: 'resource-snapshot',
        snapshot: {
          response: {
            url: `https://${previewHost}/`,
            headers: [{
              name: 'Set-Cookie',
              value: `edge_gate=${opaqueCookieValue}; Domain=${previewHost}; Path=/; Secure`,
            }],
            unrelatedPreference: '1',
          },
        },
      },
    ]
    const trace = zipSync({
      'trace.trace': Buffer.from(traceEvents.map(event => JSON.stringify(event)).join('\n'), 'utf8'),
      'trace.network': Buffer.from(JSON.stringify({
        url: `https://${previewHost}/`,
        request: { headers: [{ name: 'Cookie', value: `vercel-preview-bypass=${cookieValue}; edge_gate=${opaqueCookieValue}; numeric-session=${numericCookieValue}; theme=1` }] },
      }), 'utf8'),
      'resources/response.json': Buffer.from(JSON.stringify({
        detail: `failed ${bypassSecret}`,
        body: `error body retained ${bypassSecret}`,
        credential: numericCookieValue,
        expires: 1793395800,
      }), 'utf8'),
      'resources/source.js': Buffer.from("const source = 1;\nconst cookieLabel = 'Cookie:';\nconst authorizationLabel = 'authorization:';\n", 'utf8'),
      'resources/failure.png': screenshot,
    })
    writeFileSync(join(output, 'trace.zip'), trace)
    writeFileSync(join(output, 'owned-server.log'), `request failed edge_gate=${opaqueCookieValue} with ${bypassSecret}\nCookie: edge_gate=${opaqueCookieValue}\n`, 'utf8')
    writeFileSync(join(output, 'error-context.md'), [
      '# Error details',
      `API request included edge_gate=${opaqueCookieValue}`,
      '# Test source',
      'const source = 1;',
      '',
    ].join('\n'), 'utf8')
    writeFileSync(join(output, 'captured-response.html'), `<html><body>${bypassSecret}</body></html>`, 'utf8')
    writeFileSync(join(output, 'extensionless-response'), `<!doctype html><html><body>${cookieValue}</body></html>`, 'utf8')
    writeFileSync(join(output, 'loose.network'), JSON.stringify({
      url: `https://${previewHost}/`,
      request: { headers: [{ name: 'Cookie', value: `vercel-preview-bypass=${cookieValue}; edge_gate=${opaqueCookieValue}; numeric-session=${numericCookieValue}; theme=1` }] },
    }), 'utf8')
    writeFileSync(join(output, 'playwright-report.json'), JSON.stringify({ attachments: inlineAttachments }), 'utf8')

    const reportArchive = zipSync({
      'data/report.json': Buffer.from(JSON.stringify({
        attachments: inlineAttachments,
        steps: [{
          error: { message: `API call retained ${opaqueCookieValue}, ${cookieValue} and ${bypassSecret}` },
          headers: [{ name: 'Authorization', value: `Bearer ${bypassSecret}` }],
        }],
      }), 'utf8'),
      'data/trace.zip': trace,
      'data/failure.png': screenshot,
    })
    const reportHTML = `<html><script>const unrelated = 1;</script><body><template id="playwrightReportBase64">data:application/zip;base64,${Buffer.from(reportArchive).toString('base64')}</template></body></html>`
    writeFileSync(join(report, 'index.html'), reportHTML, 'utf8')

    sanitizePlaywrightArtifactPaths([root], {
      previewURL: `https://${previewHost}/`,
      bypassSecret,
    })
    sanitizePlaywrightArtifactPaths([root], {
      previewURL: `https://${previewHost}/`,
      bypassSecret,
    })

    const expectedInlineAttachments = [
      { ...inlineSecretAttachment, name: 'inline-secret.txt [inline body redacted]', contentType: 'text/plain', body: '' },
      { ...inlineBinaryAttachment, name: 'opaque-payload.bin [inline body redacted]', contentType: 'text/plain', body: '' },
      pathOnlyTraceAttachment,
    ]
    const sanitizedJSONAttachments = JSON.parse(readFileSync(join(output, 'playwright-report.json'), 'utf8')).attachments
    expect(sanitizedJSONAttachments).toEqual(expectedInlineAttachments)
    expect(sanitizedJSONAttachments.slice(0, 2).every((attachment: { body: string }) => (
      Buffer.from(attachment.body, 'base64').toString('utf8') === ''
    ))).toBe(true)

    const sanitizedTrace = unzipSync(readFileSync(join(output, 'trace.zip')))
    expectCredentialsAbsentFromArchive(readFileSync(join(output, 'trace.zip')), [cookieValue, opaqueCookieValue, bypassSecret])
    const sanitizedTraceRecords = archiveEntryText(sanitizedTrace, 'trace.trace').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
    expect(sanitizedTraceRecords[0].params.cookies[0].value).toBe('[REDACTED]')
    expect(sanitizedTraceRecords[0].params.cookies[1].value).toBe('[REDACTED]')
    expect(sanitizedTraceRecords[0].params.cookies[2].value).toBe('[REDACTED]')
    expect(sanitizedTraceRecords[0].params.cookies[3].value).toBe('[REDACTED]')
    expect(sanitizedTraceRecords[0].params.cookies[2].expires).toBe(1793395800)
    expect(sanitizedTraceRecords[2].error.message).toBe('[REDACTED]')
    expect(sanitizedTraceRecords[3].message).toBe('[REDACTED]')
    expect(sanitizedTraceRecords[4].text).toBe('[REDACTED]')
    expect(sanitizedTraceRecords[4].args[0]).toBe('[REDACTED]')
    expect(JSON.parse(archiveEntryText(sanitizedTrace, 'resources/response.json'))).toEqual({
      detail: 'failed [REDACTED]',
      body: 'error body retained [REDACTED]',
      credential: '[REDACTED]',
      expires: 1793395800,
    })
    expect(sanitizedTraceRecords[5].snapshot.request.headers[0].value).toContain('theme=[REDACTED]')
    const responseRecord = sanitizedTraceRecords.find(record => record.type === 'resource-snapshot' && record.snapshot?.response)
    if (!responseRecord) throw new Error('The diagnostic trace is missing its response snapshot.')
    expect(responseRecord.snapshot.response.unrelatedPreference).toBe('1')
    const sdkFetch = sanitizedTraceRecords.find(record => record.type === 'before')
    expect(sdkFetch.params.headers[1].value).toBe('edge_gate=[REDACTED]')
    expect(archiveEntry(sanitizedTrace, 'resources/failure.png')).toEqual(screenshot)
    expect(archiveEntryText(sanitizedTrace, 'resources/source.js')).toBe("const source = 1;\nconst cookieLabel = 'Cookie:';\nconst authorizationLabel = 'authorization:';\n")
    expect(toText(readFileSync(join(output, 'owned-server.log')))).toBe('[REDACTED]\n[REDACTED]\n')
    expect(toText(readFileSync(join(output, 'error-context.md')))).toBe([
      '# Error details',
      '[REDACTED]',
      '# Test source',
      'const source = 1;',
      '',
    ].join('\n'))
    const networkText = toText(readFileSync(join(output, 'loose.network')))
    expect(networkText).not.toContain(cookieValue)
    expect(networkText).not.toContain(opaqueCookieValue)
    for (const line of networkText!.split(/\r?\n/).filter(Boolean)) expect(() => JSON.parse(line)).not.toThrow()

    const sanitizedHTML = readFileSync(join(report, 'index.html'), 'utf8')
    expect(sanitizedHTML).toContain('<script>const unrelated = 1;</script>')
    const nativeHTMLWithoutReportData = (html: string) => html.replace(
      /(<template\b[^>]*\bid=["']playwrightReportBase64["'][^>]*>)[\s\S]*?(<\/template>)/i,
      '$1[REPORT DATA]$2',
    )
    expect(nativeHTMLWithoutReportData(sanitizedHTML)).toBe(nativeHTMLWithoutReportData(reportHTML))
    expect(readFileSync(join(output, 'captured-response.html'), 'utf8'))
      .toBe('<html><body>[REDACTED]</body></html>')
    expect(readFileSync(join(output, 'extensionless-response'), 'utf8'))
      .toBe('<!doctype html><html><body>[REDACTED]</body></html>')
    const archiveText = sanitizedHTML.match(/<template id="playwrightReportBase64">data:application\/zip;base64,([\s\S]*?)<\/template>/)?.[1]
    expect(archiveText).toBeTruthy()
    const sanitizedReport = unzipSync(Buffer.from(archiveText!, 'base64'))
    expectCredentialsAbsentFromArchive(Buffer.from(archiveText!, 'base64'), [cookieValue, opaqueCookieValue, bypassSecret])
    const sanitizedReportJson = archiveEntryText(sanitizedReport, 'data/report.json')
    expect(sanitizedReportJson).toContain('Authorization')
    expect(sanitizedReportJson).toContain('[REDACTED]')
    const sanitizedReportData = JSON.parse(sanitizedReportJson)
    expect(sanitizedReportData.steps[0].error.message).toBe('[REDACTED]')
    expect(sanitizedReportData.attachments).toEqual(expectedInlineAttachments)
    expect(archiveEntry(sanitizedReport, 'data/failure.png')).toEqual(screenshot)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('protected reporters resolve files and reject stdout or unsupported reporters @pure', { tag: '@pure' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'playwright-reporter-paths-'))
  const configDirectory = join(root, 'config')
  const configFile = join(configDirectory, 'playwright.config.ts')
  const projectOutput = join(root, 'results')
  const baseConfig = {
    configFile,
    outputDir: projectOutput,
    projects: [{ outputDir: projectOutput }],
  }

  try {
    const configuredReporters = {
      ...baseConfig,
      reporter: [
        ['json', { outputFile: 'configured/nested/report.json' }],
        ['html', { outputFolder: 'configured-html' }],
        'github',
        'list',
      ],
    }
    const environmentFiles = resolvePlaywrightArtifactPaths(configuredReporters, {
      PLAYWRIGHT_JSON_OUTPUT_FILE: 'environment/nested/report.json',
      PLAYWRIGHT_JSON_OUTPUT_DIR: 'ignored-json-dir',
      PLAYWRIGHT_JSON_OUTPUT_NAME: 'ignored-name.json',
      PLAYWRIGHT_HTML_OUTPUT_DIR: 'environment-html-dir',
      PLAYWRIGHT_HTML_REPORT: 'ignored-html-report',
    })
    expect(environmentFiles.files).toEqual([resolve(process.cwd(), 'environment/nested/report.json')])
    expect(environmentFiles.directories).toContain(resolve(process.cwd(), 'environment-html-dir'))
    expect(environmentFiles.directories).not.toContain(resolve(process.cwd(), 'ignored-html-report'))
    expect(environmentFiles.directories).toContain(projectOutput)
    expect(supportsPreviewReporters(configuredReporters, {
      PLAYWRIGHT_JSON_OUTPUT_FILE: 'environment/nested/report.json',
    })).toBe(true)

    const configRelative = resolvePlaywrightArtifactPaths(configuredReporters, {})
    expect(configRelative.files).toEqual([resolve(configDirectory, 'configured/nested/report.json')])
    expect(configRelative.directories).toContain(resolve(configDirectory, 'configured-html'))

    const directoryAndNameReporter = { ...baseConfig, reporter: [['json', {}]] }
    const directoryAndName = resolvePlaywrightArtifactPaths(directoryAndNameReporter, {
      PLAYWRIGHT_JSON_OUTPUT_DIR: 'environment-json',
      PLAYWRIGHT_JSON_OUTPUT_NAME: 'named/report.json',
    })
    expect(directoryAndName.files).toEqual([resolve(process.cwd(), 'environment-json/named/report.json')])

    const nameWithoutDirectory = resolvePlaywrightArtifactPaths(directoryAndNameReporter, {
      PLAYWRIGHT_JSON_OUTPUT_NAME: 'named/report.json',
    })
    expect(nameWithoutDirectory.files).toEqual([resolve(configDirectory, 'named/report.json')])

    const directoryWithoutName = resolvePlaywrightArtifactPaths(directoryAndNameReporter, {
      PLAYWRIGHT_JSON_OUTPUT_DIR: 'environment-json',
    })
    expect(directoryWithoutName.files).toEqual([])
    expect(supportsPreviewReporters(directoryAndNameReporter, {
      PLAYWRIGHT_JSON_OUTPUT_DIR: 'environment-json',
    })).toBe(false)
    expect(supportsPreviewReporters({ ...baseConfig, reporter: ['perfetto'] }, {})).toBe(false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the CI diagnostics gate requires a valid completion marker @pure', { tag: '@pure' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'playwright-artifact-marker-'))
  const marker = join(root, 'marker.json')
  try {
    writeFileSync(marker, JSON.stringify({
      formatVersion: 1,
      completedAt: new Date().toISOString(),
      credentialSanitization: 'completed',
      outputs: [],
    }), 'utf8')
    expect(verifyPlaywrightArtifactsSanitized(marker).formatVersion).toBe(1)

    writeFileSync(marker, '{invalid json', 'utf8')
    expect(() => verifyPlaywrightArtifactsSanitized(marker)).toThrow('diagnostic uploads are blocked')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a failed first sanitation pass cannot create the CI completion marker @pure', { tag: '@pure' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'playwright-artifact-fail-closed-'))
  const output = join(root, 'test-results', 'artifacts')
  const marker = join(root, 'test-results', '.playwright-diagnostics-sanitized.json')
  const sanitizerURL = pathToFileURL(resolve('scripts/ci/playwright-artifacts.mjs')).href

  try {
    mkdirSync(output, { recursive: true })
    writeFileSync(join(output, 'invalid.zip'), 'this is not a ZIP archive', 'utf8')

    const source = [
      `import setup from ${JSON.stringify(sanitizerURL)}`,
      `const root = ${JSON.stringify(root)}`,
      `const output = ${JSON.stringify(output)}`,
      `const teardown = await setup({ configFile: root + '/playwright.config.ts', projects: [{ outputDir: output }], reporter: [] })`,
      'try { await teardown() } catch { process.exitCode = 0 }',
      '',
    ].join('\n')
    const environment: NodeJS.ProcessEnv = { ...process.env, VERCEL_AUTOMATION_BYPASS_SECRET: 's1' }
    delete environment.PLAYWRIGHT_PRODUCTION_URL
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
      encoding: 'utf8',
      timeout: 15_000,
      windowsHide: true,
      env: environment,
    })

    expect(result.error, result.stderr).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      '(phase=collect-credentials; reason=invalid-report-archive; artifact=archive; item=1)',
    )
    expect(result.stderr).not.toContain('invalid.zip')
    expect(result.stderr).not.toContain(root)
    expect(existsSync(marker)).toBe(false)
    expect(existsSync(output)).toBe(false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('local diagnostics skip auth rewriting when no Preview credential is configured @pure', { tag: '@pure' }, () => {
  const repositoryTestResults = join(process.cwd(), 'test-results')
  mkdirSync(repositoryTestResults, { recursive: true })
  const root = mkdtempSync(join(repositoryTestResults, 'playwright-artifact-no-auth-'))
  const output = join(root, 'test-results', 'artifacts')
  const marker = join(root, 'test-results', '.playwright-diagnostics-sanitized.json')
  const invalidArchive = Buffer.from('this is not a ZIP archive', 'utf8')
  const inlineAttachmentBytes = Buffer.from(JSON.stringify({
    attachments: [{
      name: 'native-inline.json',
      contentType: 'application/json',
      encoding: 'base64',
      body: Buffer.from('local diagnostic bytes remain untouched', 'utf8').toString('base64'),
    }],
  }), 'utf8')
  const sanitizerURL = pathToFileURL(resolve('scripts/ci/playwright-artifacts.mjs')).href

  try {
    mkdirSync(output, { recursive: true })
    writeFileSync(join(output, 'opaque-attachment.zip'), invalidArchive)
    writeFileSync(join(output, 'native-inline-attachment.json'), inlineAttachmentBytes)

    const source = [
      `import setup from ${JSON.stringify(sanitizerURL)}`,
      `const root = ${JSON.stringify(root)}`,
      `const output = ${JSON.stringify(output)}`,
      `const teardown = await setup({ configFile: root + '/playwright.config.ts', projects: [{ outputDir: output }], reporter: [] })`,
      'await teardown()',
      '',
    ].join('\n')
    const environment: NodeJS.ProcessEnv = { ...process.env }
    delete environment.PLAYWRIGHT_PRODUCTION_URL
    delete environment.VERCEL_AUTOMATION_BYPASS_SECRET
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
      encoding: 'utf8',
      timeout: 15_000,
      windowsHide: true,
      env: environment,
    })

    expect(result.error, result.stderr).toBeUndefined()
    expect(result.status, result.stderr).toBe(0)
    expect(existsSync(marker)).toBe(true)
    expect(readFileSync(join(output, 'opaque-attachment.zip'))).toEqual(invalidArchive)
    expect(readFileSync(join(output, 'native-inline-attachment.json'))).toEqual(inlineAttachmentBytes)
    expect(verifyPlaywrightArtifactsSanitized(marker).credentialSanitization)
      .toBe('not-required-no-preview-auth')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a no-auth marker failure preserves native diagnostics but blocks uploads @pure', { tag: '@pure' }, () => {
  const repositoryTestResults = join(process.cwd(), 'test-results')
  mkdirSync(repositoryTestResults, { recursive: true })
  const root = mkdtempSync(join(repositoryTestResults, 'playwright-artifact-no-auth-marker-fail-'))
  const output = join(root, 'test-results', 'artifacts')
  const marker = join(root, 'test-results', '.playwright-diagnostics-sanitized.json')
  const opaqueAttachment = Buffer.from('opaque native attachment bytes', 'utf8')
  const sanitizerURL = pathToFileURL(resolve('scripts/ci/playwright-artifacts.mjs')).href

  try {
    mkdirSync(output, { recursive: true })
    writeFileSync(join(output, 'opaque-attachment.zip'), opaqueAttachment)

    const source = [
      `import fs from 'node:fs'`,
      `import { syncBuiltinESMExports } from 'node:module'`,
      `import setup from ${JSON.stringify(sanitizerURL)}`,
      `const root = ${JSON.stringify(root)}`,
      `const output = ${JSON.stringify(output)}`,
      `const originalRenameSync = fs.renameSync`,
      `fs.renameSync = (source, destination) => {`,
      `  if (String(destination).endsWith('.playwright-diagnostics-sanitized.json')) {`,
      `    const error = new Error('controlled marker write failure')`,
      `    error.code = 'EPERM'`,
      `    throw error`,
      `  }`,
      `  return originalRenameSync(source, destination)`,
      `}`,
      `syncBuiltinESMExports()`,
      `const teardown = await setup({ configFile: root + '/playwright.config.ts', projects: [{ outputDir: output }], reporter: [] })`,
      `await teardown()`,
      '',
    ].join('\n')
    const environment: NodeJS.ProcessEnv = { ...process.env }
    delete environment.PLAYWRIGHT_PRODUCTION_URL
    delete environment.VERCEL_AUTOMATION_BYPASS_SECRET
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
      encoding: 'utf8',
      timeout: 15_000,
      windowsHide: true,
      env: environment,
    })

    expect(result.error, result.stderr).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('(phase=write-marker; reason=filesystem-eperm; artifact=marker; item=0)')
    expect(existsSync(marker)).toBe(false)
    expect(existsSync(output)).toBe(true)
    expect(readFileSync(join(output, 'opaque-attachment.zip'))).toEqual(opaqueAttachment)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
