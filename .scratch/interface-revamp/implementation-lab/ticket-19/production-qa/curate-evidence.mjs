import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const out = dirname(fileURLToPath(import.meta.url)), digest = value => createHash('sha256').update(value).digest('hex')
const json = async file => JSON.parse(await readFile(join(out, file), 'utf8'))
const cold = await json('pre-padding-cold-results.json'), focused = await json('final-focused-results.json')
const portable = await readFile(join(out, 'compiled-portable-tests.log'), 'utf8'), portableResult = portable.match(/(\d+) passed \(([^)]+)\)/)
const instrumentationConsole = focused.console.filter(row => row.type === 'warning' && row.text.startsWith('Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true.'))
const productConsole = focused.console.filter(row => !instrumentationConsole.includes(row)), productChecks = focused.checks.filter(row => row.name !== 'no focused-check console/hydration warnings')
if (!portableResult || Number(portableResult[1]) !== 6 || productChecks.some(row => !row.passed) || productConsole.length) throw new Error('Final product checks and all six portable tests must pass before curating success evidence')
const resourceFiles = ['components/WorkspaceHeader.vue', 'components/FieldDefinitionsDialog.vue', 'assets/css/main.css', 'nuxt.config.ts', 'package.json', 'package-lock.json']
const resourceIdentity = Object.fromEntries(resourceFiles.map(file => [file, { cold: cold.identity[file], final: focused.identity[file], unchanged: cold.identity[file] === focused.identity[file] }]))
if (Object.values(resourceIdentity).some(row => !row.unchanged)) throw new Error('Resource-source identity changed; prior cold proof cannot be carried forward')
const clean = cold.contrast.filter(row => ['text', 'graphic'].includes(row.kind) && Number.isFinite(row.minimum))
const glyphs = cold.glyphs.map(row => ({ label: row.label, changedPixels: row.changedPixels, screenshotHash: row.screenshotHash, glyphs: row.rows.filter(r => r.visible).map(r => ({ className: r.className, width: r.width, height: r.height, maskOrSvgHash: digest(JSON.stringify({ mask: r.mask, paths: r.paths, backgroundImage: r.backgroundImage })) })) }))
const results = {
  timestamp: new Date().toISOString(), baseline: cold.baseline, route: '/', base: focused.base,
  finalIdentity: focused.identity, finalBrowser: focused.browser,
  finalFocused: { checks: productChecks, samples: focused.samples, network: focused.network, console: productConsole, pageerrors: focused.pageerrors, instrumentationConsole, instrumentationClassification: 'The raw console aggregate flagged only the test-owned canvas sampler performance hint. Raw warning text is retained; it is not a product/hydration warning. Canvas context options were corrected after the run without repeating the eight cases.' },
  portable: { passed: 6, duration: portableResult[2], files: { 'workspace-theme.spec.ts': 4, 'workspace-launch.spec.ts': 2 }, outputHash: digest(portable) },
  priorColdEvidence: { timestamp: cold.timestamp, runtime: cold.runtime, identity: cold.identity, browser: cold.browser, resourceIdentity, serverNetwork: cold.serverNetwork, browserNetwork: cold.network, glyphs, inventory: { count: Object.keys(cold.iconInventory.names).length, names: Object.keys(cold.iconInventory.names), responses: cold.iconInventory.responses }, console: cold.console, pageerrors: cold.pageerrors, fixtures: cold.fixtures, stateAndRecoveryChecks: cold.checks.filter(row => /rich-|recovery/.test(row.name) && !/contrast|focus/.test(row.name)), cleanContrast: clean },
  evidenceBoundary: 'Cold server/browser icons, SSR, rich-map contrast and state proof ran before the final header-padding-only adjustment. Listed resource source hashes are unchanged. Final padding output received focused eight-case responsive/focus checks and all six portable tests. Initial mid-transition and focused-border/inner-gap samples were invalid instrumentation; settled actual-state samples replace them. No injected CSS result supplies acceptance.',
  minima: { usefulText: Math.min(...clean.filter(r => r.kind === 'text').map(r => r.minimum)), meaningfulGraphic: Math.min(...clean.filter(r => r.kind === 'graphic').map(r => r.minimum)), finalControlOrFocus: Math.min(...focused.samples.map(r => r.minimum)), visibleGlyphPixels: Math.min(...glyphs.map(r => r.changedPixels)) },
  limitations: ['Physical Android Chrome, real OS keyboard, safe areas and physical gestures unavailable; Chromium touch emulation is not physical proof.', 'Bounded meaningful samples do not certify every possible workspace object/state.', 'No full test-suite repeat; implementation supplied final typecheck.']
}
await writeFile(join(out, 'results.json'), JSON.stringify(results, null, 2))
const selected = ['README.md', 'final-summary.md', 'results.json', 'network-guard.cjs', 'check-production.mjs', 'verify-settled-focus.mjs', 'curate-evidence.mjs', 'playwright.compiled.config.ts', 'rich-fixture.json', 'final-844x390-light-Fields-trigger-viewport.png', 'final-844x390-dark-Fields-trigger-viewport.png', 'final-390x844-light-Fields-trigger-viewport.png', 'final-390x500-dark-native-select-viewport.png', 'final-1440x900-light-welcome-viewport.png', 'rich-light-cluster-unselected-viewport.png', 'rich-dark-system-selected-viewport.png', '1440x900-light-initial-theme-control.png', '1440x900-dark-initial-theme-control.png']
const manifest = { note: 'Minimal curated Git evidence; raw logs and exploratory artifacts remain local. final-summary.md is written after this manifest generation.', files: {} }
for (const file of selected) { try { manifest.files[file] = digest(await readFile(join(out, file))) } catch { if (file !== 'final-summary.md') throw new Error(`Missing selected evidence ${file}`) } }
await writeFile(join(out, 'evidence-manifest.json'), JSON.stringify(manifest, null, 2))
console.log(JSON.stringify({ focusedProductChecks: productChecks.length, instrumentationWarnings: instrumentationConsole.length, portable: 6, minima: results.minima, resourcesUnchanged: true }, null, 2))
