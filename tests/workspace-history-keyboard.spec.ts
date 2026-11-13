import { expect, test } from './fixtures'
import { waitForWorkspaceSaved, createSingleSystemWorkspace, openChartDetailsEditor } from './helpers'
import {
  installHistoryStorageGate, pendingHistoryAcknowledgements, releaseHistoryAcknowledgements, setHistoryStorageGate,
} from './scenarios/history-storage-gate'


test('supported Ctrl and Cmd shortcuts traverse the same saved name action and controls announce their shortcuts', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(undo).toHaveAttribute('aria-keyshortcuts', 'Control+Z Meta+Z')
  await expect(redo).toHaveAttribute('aria-keyshortcuts', 'Control+Shift+Z Control+Y Meta+Shift+Z')
  await expect(undo).toHaveAttribute('title', /Ctrl\+Z or Cmd\+Z/)
  await expect(redo).toHaveAttribute('title', /Ctrl\+Shift\+Z, Ctrl\+Y or Cmd\+Shift\+Z/)

  await applySavedChartRename(page, 'Star system', 'Vesper Prime')
  await expect(undo).toHaveAccessibleName(/Undo: Rename Jump Cluster and star system · Kestrel Reach/)
  await expect(undo).toHaveAttribute('title', /Ctrl\+Z or Cmd\+Z/)

  await page.keyboard.press('Control+z')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper')
  await expect(redo).toBeEnabled()

  await page.keyboard.press('Control+Shift+z')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper Prime')
  await expect(undo).toBeEnabled()

  await page.keyboard.press('Control+z')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper')
  await expect(redo).toBeEnabled()

  await page.keyboard.press('Control+y')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper Prime')
  await expect(undo).toBeEnabled()

  await page.keyboard.press('Control+Alt+z')
  await page.keyboard.press('Meta+y')
  await page.keyboard.press('Control+Shift+y')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper Prime')
  await expect(undo).toBeEnabled()

  await page.keyboard.press('Meta+z')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper')
  await expect(redo).toBeEnabled()

  await page.keyboard.press('Meta+Shift+z')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper Prime')
  await expect(undo).toBeEnabled()

})

test('held shortcuts traverse once until keyup, and a traversal blocked by saving is discarded', async ({ page }) => {
  test.setTimeout(60_000)
  await createSingleSystemWorkspace(page)
  await applySavedChartRename(page, 'Star system', 'Vesper Prime')
  await applySavedChartRename(page, 'Jump Cluster', 'Kestrel Prime')

  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await page.evaluate(() => {
    type RepeatWindow = Window & { __historyShortcutRepeatSeen?: boolean }
    const tracked = window as RepeatWindow
    tracked.__historyShortcutRepeatSeen = false
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyZ' && event.ctrlKey && event.repeat) tracked.__historyShortcutRepeatSeen = true
    })
  })

  await page.keyboard.down('Control')
  await page.keyboard.down('z')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper Prime')
  await expect(undo).toBeEnabled()
  await expect(redo).toBeEnabled()
  await page.keyboard.down('z')
  try {
    await expect.poll(() => page.evaluate(() =>
      (window as Window & { __historyShortcutRepeatSeen?: boolean }).__historyShortcutRepeatSeen,
    )).toBe(true)
    await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper Prime')
  } finally {
    await page.keyboard.up('z')
    await page.keyboard.up('Control')
  }

  await page.keyboard.press('Control+z')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper')
  await expect(redo).toBeEnabled()

  await applySavedChartRename(page, 'Star system', 'Vesper Prime')
  await applySavedChartRename(page, 'Jump Cluster', 'Kestrel Prime')
  await installHistoryStorageGate(page)
  try {
    await setHistoryStorageGate(page, { hold: true })
    await page.keyboard.press('Control+z')
    await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper Prime')
    await expect.poll(() => pendingHistoryAcknowledgements(page)).toBeGreaterThan(0)
    await expect(undo).toBeDisabled()
    await expect(redo).toBeDisabled()

    await page.keyboard.press('Control+z')
    await releaseHistoryAcknowledgements(page)
    await expect(undo).toBeEnabled()
    await expect(redo).toBeEnabled()
    await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper Prime')

    await page.keyboard.press('Control+z')
    await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper')
    await expect(redo).toBeEnabled()
  } finally {
    await releaseHistoryAcknowledgements(page, true)
  }
})

