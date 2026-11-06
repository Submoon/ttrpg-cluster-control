import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { unzipSync, zipSync } from 'fflate'

const markerRelativePath = 'test-results/.playwright-diagnostics-sanitized.json'
const maxArchiveBytes = 128 * 1024 * 1024
const maxArchiveMemberBytes = 32 * 1024 * 1024
const maxArchiveTotalBytes = 256 * 1024 * 1024
const maxArchiveMembers = 10_000
const maxFilesPerRoot = 20_000
const maxDirectoryDepth = 32
const maxEmbeddedArchiveDepth = 4
const textExtensions = new Set([
  '.css', '.har', '.html', '.js', '.json', '.log', '.md', '.network', '.svg', '.trace', '.txt', '.xml', '.yaml', '.yml',
])
const sensitiveHeaderNames = new Set(['authorization', 'proxy-authorization', 'x-vercel-protection-bypass'])
const diagnosticPayloadKeys = new Set(['error', 'errors', 'log', 'logs', 'stderr', 'stdout'])
const credentialHeaderLine = /(?:^|\b)(?:cookie|set-cookie|authorization|proxy-authorization|x-vercel-protection-bypass)\s*[:=]/i
const sensitiveCookieName = /(?:vercel.*(?:preview|bypass)|(?:preview|bypass).*vercel)/i
const htmlReportArchive = /(<template\b[^>]*\bid=["']playwrightReportBase64["'][^>]*>\s*data:application\/zip;base64,)([A-Za-z0-9+/=\r\n]+)(\s*<\/template>)/gi

function resolveWorkspaceRoot(config) {
  return config.configFile ? dirname(resolve(config.configFile)) : process.cwd()
}

function resolveReporterPath(config, path) {
  const configDirectory = config.configFile ? dirname(resolve(config.configFile)) : process.cwd()
  return resolve(configDirectory, path)
}

function resolveEnvironmentReporterPath(path) {
  return resolve(process.cwd(), path)
}

function reporterEntries(reporters = []) {
  const descriptions = Array.isArray(reporters) ? reporters : [reporters]
  return descriptions.map(reporter => Array.isArray(reporter)
    ? { name: String(reporter[0]).toLowerCase(), options: reporter[1] ?? {} }
    : { name: String(reporter).toLowerCase(), options: {} })
}

function jsonReporterOutputFile(config, options, env) {
  if (env.PLAYWRIGHT_JSON_OUTPUT_FILE) return resolveEnvironmentReporterPath(env.PLAYWRIGHT_JSON_OUTPUT_FILE)
  if (options.outputFile) return resolveReporterPath(config, options.outputFile)

  const environmentOutputDirectory = env.PLAYWRIGHT_JSON_OUTPUT_DIR
  const configuredOutputDirectory = options.outputDir
  const fileName = env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? options.fileName ?? options.default?.fileName
  if (!fileName) return undefined

  const outputDirectory = environmentOutputDirectory
    ? resolveEnvironmentReporterPath(environmentOutputDirectory)
    : configuredOutputDirectory
      ? resolveReporterPath(config, configuredOutputDirectory)
      : config.configFile ? dirname(resolve(config.configFile)) : process.cwd()
  return resolve(outputDirectory, fileName)
}

function configuredArtifactPaths(config, env = process.env) {
  const paths = new Set((config.projects ?? []).map(project => resolve(project.outputDir ?? config.outputDir)))
  const reportFiles = new Set()

  for (const { name, options } of reporterEntries(config.reporter)) {
    if (name === 'html') {
      const environmentOutputFolder = env.PLAYWRIGHT_HTML_OUTPUT_DIR
        || env.PLAYWRIGHT_HTML_REPORT
      const outputFolder = environmentOutputFolder
        ? resolveEnvironmentReporterPath(environmentOutputFolder)
        : resolveReporterPath(config, options.outputFolder || 'playwright-report')
      paths.add(outputFolder)
    } else if (name === 'json') {
      const outputFile = jsonReporterOutputFile(config, options, env)
      if (outputFile) reportFiles.add(outputFile)
    }
  }

  return {
    directories: [...paths],
    files: [...reportFiles],
  }
}

export function resolvePlaywrightArtifactPaths(config, env = process.env) {
  return configuredArtifactPaths(config, env)
}

function previewHostname(env = process.env) {
  if (!env.PLAYWRIGHT_PRODUCTION_URL) return undefined
  try {
    return new URL(env.PLAYWRIGHT_PRODUCTION_URL).hostname.toLowerCase()
  } catch {
    return undefined
  }
}

function normalizeDomain(domain) {
  return typeof domain === 'string' ? domain.toLowerCase().replace(/^\./, '') : ''
}

function looksLikePreviewAuthCookie(name, domain, host, expectedHost) {
  if (typeof name !== 'string') return false
  if (sensitiveCookieName.test(name)) return true
  const cookieDomain = normalizeDomain(domain)
  const requestHost = normalizeDomain(host)
  return Boolean(expectedHost && (cookieDomain === expectedHost || requestHost === expectedHost))
}

function hostFromUrl(value) {
  if (typeof value !== 'string') return undefined
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return undefined
  }
}

function objectHost(value, inheritedHost) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return inheritedHost
  for (const key of ['url', 'origin', 'baseURL', 'requestUrl']) {
    const host = hostFromUrl(value[key])
    if (host) return host
  }
  return inheritedHost
}

