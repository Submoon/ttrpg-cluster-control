import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const lab = path.dirname(fileURLToPath(import.meta.url))
const cases = [
  { id: 'baseline', url: 'http://127.0.0.1:3121/' },
  { id: 'B', url: 'http://127.0.0.1:3122/?variant=B' },
]
const output = {}
for (const item of cases) {
  const response = await fetch(item.url)
  const html = await response.text()
  const refs = [...new Set([...html.matchAll(/(?:src|href)="([^"]*\/_nuxt\/[^"?#]+)(?:\?[^\"]*)?"/g)].map(match => new URL(match[1], item.url).href))]
  const assets = []
  for (const asset of refs) {
    const result = await fetch(asset)
    assets.push({ url: asset, status: result.status, contentType: result.headers.get('content-type'), bytes: Number(result.headers.get('content-length')) || (await result.arrayBuffer()).byteLength })
  }
  output[item.id] = { pageStatus: response.status, htmlBytes: Buffer.byteLength(html), pageDate: response.headers.get('date'), scriptAndStyleRefs: refs, assets }
}
await fs.writeFile(path.join(lab, 'artifacts', 'asset-health.json'), JSON.stringify(output, null, 2))
console.log(JSON.stringify(output, null, 2))
