import fs from 'node:fs/promises'
import { chromium } from 'playwright'
const lab = '.scratch/interface-revamp/measurement-lab'
const fixture = JSON.parse(await fs.readFile(`${lab}/fixture.json`, 'utf8'))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
page.on('console', message => console.log('CONSOLE', message.type(), message.text()))
page.on('pageerror', error => console.log('PAGEERROR', error.message))
await page.goto('http://127.0.0.1:3121', { waitUntil: 'load' })
await page.evaluate(async workspace => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('workspace')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  await new Promise((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite')
    tx.objectStore('workspace').put(workspace, 'current')
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}, fixture)
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(2000)
const diagnostic = await page.evaluate(async () => {
  const value = await new Promise(resolve => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
    request.onsuccess = () => { const db = request.result; const tx = db.transaction('workspace'); const get = tx.objectStore('workspace').get('current'); get.onsuccess = () => { resolve(get.result); db.close() } }
  })
  return { body: document.body.innerText.slice(0, 2500), svg: [...document.querySelectorAll('svg')].map(svg => svg.getAttribute('class')), html: document.documentElement.innerHTML.slice(-1000), idbWorkspace: value ? { cluster: value.cluster.name, objectCount: value.cluster.systems.reduce((n, s) => n + s.objects.length, 0), fieldSettings: Object.keys(value.objectFieldSettings || {}) } : null }
})
console.log(JSON.stringify(diagnostic, null, 2))
await browser.close()