function cookiePairs(value, setCookie) {
  if (typeof value !== 'string') return []
  const segments = value.split(';')
  const cookieSegmentCount = setCookie ? Math.min(segments.length, 1) : segments.length
  const cookies = []
  for (let index = 0; index < cookieSegmentCount; index += 1) {
    const segment = segments[index].trim()
    const equals = segment.indexOf('=')
    if (equals <= 0) continue
    cookies.push({ name: segment.slice(0, equals).trim(), value: segment.slice(equals + 1).trim() })
  }
  return cookies
}

function setCookieDomain(value) {
  if (typeof value !== 'string') return ''
  const domain = value.split(';').slice(1)
    .map(attribute => attribute.trim())
    .find(attribute => attribute.toLowerCase().startsWith('domain='))
  return domain ? domain.slice('domain='.length).trim() : ''
}

function rememberCredential(value, { secrets, shortCredentials }) {
  if (!value) return
  if (value.length >= 8) secrets.add(value)
  else shortCredentials.add(value)
}

function collectCookieValue(value, { host, domain, previewHost, secrets, shortCredentials }) {
  if (typeof value.name !== 'string' || typeof value.value !== 'string') return
  if (looksLikePreviewAuthCookie(value.name, domain ?? value.domain, host, previewHost)) {
    rememberCredential(value.value, { secrets, shortCredentials })
  }
}

function collectHeaderValue(name, value, { host, previewHost, secrets, shortCredentials }) {
  if (typeof value !== 'string') return
  const headerName = String(name).toLowerCase()
  if (sensitiveHeaderNames.has(headerName)) {
    rememberCredential(value, { secrets, shortCredentials })
    return
  }
  if (headerName !== 'cookie' && headerName !== 'set-cookie') return
  const setCookie = headerName === 'set-cookie'
  const domain = setCookie ? setCookieDomain(value) : undefined
  for (const cookie of cookiePairs(value, setCookie)) {
    if (looksLikePreviewAuthCookie(cookie.name, domain, host, previewHost)) {
      rememberCredential(cookie.value, { secrets, shortCredentials })
    }
  }
}

function collectStructuredCredentials(value, context) {
  if (Array.isArray(value)) {
    for (const child of value) collectStructuredCredentials(child, context)
    return
  }
  if (!value || typeof value !== 'object') return

  const host = objectHost(value, context.host)
  const isHeaderEntry = typeof value.name === 'string'
    && typeof value.value === 'string'
    && /headers?$/i.test(context.parentKey)
  if (isHeaderEntry) collectHeaderValue(value.name, value.value, { ...context, host })

  const isCookieRecord = typeof value.name === 'string'
    && typeof value.value === 'string'
    && (context.parentKey.toLowerCase() === 'cookies'
      || ['domain', 'path', 'expires', 'httpOnly', 'secure', 'sameSite'].some(key => key in value))
  if (isCookieRecord) collectCookieValue(value, { ...context, host })

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase()
    if (normalizedKey === 'cookie' || normalizedKey === 'set-cookie' || sensitiveHeaderNames.has(normalizedKey)) {
      collectHeaderValue(key, child, { ...context, host })
    }
    if (normalizedKey === 'value' && typeof child === 'string' && isCookieRecord) continue
    if (child && typeof child === 'object') {
      collectStructuredCredentials(child, { ...context, host, parentKey: key })
    }
  }
}

function decodeText(bytes, knownText) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    if (knownText) throw new Error('A text diagnostic artifact was not valid UTF-8.')
    return undefined
  }
}

function isZip(bytes) {
  return bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && [0x03, 0x05, 0x07].includes(bytes[2])
    && [0x04, 0x06, 0x08].includes(bytes[3])
}