test('native text controls and editable descendants keep Ctrl+Z and Ctrl+Y even with empty input history', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  await applySavedChartRename(page, 'Star system', 'Vesper Prime')
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  await expect(undo).toBeEnabled()

  await page.evaluate(() => {
    const fixture = document.createElement('section')
    fixture.id = 'history-native-control-fixture'
    fixture.style.cssText = 'position:fixed;left:8px;top:8px;z-index:999999;display:grid;gap:4px;padding:8px;background:white;color:black'
    fixture.innerHTML = `
      <input type="text" aria-label="Native text undo input">
      <textarea aria-label="Native textarea undo"></textarea>
      <select aria-label="Native select ownership"><option>First</option><option>Second</option></select>
      <div contenteditable="true" aria-label="Native content editor"><span id="history-editable-child">Initial content</span></div>
      <div contenteditable="true"><span contenteditable="false" id="history-readonly-editable-child">Read only island</span></div>
      <input type="checkbox" aria-label="Native checkbox ownership">
      <input type="range" aria-label="Native range ownership">
      <div id="history-shadow-host"></div>
    `
    const shadow = fixture.querySelector('#history-shadow-host')?.attachShadow({ mode: 'open' })
    const shadowInput = document.createElement('input')
    shadowInput.type = 'text'
    shadowInput.setAttribute('aria-label', 'Shadow text undo input')
    shadow?.append(shadowInput)
    document.body.append(fixture)
  })

  await page.evaluate(() => {
    type ShortcutObserverWindow = Window & { __historyShortcutDefaults?: boolean[] }
    const tracked = window as ShortcutObserverWindow
    tracked.__historyShortcutDefaults = []
    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'z' && event.ctrlKey) {
        tracked.__historyShortcutDefaults?.push(event.defaultPrevented)
      }
    })
  })

  const textInput = page.getByLabel('Native text undo input')
  await textInput.focus()
  await page.keyboard.press('Control+z')
  await expect(textInput).toHaveValue('')
  await expectSystemMapActive(page, 'Vesper Prime')
  await expect(undo).toBeEnabled()
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __historyShortcutDefaults?: boolean[] }).__historyShortcutDefaults?.at(-1),
  )).toBe(false)

  await textInput.pressSequentially('Native text')
  await textInput.press('Control+z')
  await expect(textInput).toHaveValue('')
  await expectSystemMapActive(page, 'Vesper Prime')
  await textInput.press('Control+y')
  await expect(textInput).toHaveValue('Native text')

  const textarea = page.getByLabel('Native textarea undo')
  await textarea.focus()
  await page.keyboard.press('Control+z')
  await expect(textarea).toHaveValue('')
  await expectSystemMapActive(page, 'Vesper Prime')
  await textarea.pressSequentially('Native note')
  await textarea.press('Control+z')
  await expect(textarea).toHaveValue('')
  await expectSystemMapActive(page, 'Vesper Prime')

  const nativeSelect = page.getByLabel('Native select ownership')
  await nativeSelect.focus()
  await page.keyboard.press('Control+z')
  await expect(nativeSelect).toHaveValue('First')
  await expectSystemMapActive(page, 'Vesper Prime')

  for (const name of ['Native checkbox ownership', 'Native range ownership']) {
    await page.getByLabel(name).focus()
    await page.keyboard.press('Control+z')
    await expectSystemMapActive(page, 'Vesper Prime')
    await expect(undo).toBeEnabled()
  }

  const editableChild = page.locator('#history-editable-child')
  await editableChild.click()
  await page.keyboard.press('Control+z')
  await expect(editableChild).toHaveText('Initial content')
  await page.keyboard.press('End')
  await page.keyboard.type(' updated')
  await expect(editableChild).toHaveText('Initial content updated')
  await page.keyboard.press('Control+z')
  await expect(editableChild).toHaveText('Initial content')
  await expectSystemMapActive(page, 'Vesper Prime')

  await page.locator('#history-readonly-editable-child').click()
  await page.keyboard.press('Control+z')
  await expectSystemMapActive(page, 'Vesper Prime')
  await expect(undo).toBeEnabled()

  await page.evaluate(() => {
    const shadowInput = document.querySelector('#history-shadow-host')?.shadowRoot?.querySelector('input')
    shadowInput?.focus()
  })
  await page.keyboard.press('Control+z')
  await expectSystemMapActive(page, 'Vesper Prime')
  await page.keyboard.type('Shadow text')
  await page.keyboard.press('Control+z')
  await expectSystemMapActive(page, 'Vesper Prime')
  await page.keyboard.press('Control+y')
  expect(await page.locator('#history-shadow-host').evaluate(element =>
    element.shadowRoot?.querySelector('input')?.value,
  )).toBe('Shadow text')

  await page.evaluate(() => document.getElementById('history-native-control-fixture')?.remove())
})





async function applySavedChartRename(
  page: import('@playwright/test').Page,
  field: 'Jump Cluster' | 'Star system',
  value: string,
): Promise<void> {
  const names = await openChartDetailsEditor(page)
  await names.getByLabel(field, { exact: true }).fill(value)
  await names.getByRole('button', { name: 'Apply details', exact: true }).click()
  await expect(names).toBeHidden()
  await waitForWorkspaceSaved(page)
}

async function expectClusterSystemName(
  page: import('@playwright/test').Page,
  clusterName: string,
  systemName: string,
): Promise<void> {
  const clusterMap = page.getByRole('group', { name: `${clusterName} Jump Cluster map`, exact: true })
  await expect(clusterMap.getByRole('button', {
    name: new RegExp(`^(Open|Select) ${escapeRegExp(systemName)} system(?: map)?$`),
  })).toBeVisible()
}

async function expectSystemMapActive(page: import('@playwright/test').Page, systemName: string): Promise<void> {
  await expect(page.getByRole('group', { name: `${systemName} star system map`, exact: true })).toBeVisible()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
