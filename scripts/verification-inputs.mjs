const ROOT_DOCUMENTS = new Set([
  'README.md',
  'AGENTS.md',
  'CONTEXT.md',
  'GLOSSARY.md',
])

function containsControlCharacter(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 32 || code === 127) return true
  }
  return false
}

/**
 * Returns whether a POSIX-style repository-relative path is maintained documentation.
 * Invalid, absolute, ambiguous, or non-Markdown paths are never documentation inputs.
 * @param {string} path
 */
export function isDocumentationPath(path) {
  if (typeof path !== 'string'
    || path.length === 0
    || path.includes('\\')
    || containsControlCharacter(path)
    || path.startsWith('/')
    || path.endsWith('/')
    || /^[A-Za-z]:\//.test(path)
    || path.includes('//')
    || /(^|\/)\.{1,2}(\/|$)/.test(path)) {
    return false
  }

  if (ROOT_DOCUMENTS.has(path)) return true
  if (!/\.md$/i.test(path)) return false
  return path.startsWith('docs/')
    || path.startsWith('.scratch/')
    || path.startsWith('.agents/skills/')
}