function unzipBounded(bytes) {
  if (bytes.byteLength > maxArchiveBytes) throw new Error('A diagnostic archive exceeded its compressed size limit.')
  let memberCount = 0
  let totalSize = 0
  let invalidReason
  const files = unzipSync(bytes, {
    filter(info) {
      memberCount += 1
      if (memberCount > maxArchiveMembers) invalidReason = 'too many entries'
      else if (!Number.isSafeInteger(info.originalSize) || info.originalSize < 0 || info.originalSize > maxArchiveMemberBytes) {
        invalidReason = 'an entry exceeded its size limit'
      } else {
        totalSize += info.originalSize
        if (totalSize > maxArchiveTotalBytes) invalidReason = 'the archive exceeded its total size limit'
      }
      return !invalidReason
    },
  })
  if (invalidReason) throw new Error(`A diagnostic archive was rejected because ${invalidReason}.`)
  return files
}

function addJsonCredentials(text, state) {
  const visit = line => {
    let parsed
    try {
      parsed = JSON.parse(line)
    } catch {
      return false
    }
    collectStructuredCredentials(parsed, {
      host: undefined,
      parentKey: '',
      previewHost: state.previewHost,
      secrets: state.secrets,
      shortCredentials: state.shortCredentials,
    })
    return true
  }

  if (visit(text)) return
  for (const line of text.split(/\r?\n/)) visit(line)
}

function htmlArchiveMatches(text) {
  const pattern = new RegExp(htmlReportArchive.source, htmlReportArchive.flags)
  const matches = [...text.matchAll(pattern)]
  const hasReportArchiveMarker = /<template\b[^>]*\bid=["']playwrightReportBase64["']/i.test(text)
  if (hasReportArchiveMarker && matches.length === 0) {
    throw new Error('The HTML report contained an unrecognized embedded Playwright archive.')
  }
  return matches
}

function collectEmbeddedHtmlCredentials(text, state, depth) {
  if (depth > maxEmbeddedArchiveDepth) throw new Error('Embedded Playwright report archives were nested too deeply.')
  for (const match of htmlArchiveMatches(text)) {
    const archive = Buffer.from(match[2].replaceAll(/\s/g, ''), 'base64')
    if (!isZip(archive)) throw new Error('The HTML report contained an invalid embedded Playwright archive.')
    collectArchiveCredentials(archive, state, depth + 1)
  }
}

function collectTextCredentials(text, state, depth = 0) {
  addJsonCredentials(text, state)
  if (/<html\b|<template\b/i.test(text)) collectEmbeddedHtmlCredentials(text, state, depth)
}

function collectArchiveCredentials(bytes, state, depth = 0) {
  if (depth > maxEmbeddedArchiveDepth) throw new Error('Diagnostic archives were nested too deeply.')
  const files = unzipBounded(bytes)
  for (const [name, contents] of Object.entries(files)) {
    if (isZip(contents)) {
      collectArchiveCredentials(contents, state, depth + 1)
      continue
    }
    const text = decodeText(contents, textExtensions.has(extname(name).toLowerCase()))
    if (text !== undefined) collectTextCredentials(text, state, depth)
  }
}

function collectFileCredentials(path, state) {
  const contents = readFileSync(path)
  if (contents.byteLength > maxArchiveBytes && path.toLowerCase().endsWith('.zip')) {
    throw new Error('A diagnostic archive exceeded its compressed size limit.')
  }
  if (path.toLowerCase().endsWith('.zip') || isZip(contents)) {
    collectArchiveCredentials(contents, state)
    return
  }
  const text = decodeText(contents, textExtensions.has(extname(path).toLowerCase()))
  if (text !== undefined) collectTextCredentials(text, state)
}

function filesInRoot(root) {
  if (!existsSync(root)) return []
  const rootStat = lstatSync(root)
  if (rootStat.isSymbolicLink()) throw new Error('A Playwright diagnostic output path cannot be a symbolic link.')
  if (rootStat.isFile()) return [root]
  if (!rootStat.isDirectory()) return []

  const files = []
  const visit = (directory, depth) => {
    if (depth > maxDirectoryDepth) throw new Error('Playwright diagnostic output was nested too deeply.')
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('A Playwright diagnostic output cannot contain symbolic links.')
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) visit(path, depth + 1)
      else if (entry.isFile()) {
        files.push(path)
        if (files.length > maxFilesPerRoot) throw new Error('Playwright diagnostic output contained too many files.')
      }
    }
  }
  visit(root, 0)
  return files
}

