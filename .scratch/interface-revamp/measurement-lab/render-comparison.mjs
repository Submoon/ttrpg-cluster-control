import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const lab = path.dirname(fileURLToPath(import.meta.url))
const artifacts = path.join(lab, 'artifacts')
const data = JSON.parse(await fs.readFile(path.join(artifacts, 'summary.json'), 'utf8'))
const baseline = data.desktop.baseline
const candidate = data.desktop.B
const colors = { baseline: '#34725d', candidate: '#b65a35', ink: '#1d2a29', muted: '#586461', grid: '#d9ded6', paper: '#faf9f4', panel: '#ffffff', paleGreen: '#e5f0e9', paleOrange: '#faeae2' }
const parts = []
const add = (s) => parts.push(s)
const xml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const fmt = value => Math.round(value).toLocaleString('en-US')
const text = (x, y, value, size = 15, fill = colors.ink, weight = 400, anchor = 'start') => add(`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${xml(value)}</text>`)
const line = (x1, y1, x2, y2, stroke = colors.grid, width = 1, dash = '') => add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`)
const rect = (x, y, width, height, fill, stroke = 'none', rx = 12) => add(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`)

add(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1000" viewBox="0 0 1200 1000" role="img" aria-labelledby="title desc">`)
add(`<title id="title">Wayfinder interface production measurement</title><desc id="desc">Desktop five-sample comparison of common map transitions and CDP received JavaScript and CSS bytes for baseline and accepted B with the lab-only fixture normalization.</desc>`)
add(`<rect width="1200" height="1000" fill="${colors.paper}"/>`)
text(48, 52, 'Wayfinder interface measurement', 28, colors.ink, 700)
text(48, 81, 'Production builds · desktop results · medians with observed min–max ranges', 16, colors.muted)
text(48, 109, '1440×900 · CPU throttle ×1 (host) · 20 ms latency · 10 Mbps down / 5 Mbps up · reduced motion · n=5 per arm', 13, colors.muted)
rect(48, 128, 1104, 35, '#edf0e9', 'none', 8)
rect(64, 139, 16, 12, colors.baseline, 'none', 3); text(87, 151, 'Baseline', 13, colors.ink, 600)
rect(180, 139, 16, 12, colors.candidate, 'none', 3); text(203, 151, 'B · accepted prototype + fixture-order normalization', 13, colors.ink, 600)

rect(48, 178, 1104, 326, colors.panel, '#e0e4dd')
text(72, 210, 'Common map transitions', 20, colors.ink, 700)
text(72, 233, 'Click event → SVG visible + two animation frames (paint proxy). First entry has unequal prior scenes; warm cycle follows a shared scene visit.', 12, colors.muted)
const chartX = 360, chartW = 700, maxMs = 250
for (let tick = 0; tick <= maxMs; tick += 50) {
  const x = chartX + chartW * tick / maxMs
  line(x, 260, x, 467, colors.grid, 1, '3 5')
  text(x, 253, `${tick} ms`, 11, colors.muted, 400, 'middle')
}
const transitions = [
  ['First cluster → Vela', 'clusterToVelaClickToMapPlusTwoRafMs'],
  ['First Vela → cluster', 'velaToClusterClickToMapPlusTwoRafMs'],
  ['Warm cluster → Vela', 'warmClusterToVelaClickToMapPlusTwoRafMs'],
  ['Warm Vela → cluster', 'warmVelaToClusterClickToMapPlusTwoRafMs'],
]
function rangeMark(y, statistic, color) {
  if (!statistic || statistic.n === 0) return
  const toX = value => chartX + chartW * value / maxMs
  const x1 = toX(statistic.min), x2 = toX(statistic.max), xm = toX(statistic.median)
  line(x1, y, x2, y, color, 3)
  line(x1, y - 5, x1, y + 5, color, 2)
  line(x2, y - 5, x2, y + 5, color, 2)
  add(`<circle cx="${xm}" cy="${y}" r="6" fill="${color}" stroke="#fff" stroke-width="2"/>`)
}
transitions.forEach(([label, key], index) => {
  const top = 277 + index * 49
  text(72, top + 4, label, 13, colors.ink, 600)
  const a = baseline[key], b = candidate[key]
  rangeMark(top - 5, a, colors.baseline)
  rangeMark(top + 13, b, colors.candidate)
  text(1075, top - 1, a.n ? `base ${fmt(a.median)} [${fmt(a.min)}–${fmt(a.max)}]` : 'baseline n=0', 11, a.n ? colors.baseline : colors.muted, 600)
  text(1075, top + 17, b.n ? `B ${fmt(b.median)} [${fmt(b.min)}–${fmt(b.max)}]` : 'B n=0', 11, b.n ? colors.candidate : colors.muted, 600)
})

rect(48, 522, 1104, 218, colors.panel, '#e0e4dd')
text(72, 554, 'CDP bytes received by the Fields dialog checkpoint', 20, colors.ink, 700)
text(72, 577, 'Cumulative request bytes through the native Fields dialog; same values were complete by the initial map mutation for JS/CSS.', 12, colors.muted)
const resourceGroups = [
  { label: 'JavaScript', key: 'jsBytes', x: 280, width: 330, max: 900_000 },
  { label: 'CSS', key: 'cssBytes', x: 780, width: 300, max: 300_000 },
]
for (const group of resourceGroups) {
  text(group.x, 612, group.label, 15, colors.ink, 700)
  const baseValue = baseline.resourcesAfterOverlayAndCatalogue[group.key]
  const bValue = candidate.resourcesAfterOverlayAndCatalogue[group.key]
  const barY = 629
  const barH = 20
  const baseWidth = group.width * baseValue.median / group.max
  const bWidth = group.width * bValue.median / group.max
  rect(group.x, barY, group.width, barH, '#edf0ea', 'none', 5)
  rect(group.x, barY, baseWidth, barH, colors.baseline, 'none', 5)
  text(group.x + baseWidth + 7, barY + 15, `${fmt(baseValue.median)} B`, 12, colors.baseline, 700)
  rect(group.x, barY + 35, group.width, barH, '#edf0ea', 'none', 5)
  rect(group.x, barY + 35, bWidth, barH, colors.candidate, 'none', 5)
  text(group.x + bWidth + 7, barY + 50, `${fmt(bValue.median)} B`, 12, colors.candidate, 700)
  text(group.x - 14, barY + 15, 'Baseline', 11, colors.muted, 600, 'end')
  text(group.x - 14, barY + 50, 'B', 11, colors.muted, 600, 'end')
  text(group.x, 710, `min–max: ${fmt(baseValue.min)}–${fmt(baseValue.max)} / ${fmt(bValue.min)}–${fmt(bValue.max)} B`, 11, colors.muted)
}

rect(48, 758, 1104, 118, '#f1f3ed', '#e0e4dd')
text(72, 789, 'Native first-map DOM mutation — scenes differ, shown separately', 17, colors.ink, 700)
rect(72, 804, 480, 48, colors.paleGreen, 'none', 8)
text(88, 825, `Baseline · Vela system · DOM mutation only · n=${baseline.nativeStartupToMapMutationMs.n}`, 12, colors.baseline, 700)
text(88, 843, `${fmt(baseline.nativeStartupToMapMutationMs.median)} ms [${fmt(baseline.nativeStartupToMapMutationMs.min)}–${fmt(baseline.nativeStartupToMapMutationMs.max)}]`, 13, colors.ink, 600)
rect(568, 804, 512, 48, colors.paleOrange, 'none', 8)
text(584, 825, `B · cluster · DOM mutation only · n=${candidate.nativeStartupToMapMutationMs.n}`, 12, colors.candidate, 700)
text(584, 843, `${fmt(candidate.nativeStartupToMapMutationMs.median)} ms [${fmt(candidate.nativeStartupToMapMutationMs.min)}–${fmt(candidate.nativeStartupToMapMutationMs.max)}]`, 13, colors.ink, 600)

text(48, 908, `Mobile emulation · partial n=4: baseline Vela ${fmt(data.mobilePartial.baseline.nativeStartupToMapMutationMs.median)} ms; B cluster ${fmt(data.mobilePartial.B.nativeStartupToMapMutationMs.median)} ms; B cluster→Vela ${fmt(data.mobilePartial.B.clusterToVelaClickToMapPlusTwoRafMs.median)} ms (baseline n=0).`, 11, colors.muted)
text(48, 930, 'Mobile controls were blocked by observed UI geometry: baseline hierarchy intercepted the map control; B Aster stayed out of view after Fit. Gesture and Fields comparisons n=0.', 11, colors.muted)
text(48, 952, 'CDP encodedDataLength is received bytes, not exact wire bytes. Native startup scenes differ. First Vela visit history differs; warm cycle follows a shared map history.', 11, colors.muted)
text(48, 974, 'B = accepted commit + three lab-only orbit-order normalizations; accepted B source includes A/C scaffolding. No performance budget applied.', 11, colors.muted)
text(48, 990, `summary.json · generated ${xml(data.generatedAt)}`, 10, colors.muted)
add('</svg>')

await fs.writeFile(path.join(artifacts, 'comparison.svg'), parts.join('\n'), 'utf8')
console.log('WROTE', path.join(artifacts, 'comparison.svg'))
