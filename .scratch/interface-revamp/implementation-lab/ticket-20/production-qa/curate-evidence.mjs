import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const dir = dirname(fileURLToPath(import.meta.url))
const read = async name => JSON.parse(await readFile(join(dir, name), 'utf8'))
const raw = await read('final-results.json'), screenshot = await read('final-screenshot-settlement.json')
const digest = value => createHash('sha256').update(value).digest('hex')
const minimum = kind => raw.contrast.filter(row => row.kind === kind).sort((a, b) => a.minimum - b.minimum)[0]
const compact = {
  candidate: raw.candidate, baseline: raw.baseline, timestamp: raw.timestamp,
  build: { outcome: 'passed', elapsed: '1m53s', entry: '.output/server/index.mjs', identity: raw.identity },
  runtime: { base: raw.base, route: raw.route, browser: raw.browser, stopped: true, port3120Free: true },
  matrix: { viewports: ['1440x900', '390x844', '844x390', '390x500'], palettes: ['light', 'dark'], observations: raw.checks.length, passed: raw.checks.filter(c => c.passed).length, contrastSamples: raw.contrast.length },
  portable: { passed: 25, failed: 0, chart: 19, theme: 4, launch: 2, elapsed: '52.8s', config: 'playwright.compiled.config.ts' },
  minima: Object.fromEntries(['text', 'control', 'focus', 'glyph'].map(kind => { const row = minimum(kind); return [kind, { minimum: row.minimum, threshold: row.threshold, label: row.label }] })),
  fixtures: raw.fixtures, downloads: raw.downloads,
  errors: { console: raw.console, page: raw.pageerrors, externalRequests: raw.externalRequests },
  observations: raw.checks.map(({name, passed}) => ({ name, passed })),
  contrast: raw.contrast.map(({label, kind, minimum, threshold}) => ({label, kind, minimum, threshold})),
  representativeFocus: raw.checks.filter(c => c.name.includes('full focused cue')).slice(0, 3),
  screenshotFollowUp: { reason: 'The first reduced-height invalid-modal screenshot caught a finite opening animation. Only this case was rerun on unchanged compiled output after explicit settlement; its observations are not added to the matrix totals.', observations: screenshot.checks.length, failed: screenshot.checks.filter(c => !c.passed).length, settledModal: screenshot.checks.find(c => c.name.includes('settled and opaque')) },
  diagnostics: { rawFinalSha256: digest(await readFile(join(dir, 'final-results.json'))), firstFinalAttempt: 'Modal-close inert/animation timing in requestCluster caused four harness execution failures. Preserved locally as final-attempt-transition-diagnostic.json; excluded from final acceptance totals.', oldCandidate: 'b9d51ba27510427e31da780e1777a642a4499b28 had weak modal focus outlines; old-candidate-findings.md and candidate-source-identity.json remain separate.' },
  limitations: raw.limitations,
}
await writeFile(join(dir, 'acceptance-results.json'), JSON.stringify(compact, null, 2) + '\n')
const curatedFiles = ['final-summary.md', 'acceptance-results.json', 'final-source-identity.json', 'check-production.mjs', 'presentation.mjs', 'platform-hooks.mjs', 'playwright.compiled.config.ts', 'curate-evidence.mjs', 'desktop-light-recovery-viewport.png', '844x390-light-guard-viewport.png', '390x500-dark-invalid-modal-viewport.png', '390x844-dark-feedback-viewport.png']
await writeFile(join(dir, 'evidence-manifest.json'), JSON.stringify({ candidate: raw.candidate, purpose: 'Curated final evidence only; raw logs, failed attempts, browser outputs and old-candidate diagnostics remain local and are not acceptance totals.', files: await Promise.all(curatedFiles.map(async file => { const content = await readFile(join(dir, file)); return { file, bytes: content.length, sha256: digest(content) } })) }, null, 2) + '\n')
console.log(JSON.stringify({ matrix: compact.matrix, minima: compact.minima, screenshot: compact.screenshotFollowUp.settledModal }, null, 2))