function credentialVariants(secret) {
  const variants = new Set([secret, encodeURIComponent(secret)])
  const jsonEscaped = JSON.stringify(secret).slice(1, -1)
  if (jsonEscaped) variants.add(jsonEscaped)
  for (const value of [...variants]) {
    variants.add(value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'))
  }
  return [...variants].filter(Boolean).sort((left, right) => right.length - left.length)
}

function containsKnownCredential(value, context) {
  const credentials = [...context.secrets, ...context.shortCredentials]
  return credentials.some(credential => credentialVariants(credential).includes(value))
}

function redactKnownCredentials(text, secrets) {
  let result = text
  for (const secret of secrets) {
    for (const variant of credentialVariants(secret)) result = result.replaceAll(variant, '[REDACTED]')
  }
  return result
}

function containsShortCredential(text, shortCredentials) {
  return [...shortCredentials].some(credential => text.includes(credential))
}

function containsCredentialHeaderLine(text) {
  return text.split(/\r?\n/).some(line => credentialHeaderLine.test(line))
}

function redactDiagnosticString(value, context) {
  if (context.diagnosticPayload
    && (containsCredentialHeaderLine(value) || containsShortCredential(value, context.shortCredentials))) {
    return '[REDACTED]'
  }
  return redactKnownCredentials(value, context.secrets)
}

function isDiagnosticPayloadField(parent, normalizedKey) {
  if (diagnosticPayloadKeys.has(normalizedKey)) return true
  const eventType = typeof parent.type === 'string' ? parent.type.toLowerCase() : ''
  if (eventType === 'error') return ['message', 'stack'].includes(normalizedKey)
  if (eventType === 'log') return normalizedKey === 'message'
  if (eventType === 'console') return ['args', 'text'].includes(normalizedKey)
  return false
}

function redactPlainLine(value, state, allowShortCredentials) {
  if (allowShortCredentials
    && (credentialHeaderLine.test(value) || containsShortCredential(value, state.shortCredentials))) return '[REDACTED]'
  return redactKnownCredentials(value, state.secrets)
}

function redactCookieHeader(name, value, context) {
  if (typeof value !== 'string') return value
  const headerName = String(name).toLowerCase()
  if (sensitiveHeaderNames.has(headerName)) return '[REDACTED]'
  if (headerName !== 'cookie' && headerName !== 'set-cookie') return value

  const setCookie = headerName === 'set-cookie'
  const domain = setCookie ? setCookieDomain(value) : undefined
  const pairs = cookiePairs(value, setCookie)
  const isSensitiveCookie = cookie => looksLikePreviewAuthCookie(cookie.name, domain, context.host, context.previewHost)
    || containsKnownCredential(cookie.value, context)
  if (!pairs.some(isSensitiveCookie)) {
    return redactKnownCredentials(value, context.secrets)
  }
  if (setCookie) return '[REDACTED]'
  return pairs.map(cookie => isSensitiveCookie(cookie)
    ? `${cookie.name}=[REDACTED]`
    : `${cookie.name}=${cookie.value}`).join('; ')
}

function redactStructuredValue(value, context) {
  if (Array.isArray(value)) return value.map(child => redactStructuredValue(child, context))
  if (typeof value === 'string') return redactDiagnosticString(value, context)
  if (!value || typeof value !== 'object') return value

  const host = objectHost(value, context.host)
  const isHeaderEntry = typeof value.name === 'string'
    && typeof value.value === 'string'
    && /headers?$/i.test(context.parentKey)
  const isCookieRecord = typeof value.name === 'string'
    && typeof value.value === 'string'
    && (context.parentKey.toLowerCase() === 'cookies'
      || ['domain', 'path', 'expires', 'httpOnly', 'secure', 'sameSite'].some(key => key in value))
  const isInlineAttachment = context.parentKey === 'attachments'
    && typeof value.name === 'string'
    && typeof value.contentType === 'string'
    && Object.hasOwn(value, 'body')
  const result = {}

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase()
    const diagnosticPayload = context.diagnosticPayload || isDiagnosticPayloadField(value, normalizedKey)
    if (isInlineAttachment && key === 'body') {
      result[key] = ''
    } else if (isInlineAttachment && key === 'contentType') {
      result[key] = 'text/plain'
    } else if (isInlineAttachment && key === 'name') {
      const safeName = redactDiagnosticString(child, { ...context, host, parentKey: key, diagnosticPayload })
      const suffix = ' [inline body redacted]'
      result[key] = safeName.endsWith(suffix) ? safeName : `${safeName}${suffix}`
    } else if (isHeaderEntry && normalizedKey === 'value') {
      result[key] = redactCookieHeader(value.name, child, { ...context, host })
    } else if (isCookieRecord && normalizedKey === 'value'
      && looksLikePreviewAuthCookie(value.name, value.domain, host, context.previewHost)) {
      result[key] = '[REDACTED]'
    } else if (normalizedKey === 'cookie' || normalizedKey === 'set-cookie' || sensitiveHeaderNames.has(normalizedKey)) {
      result[key] = redactCookieHeader(key, child, { ...context, host })
    } else if (child && typeof child === 'object') {
      result[key] = redactStructuredValue(child, {
        ...context,
        host,
        parentKey: key,
        diagnosticPayload,
      })
    } else {
      result[key] = typeof child === 'string'
        ? redactDiagnosticString(child, {
            ...context,
            host,
            parentKey: key,
            diagnosticPayload,
          })
        : child
    }
  }
  return result
}

