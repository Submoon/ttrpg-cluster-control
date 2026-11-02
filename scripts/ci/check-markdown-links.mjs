import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.nuxt',
  '.output',
  'coverage',
  'node_modules',
  'playwright-report',
  'test-results',
])
const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024

function markdownExtension(path) {
  return path.toLowerCase().endsWith('.md')
}

function normalizeLabel(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function removeFencedCode(markdown) {
  const lines = markdown.split(/(?<=\n)/)
  let fence = undefined
  return lines.map(line => {
    const content = line.replace(/\r?\n$/, '')
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(content)
    if (fence) {
      if (marker && marker[1]?.[0] === fence.marker && marker[1].length >= fence.length
        && new RegExp(`^ {0,3}${fence.marker}{${fence.length},}\\s*$`).test(content)) {
        fence = undefined
      }
      return '\n'.repeat((line.match(/\n/g) ?? []).length)
    }
    if (marker) fence = { marker: marker[1]?.[0] ?? '`', length: marker[1]?.length ?? 3 }
    return fence ? '\n'.repeat((line.match(/\n/g) ?? []).length) : line
  }).join('')
}

function removeInlineCode(markdown) {
  return markdown.replace(/(`+)([\s\S]*?)\1/g, (match) => '\n'.repeat((match.match(/\n/g) ?? []).length))
}

function headingSlug(value) {
  const text = value
    .replace(/<[^>]*>/g, '')
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*|\*|~~/g, '')
    .replace(/(^|[^\p{L}\p{N}\p{M}_])__(\S(?:.*?\S)?)__(?=$|[^\p{L}\p{N}\p{M}_])/gu, '$1$2')
    .replace(/(^|[^\p{L}\p{N}\p{M}_])_(\S(?:.*?\S)?)_(?=$|[^\p{L}\p{N}\p{M}_])/gu, '$1$2')
    .toLocaleLowerCase('en-US')
    .trim()
  return text
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function getHeadings(markdown) {
  const headings = new Set()
  const occurrences = new Map()
  const lines = removeFencedCode(markdown).split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const atx = /^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)
    const underline = index + 1 < lines.length && /^ {0,3}(=+|-+)\s*$/.test(lines[index + 1] ?? '')
    const rawHeading = atx?.[1] ?? (underline ? line.trim() : undefined)
    if (!rawHeading) continue
    const base = headingSlug(rawHeading)
    if (!base) continue
    const count = occurrences.get(base) ?? 0
    occurrences.set(base, count + 1)
    headings.add(count === 0 ? base : `${base}-${count}`)
  }
  return headings
}

function lineAt(markdown, offset) {
  let line = 1
  for (let index = 0; index < offset; index += 1) if (markdown[index] === '\n') line += 1
  return line
}

function inlineDestinationAt(markdown, start) {
  let cursor = start
  while (cursor < markdown.length && /\s/.test(markdown[cursor] ?? '')) cursor += 1
  if (markdown[cursor] === '<') {
    const destinationStart = cursor + 1
    cursor = destinationStart
    while (cursor < markdown.length) {
      if (markdown[cursor] === '\\') {
        cursor += 2
        continue
      }
      if (markdown[cursor] === '>') {
        return { destination: markdown.slice(destinationStart, cursor), closed: true }
      }
      if (markdown[cursor] === '\n') return undefined
      cursor += 1
    }
    return undefined
  }

  const destinationStart = cursor
  let nestedParentheses = 0
  while (cursor < markdown.length) {
    const character = markdown[cursor]
    if (character === '\\') {
      cursor += 2
      continue
    }
    if (character === '(') nestedParentheses += 1
    if (character === ')') {
      if (nestedParentheses === 0) {
        return { destination: markdown.slice(destinationStart, cursor), closed: true }
      }
      nestedParentheses -= 1
    }
    if (/\s/.test(character ?? '') && nestedParentheses === 0) {
      return { destination: markdown.slice(destinationStart, cursor), closed: true }
    }
    cursor += 1
  }
  return undefined
}

function extractLocalDestinations(markdown) {
  const cleanMarkdown = removeInlineCode(removeFencedCode(markdown))
  const destinations = []
  const definitions = new Map()
  const definitionPattern = /^ {0,3}\[([^\]]+)\]:\s*(?:<([^>\n]*)>|(\S+))(?:\s+.*)?$/gm
  let match
  while ((match = definitionPattern.exec(cleanMarkdown)) !== null) {
    const label = normalizeLabel(match[1] ?? '')
    const destination = match[2] ?? match[3] ?? ''
    definitions.set(label, { destination, offset: match.index })
    destinations.push({ destination, offset: match.index })
  }

  const inlinePattern = /\]\(/g
  while ((match = inlinePattern.exec(cleanMarkdown)) !== null) {
    const parsed = inlineDestinationAt(cleanMarkdown, inlinePattern.lastIndex)
    if (parsed?.closed) destinations.push({ destination: parsed.destination, offset: match.index })
  }

  const referencePattern = /!?\[([^\]\n]+)\](?:\[([^\]\n]*)\])?/g
  while ((match = referencePattern.exec(cleanMarkdown)) !== null) {
    const label = normalizeLabel(match[2] || match[1] || '')
    const definition = definitions.get(label)
    if (definition && !destinations.some(item => item.offset === definition.offset)) {
      destinations.push({ destination: definition.destination, offset: match.index })
    }
  }

  return destinations.map(item => ({ ...item, line: lineAt(cleanMarkdown, item.offset) }))
}

function isExternalDestination(destination) {
  return /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/.test(destination.trim())
}

function decodePart(value, source, line, errors) {
  try {
    return decodeURIComponent(value)
  } catch {
    errors.push(`Markdown link error: ${source}:${line}: local link contains invalid percent encoding.`)
    return undefined
  }
}

function safeLogText(value) {
  return Array.from(value, character => {
    const code = character.codePointAt(0) ?? 0
    return code < 32 || code === 127 ? `\\u${code.toString(16).padStart(4, '0')}` : character
  }).join('')
}

function targetInsideRoot(root, source, destinationPath) {
  const sourceDirectory = resolve(root, source, '..')
  const target = destinationPath.startsWith('/')
    ? resolve(root, `.${destinationPath}`)
    : resolve(sourceDirectory, destinationPath || source.split('/').at(-1) || '')
  const pathFromRoot = relative(root, target)
  return target === root || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..' && !pathFromRoot.startsWith(sep))
    ? target
    : undefined
}

async function safeStat(root, target) {
  const relativePath = relative(root, target)
  const parts = relativePath === '' ? [] : relativePath.split(sep)
  let current = root
  let info
  for (const part of parts) {
    current = resolve(current, part)
    try {
      info = await lstat(current)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return undefined
      throw error
    }
    if (info.isSymbolicLink()) return { unsafeSymlink: true }
  }
  return info ? { info, path: current } : { info: await lstat(root), path: root }
}

async function collectMarkdownFiles(root, directory = root, files = []) {
  const entries = await readdir(directory, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name))
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isSymbolicLink()) {
      if (markdownExtension(entry.name)) files.push(path)
      continue
    }
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) await collectMarkdownFiles(root, path, files)
    } else if (entry.isFile() && markdownExtension(entry.name)) {
      files.push(path)
    }
  }
  return files
}

/**
 * Checks every repository Markdown file for local file and heading links without following symlinks.
 * External destinations and examples inside fenced or inline code are ignored.
 * @param {string} repositoryRoot
 * @returns {Promise<string[]>}
 */
export async function checkMarkdownLinks(repositoryRoot) {
  const root = await realpath(repositoryRoot)
  const files = await collectMarkdownFiles(root)
  const errors = []
  const contents = new Map()
  const headings = new Map()
  const displayPath = path => safeLogText(relative(root, path).split(sep).join('/') || '.')

  for (const file of files) {
    const info = await lstat(file)
    if (info.isSymbolicLink()) {
      errors.push(`Markdown link error: ${displayPath(file)}: Markdown source is a symbolic link and was not followed.`)
      continue
    }
    if (info.size > MAX_MARKDOWN_BYTES) {
      errors.push(`Markdown link error: ${displayPath(file)}: Markdown file exceeds the ${MAX_MARKDOWN_BYTES}-byte check limit.`)
      continue
    }
    const text = await readFile(file, 'utf8')
    contents.set(file, text)
    headings.set(file, getHeadings(text))
  }

  for (const [file, markdown] of contents) {
    const source = displayPath(file)
    for (const item of extractLocalDestinations(markdown)) {
      const rawDestination = item.destination.trim()
      if (!rawDestination || isExternalDestination(rawDestination)) continue
      const hashAt = rawDestination.indexOf('#')
      const beforeFragment = hashAt < 0 ? rawDestination : rawDestination.slice(0, hashAt)
      const queryAt = beforeFragment.indexOf('?')
      const rawPath = queryAt < 0 ? beforeFragment : beforeFragment.slice(0, queryAt)
      const rawFragment = hashAt < 0 ? '' : rawDestination.slice(hashAt + 1).split('?')[0] ?? ''
      const decodedPath = decodePart(rawPath, source, item.line, errors)
      const decodedFragment = decodePart(rawFragment, source, item.line, errors)
      if (decodedPath === undefined || decodedFragment === undefined) continue

      const target = targetInsideRoot(root, source, decodedPath)
      if (!target) {
        errors.push(`Markdown link error: ${source}:${item.line}: local link "${safeLogText(rawDestination)}" escapes the repository.`)
        continue
      }

      let targetInfo
      try {
        targetInfo = await safeStat(root, target)
      } catch {
        errors.push(`Markdown link error: ${source}:${item.line}: could not inspect local link "${safeLogText(rawDestination)}".`)
        continue
      }
      if (!targetInfo) {
        errors.push(`Markdown link error: ${source}:${item.line}: local link target "${safeLogText(rawDestination)}" does not exist.`)
        continue
      }
      if (targetInfo.unsafeSymlink) {
        errors.push(`Markdown link error: ${source}:${item.line}: local link target "${safeLogText(rawDestination)}" uses a symbolic link.`)
        continue
      }

      let targetFile = targetInfo.path
      if (targetInfo.info?.isDirectory()) {
        const candidates = [resolve(targetFile, 'index.md'), resolve(targetFile, 'README.md')]
        targetFile = candidates.find(candidate => contents.has(candidate)) ?? targetFile
      }
      if (decodedFragment && contents.has(targetFile)) {
        const normalizedFragment = decodedFragment.toLocaleLowerCase('en-US')
        if (!headings.get(targetFile)?.has(normalizedFragment)) {
          errors.push(`Markdown link error: ${source}:${item.line}: heading "#${safeLogText(decodedFragment)}" does not exist in "${displayPath(targetFile)}".`)
        }
      }
    }
  }
  return errors
}

async function main() {
  const root = resolve(process.env.GITHUB_WORKSPACE ?? process.cwd())
  const errors = await checkMarkdownLinks(root)
  if (errors.length > 0) {
    for (const error of errors) console.error(error)
    process.exitCode = 1
    return
  }
  console.log('Markdown local links and heading references passed.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : 'Markdown link checks failed.')
    process.exitCode = 1
  })
}
