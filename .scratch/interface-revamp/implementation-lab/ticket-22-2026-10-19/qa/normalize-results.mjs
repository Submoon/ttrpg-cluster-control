// Compact evidence only; never executes tests or changes application inputs.
import { readFile, writeFile } from 'node:fs/promises'
const [input, output, candidate, runtime] = process.argv.slice(2)
if (!input || !output || !candidate || !runtime) throw new Error('input output candidate runtime required')
const raw = JSON.parse(await readFile(input, 'utf8'))
const cases = []
function visit(suites) {
  for (const suite of suites || []) {
    for (const spec of suite.specs || []) for (const test of spec.tests || []) cases.push({
      file: spec.file, line: spec.line, title: spec.title, status: test.status,
      results: test.results.map(result => ({ status: result.status, durationMs: result.duration,
        errors: result.errors.map(error => ({ message: error.message, location: error.location })),
        attachments: result.attachments.map(({ name, contentType, path }) => ({ name, contentType, path })),
      })),
    })
    visit(suite.suites)
  }
}
visit(raw.suites)
await writeFile(output, JSON.stringify({ candidate, runtime, workers: raw.config.workers,
  retries: 0, maxFailures: raw.config.maxFailures, timeouts: 'Canonical unchanged',
  stats: raw.stats, discovered: cases.length, executed: cases.filter(test => test.results.some(result => result.status !== 'skipped')).length,
  cases, runnerErrors: raw.errors,
}, null, 2) + '\n')