function preserveIndentation(original, replacement) {
  if (original.includes('\r\n')) return `${replacement.replaceAll('\n', '\r\n')}\r\n`
  if (original.includes('\n')) return `${replacement}\n`
  return replacement
}

function redactJsonRecord(line, state) {
  const parsed = JSON.parse(line)
  const safe = redactStructuredValue(parsed, {
    host: undefined,
    parentKey: '',
    previewHost: state.previewHost,
    secrets: state.secrets,
    shortCredentials: state.shortCredentials,
    diagnosticPayload: false,
  })
  return JSON.stringify(safe)
}

function sanitizeStructuredText(text, state, compactRecords, allowShortCredentials) {
  if (compactRecords) {
    try {
      const sanitized = redactJsonRecord(text, state)
      const lineEnding = text.match(/(?:\r\n|\n)$/)?.[0] ?? ''
      return `${sanitized}${lineEnding}`
    } catch {
      const lines = text.split(/(\r?\n)/)
      for (let index = 0; index < lines.length; index += 2) {
        try {
          lines[index] = redactJsonRecord(lines[index], state)
        } catch {
          lines[index] = redactPlainLine(lines[index], state, allowShortCredentials)
        }
      }
      return lines.join('')
    }
  }

  try {
    const parsed = JSON.parse(text)
    const safe = redactStructuredValue(parsed, {
      host: undefined,
      parentKey: '',
      previewHost: state.previewHost,
      secrets: state.secrets,
      shortCredentials: state.shortCredentials,
      diagnosticPayload: false,
    })
    return preserveIndentation(text, JSON.stringify(safe, null, 2))
  } catch {
    const lines = text.split(/(\r?\n)/)
    for (let index = 0; index < lines.length; index += 2) {
      try {
        const parsed = JSON.parse(lines[index])
        const safe = redactStructuredValue(parsed, {
          host: undefined,
          parentKey: '',
          previewHost: state.previewHost,
          secrets: state.secrets,
          shortCredentials: state.shortCredentials,
          diagnosticPayload: false,
        })
        lines[index] = JSON.stringify(safe)
      } catch {
        lines[index] = redactPlainLine(lines[index], state, allowShortCredentials)
      }
    }
    return lines.join('')
  }
}

function sanitizeErrorContextMarkdown(text, state) {
  const lines = text.split(/(\r?\n)/)
  let inErrorDetails = false
  for (let index = 0; index < lines.length; index += 2) {
    const heading = lines[index].match(/^\s*#{1,6}\s+(.+?)\s*#*\s*$/)
    if (heading) inErrorDetails = /^error details(?:\b|\s)/i.test(heading[1])
    lines[index] = redactPlainLine(lines[index], state, inErrorDetails)
  }
  return lines.join('')
}

function isPlainDiagnosticLog(filename) {
  const normalizedPath = filename.replaceAll('\\', '/').toLowerCase()
  if (/(^|\/)(?:src|resources)\//.test(normalizedPath)) return false
  const baseName = normalizedPath.split('/').at(-1) ?? ''
  return extname(baseName) === '.log' || /^(?:stdout|stderr)(?:[-_.].*)?\.txt$/.test(baseName)
}

function sanitizeArchive(bytes, state, depth = 0) {
  if (depth > maxEmbeddedArchiveDepth) throw new Error('Diagnostic archives were nested too deeply.')
  const files = unzipBounded(bytes)
  const safeEntries = {}

  for (const [name, contents] of Object.entries(files)) {
    if (isZip(contents)) {
      safeEntries[name] = [sanitizeArchive(contents, state, depth + 1), { level: 0 }]
      continue
    }
    const text = decodeText(contents, textExtensions.has(extname(name).toLowerCase()))
    if (text === undefined) {
      safeEntries[name] = [contents, { level: 0 }]
      continue
    }
    const safeText = sanitizeText(text, state, depth, name)
    safeEntries[name] = [Buffer.from(safeText, 'utf8'), { level: 6 }]
  }

  return zipSync(safeEntries, { level: 6 })
}

function sanitizeEmbeddedHtml(text, state, depth) {
  const matches = htmlArchiveMatches(text)
  if (!matches.length) return text
  return text.replace(htmlReportArchive, (_match, prefix, archiveText, suffix) => {
    const archive = Buffer.from(archiveText.replaceAll(/\s/g, ''), 'base64')
    if (!isZip(archive)) throw new Error('The HTML report contained an invalid embedded Playwright archive.')
    const sanitized = sanitizeArchive(archive, state, depth + 1)
    return `${prefix}${Buffer.from(sanitized).toString('base64')}${suffix}`
  })
}

function sanitizeText(text, state, depth = 0, filename = '') {
  const extension = extname(filename).toLowerCase()
  const startsAsHtml = /^\s*(?:<!doctype\s+html|<html\b)/i.test(text)
  if (extension === '.html' || startsAsHtml) {
    if (htmlArchiveMatches(text).length > 0) return sanitizeEmbeddedHtml(text, state, depth)
    return redactKnownCredentials(text, state.secrets)
  }
  if (extension === '.md' && filename.toLowerCase().endsWith('error-context.md')) {
    return sanitizeErrorContextMarkdown(text, state)
  }
  const normalizedPath = filename.replaceAll('\\', '/').toLowerCase()
  if (['.css', '.js'].includes(extension) || /(^|\/)src\//.test(normalizedPath)) {
    return redactKnownCredentials(text, state.secrets)
  }
  const compactRecords = ['.network', '.trace'].includes(extension)
  return sanitizeStructuredText(text, state, compactRecords, isPlainDiagnosticLog(filename))
}

function atomicReplace(path, bytes) {
  const temporaryPath = `${path}.playwright-sanitize-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`
  const backupPath = `${path}.playwright-backup-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`
  try {
    writeFileSync(temporaryPath, bytes, { flag: 'wx' })
    try {
      renameSync(temporaryPath, path)
    } catch (error) {
      if (!['EACCES', 'EEXIST', 'EPERM'].includes(error.code) || !existsSync(path)) throw error
      renameSync(path, backupPath)
      try {
        renameSync(temporaryPath, path)
      } catch (replacementError) {
        try {
          renameSync(backupPath, path)
        } catch {
          // The caller's fail-closed cleanup removes the owned output root.
        }
        throw replacementError
      }
      rmSync(backupPath, { force: true })
    }
  } catch (error) {
    rmSync(temporaryPath, { force: true })
    throw error
  }
}

function sanitizeFile(path, state) {
  const stat = statSync(path)
  if (stat.size > maxArchiveBytes * 2) throw new Error('A Playwright diagnostic file exceeded its size limit.')
  const contents = readFileSync(path)
  if (path.toLowerCase().endsWith('.zip') || isZip(contents)) {
    atomicReplace(path, sanitizeArchive(contents, state))
    return
  }
  const text = decodeText(contents, textExtensions.has(extname(path).toLowerCase()))
  if (text === undefined) return
  const safeText = sanitizeText(text, state, 0, path)
  if (safeText !== text) atomicReplace(path, Buffer.from(safeText, 'utf8'))
}

function artifactKind(path) {
  const extension = extname(path).toLowerCase()
  if (extension === '.zip') return 'archive'
  if (extension === '.html') return 'html-report'
  if (['.trace', '.network', '.har'].includes(extension)) return 'trace-data'
  return 'file'
}

function diagnosticFailureReason(error, kind) {
  const code = error && typeof error === 'object' ? error.code : undefined
  if (['EACCES', 'EBUSY', 'EEXIST', 'EIO', 'EMFILE', 'ENFILE', 'ENOENT', 'ENOSPC', 'EPERM'].includes(code)) {
    return `filesystem-${code.toLowerCase()}`
  }

  const message = error instanceof Error ? error.message : ''
  if (/size limit|too many (?:entries|files)|nested too deeply/i.test(message)) return 'resource-limit'
  if (/symbolic link|repository-owned|workspace root/i.test(message)) return 'unsafe-output-path'
  if (/not valid utf-8/i.test(message)) return 'invalid-text'
  if (['archive', 'html-report'].includes(kind) && /archive|zip|html report/i.test(message)) return 'invalid-report-archive'
  if (kind === 'trace-data' && /archive|zip/i.test(message)) return 'invalid-trace-archive'
  if (kind === 'report') return 'report-processing-failed'
  if (kind === 'trace-data') return 'trace-processing-failed'
  return 'artifact-processing-failed'
}

function createSanitizationFailure(error, phase, item, kind) {
  const safeError = new Error(
    `Playwright diagnostics could not be sanitized (phase=${phase}; reason=${diagnosticFailureReason(error, kind)}; artifact=${kind}; item=${item}); diagnostic uploads are blocked.`,
  )
  safeError.name = 'PlaywrightArtifactSanitizationError'
  return safeError
}

function collectSecrets(paths, state) {
  let item = 0
  const seenFiles = new Set()
  for (const root of paths) {
    let files
    try {
      files = filesInRoot(root)
    } catch (error) {
      throw createSanitizationFailure(error, 'collect-credentials', item + 1, 'output-root')
    }
    for (const path of files) {
      if (seenFiles.has(path)) continue
      seenFiles.add(path)
      item += 1
      const kind = artifactKind(path)
      try {
        collectFileCredentials(path, state)
      } catch (error) {
        throw createSanitizationFailure(error, 'collect-credentials', item, kind)
      }
    }
  }
}

function sanitizePaths(paths, state) {
  let item = 0
  const seenFiles = new Set()
  for (const root of paths) {
    let files
    try {
      files = filesInRoot(root)
    } catch (error) {
      throw createSanitizationFailure(error, 'rewrite-artifacts', item + 1, 'output-root')
    }
    for (const file of files) {
      if (seenFiles.has(file)) continue
      seenFiles.add(file)
      item += 1
      const kind = artifactKind(file)
      try {
        sanitizeFile(file, state)
      } catch (error) {
        throw createSanitizationFailure(error, 'rewrite-artifacts', item, kind)
      }
    }
  }
}

function stateForRun(env = process.env) {
  const secrets = new Set()
  const shortCredentials = new Set()
  const bypassSecret = typeof env.VERCEL_AUTOMATION_BYPASS_SECRET === 'string'
    ? env.VERCEL_AUTOMATION_BYPASS_SECRET
    : ''
  const previewHost = previewHostname(env)
  if (bypassSecret.length > 0) {
    rememberCredential(bypassSecret, { secrets, shortCredentials })
  }
  return {
    previewHost,
    secrets,
    shortCredentials,
    credentialSanitizationRequired: Boolean(previewHost || bypassSecret),
  }
}

function outputRoots(config) {
  const configured = configuredArtifactPaths(config)
  return [...new Set([...configured.directories, ...configured.files])]
}

function safeToRemove(root, workspaceRoot) {
  const target = resolve(root)
  const relativePath = relative(workspaceRoot, target)
  return relativePath.length > 0
    && !relativePath.startsWith(`..${sep}`)
    && relativePath !== '..'
    && !isAbsolute(relativePath)
}

function isWithinWorkspace(path, workspaceRoot) {
  const relativePath = relative(workspaceRoot, resolve(path))
  return relativePath.length > 0
    && !relativePath.startsWith(`..${sep}`)
    && relativePath !== '..'
    && !isAbsolute(relativePath)
}

function hasSymbolicPathComponent(path, workspaceRoot) {
  let current = resolve(path)
  while (isWithinWorkspace(current, workspaceRoot)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) return true
    current = dirname(current)
  }
  return false
}

function removeMarker(markerPath, workspaceRoot) {
  if (hasSymbolicPathComponent(markerPath, workspaceRoot)) {
    throw new Error('The Playwright diagnostic marker path cannot contain symbolic links.')
  }
  rmSync(markerPath, { force: true })
}

function removeOwnedOutputs(paths, workspaceRoot, markerPath) {
  for (const path of paths) {
    if (!safeToRemove(path, workspaceRoot) || hasSymbolicPathComponent(path, workspaceRoot)) continue
    try {
      if (existsSync(path) && lstatSync(path).isSymbolicLink()) continue
      rmSync(path, { recursive: true, force: true })
    } catch {
      // The absent completion marker keeps CI from publishing any remaining artifacts.
    }
  }
  try {
    removeMarker(markerPath, workspaceRoot)
  } catch {
    // Marker removal failure is reported by the final verification step.
  }
}

function invalidateFailedRunOutputs(paths, state, workspaceRoot, markerPath) {
  if (state.credentialSanitizationRequired) {
    removeOwnedOutputs(paths, workspaceRoot, markerPath)
    return
  }
  try {
    removeMarker(markerPath, workspaceRoot)
  } catch {
    // A no-auth run keeps its native artifacts even if marker invalidation fails.
  }
}

function markerContents(paths, credentialSanitization) {
  return `${JSON.stringify({
    formatVersion: 1,
    completedAt: new Date().toISOString(),
    credentialSanitization,
    outputs: paths,
  }, null, 2)}\n`
}

function writeCompletionMarker(markerPath, paths, workspaceRoot, credentialSanitization) {
  if (hasSymbolicPathComponent(markerPath, workspaceRoot)) {
    throw new Error('The Playwright diagnostic marker path cannot contain symbolic links.')
  }
  mkdirSync(dirname(markerPath), { recursive: true })
  atomicReplace(markerPath, Buffer.from(markerContents(paths, credentialSanitization), 'utf8'))
}

function sanitizeArtifacts(paths, state) {
  collectSecrets(paths, state)
  sanitizePaths(paths, state)
}

function sanitizeConfiguredArtifacts(paths, state) {
  if (state.credentialSanitizationRequired) sanitizeArtifacts(paths, state)
}

export function sanitizePlaywrightArtifactPaths(paths, { previewURL, bypassSecret } = {}) {
  const state = stateForRun({
    PLAYWRIGHT_PRODUCTION_URL: previewURL,
    VERCEL_AUTOMATION_BYPASS_SECRET: bypassSecret,
  })
  sanitizeArtifacts([...new Set(paths.map(path => resolve(path)))], state)
}

export function supportsPreviewReporters(config, env = process.env) {
  return reporterEntries(config.reporter).every(({ name, options }) => {
    if (['github', 'html', 'list'].includes(name)) return true
    return name === 'json' && Boolean(jsonReporterOutputFile(config, options, env))
  })
}

/**
 * Playwright global setup that scrubs native artifacts before reporter shutdown and
 * scrubs generated reports again synchronously as the runner process exits.
 */
export default async function playwrightArtifactsGlobalSetup(config) {
  const workspaceRoot = resolveWorkspaceRoot(config)
  const markerPath = resolve(workspaceRoot, markerRelativePath)
  const paths = outputRoots(config)
  const state = stateForRun()

  removeMarker(markerPath, workspaceRoot)
  if (paths.some(path => resolve(path) === workspaceRoot)) {
    throw new Error('Playwright diagnostic output cannot use the repository root as its output directory.')
  }
  if (state.credentialSanitizationRequired
    && paths.some(path => !isWithinWorkspace(path, workspaceRoot) || hasSymbolicPathComponent(path, workspaceRoot))) {
    throw new Error('Credential-protected Playwright artifacts must stay in repository-owned, non-symlink output folders.')
  }
  if (state.credentialSanitizationRequired && !supportsPreviewReporters(config)) {
    throw new Error('Credential-protected Playwright runs require list, GitHub, HTML, or JSON-to-file reporters so retained artifacts can be scrubbed.')
  }
  if (state.credentialSanitizationRequired) process.env.PLAYWRIGHT_HTML_OPEN = 'never'

  let teardownCompleted = false
  let firstFailure

  process.once('exit', () => {
    try {
      if (!teardownCompleted) {
        throw firstFailure ?? createSanitizationFailure(
          new Error('The initial sanitation pass did not complete.'),
          'initial-pass',
          0,
          'output-root',
        )
      }
      sanitizeConfiguredArtifacts(paths, state)
      try {
        const credentialSanitization = state.credentialSanitizationRequired
          ? 'completed'
          : 'not-required-no-preview-auth'
        writeCompletionMarker(markerPath, paths, workspaceRoot, credentialSanitization)
      } catch (error) {
        throw createSanitizationFailure(error, 'write-marker', 0, 'marker')
      }
    } catch (error) {
      firstFailure ??= error instanceof Error && error.name === 'PlaywrightArtifactSanitizationError'
        ? error
        : createSanitizationFailure(error, 'exit-sanitize', 0, 'output-root')
      invalidateFailedRunOutputs(paths, state, workspaceRoot, markerPath)
      process.stderr.write(`${firstFailure.message}\n`)
      process.exitCode = 1
    }
  })

  return async () => {
    try {
      sanitizeConfiguredArtifacts(paths, state)
      teardownCompleted = true
    } catch (error) {
      firstFailure = error
      firstFailure = firstFailure instanceof Error && firstFailure.name === 'PlaywrightArtifactSanitizationError'
        ? firstFailure
        : createSanitizationFailure(firstFailure, 'teardown-sanitize', 0, 'output-root')
      invalidateFailedRunOutputs(paths, state, workspaceRoot, markerPath)
      throw firstFailure
    }
  }
}

export function verifyPlaywrightArtifactsSanitized(markerPath = resolve(process.cwd(), markerRelativePath)) {
  let marker
  try {
    marker = JSON.parse(readFileSync(markerPath, 'utf8'))
  } catch {
    throw new Error('Playwright artifact sanitation did not complete; diagnostic uploads are blocked.')
  }
  if (marker?.formatVersion !== 1
    || typeof marker.completedAt !== 'string'
    || !['completed', 'not-required-no-preview-auth'].includes(marker.credentialSanitization)
    || !Array.isArray(marker.outputs)) {
    throw new Error('Playwright artifact sanitation marker is invalid; diagnostic uploads are blocked.')
  }
  return marker
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    verifyPlaywrightArtifactsSanitized()
    process.stdout.write('Playwright diagnostic artifacts passed the sanitation gate.\n')
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
