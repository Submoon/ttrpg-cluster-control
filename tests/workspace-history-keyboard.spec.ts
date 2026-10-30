import { expect, test } from './fixtures'
import {
  activeWorkspaceFeedback, addCustomFieldThroughDialog, captureMapExportBlobs, clickNormalizedClusterPoint,
  clickDockAction, clickNormalizedSystemPoint, createSingleSystemWorkspace, downloadJson, editMapObject,
  openChartDetails, openWorkspaceHierarchy, openWorkspaceZoomNavigation, returnToClusterMap,
  selectCatalogueObjectButton, selectInspectorOption,
} from './helpers'
import {
  installHistoryStorageGate, pendingHistoryAcknowledgements, releaseHistoryAcknowledgements, setHistoryStorageGate,
} from './scenarios/history-storage-gate'

test('Ctrl+Z undoes a saved chart-name change from the workspace', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart names' }).click()

  const names = page.getByRole('dialog', { name: 'Edit chart names' })
  await names.getByLabel('Star system', { exact: true }).fill('Vesper Prime')
  await names.getByRole('button', { name: 'Apply names', exact: true }).click()
  await expect(names).toBeHidden()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await page.keyboard.press('Control+z')

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  await expect(clusterMap.getByRole('button', { name: /^(Open|Select) Vesper system(?: map)?$/ })).toBeVisible()
  await expect(clusterMap.getByRole('button', { name: /^(Open|Select) Vesper Prime system(?: map)?$/ })).toHaveCount(0)
})

test('saved object creation supports Undo and Redo while Object Add stays armed', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const objects = map.locator('.system-object')
  await expect(objects).toHaveCount(1)

  await (await selectCatalogueObjectButton(page, 'planet')).click()
  const controls = page.getByRole('group', { name: 'Planet creation controls', exact: true })
  await clickNormalizedSystemPoint(page, map, { x: 0.8, y: 0.8 })
  await expect(objects).toHaveCount(2)
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(undo).toBeEnabled()
  await page.locator('#workspace-main').focus()
  await page.keyboard.press('Control+z')
  await expect(objects).toHaveCount(1)
  await expect(redo).toBeEnabled()

  await page.keyboard.press('Control+y')
  await expect(objects).toHaveCount(2)
  await expect(undo).toBeEnabled()

  await expect(controls).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toBeVisible()
  await clickNormalizedSystemPoint(page, map, { x: 0.9, y: 0.8 })
  await expect(objects).toHaveCount(3)
  await expect(redo).toBeDisabled()
})

test('a modified Other Add label continues to block history traversal', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  await applySavedChartRename(page, 'Star system', 'Vesper Prime')
  await (await selectCatalogueObjectButton(page, 'other')).click()
  const creation = page.getByRole('group', { name: 'Other creation controls', exact: true })
  await creation.getByRole('button', { name: 'Placement', exact: true }).click()
  await page.getByLabel('Type label', { exact: true }).fill('Pending Relay Beacon')
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  await expect(undo).toBeDisabled()
  await page.locator('#workspace-main').focus()
  await page.keyboard.press('Control+z')
  await expect(page.getByRole('group', { name: 'Vesper Prime star system map', exact: true })).toBeVisible()
  await expect(undo).toBeDisabled()
  await expect(creation).toBeVisible()
})

test('a fresh Jump Route draft blocks Undo until discarded without replaying it afterward', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page)
  await applySavedChartRename(page, 'Star system', 'Vesper Prime')
  await returnToClusterMap(page)
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  await expect(undo).toBeEnabled()

  await clickDockAction(page, 'Add Jump Route')
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector', exact: true })
  const routeDraft = inspector.getByRole('heading', { name: 'Connect Jump Points', exact: true })
  await expect(routeDraft).toBeVisible()
  await expect(undo).toBeDisabled()
  await expect(undo).toHaveAttribute('title', /^Finish or cancel the current Cluster route action first\./)

  await page.locator('#workspace-main').focus()
  await page.keyboard.press('Control+z')
  await expect(routeDraft).toBeVisible()
  await expect(undo).toBeDisabled()
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper Prime')
  const afterBlockedShortcut = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterBlockedShortcut).toEqual(before)

  await inspector.getByRole('button', { name: 'Discard route draft', exact: true }).click()
  await expect(routeDraft).toHaveCount(0)
  await expect(undo).toBeEnabled()
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(before)
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper Prime')
})

test('saved Orbit creation supports Undo and Redo while Orbit Add stays armed', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const orbit = map.getByRole('group', { name: 'Orbit 1 around Primary Star', exact: true })

  await page.locator('.workspace-dock-add').click()
  await page.getByRole('button', { name: 'Add orbit', exact: true }).click()
  const controls = page.getByRole('group', { name: 'Orbit creation controls', exact: true })
  await controls.getByRole('button', { name: 'Placement', exact: true }).click()
  await selectInspectorOption(page.getByLabel('Orbit center or host', { exact: true }), 'Around Primary Star')
  await page.getByLabel('Horizontal radius', { exact: true }).fill('60')
  await page.getByLabel('Vertical radius', { exact: true }).fill('60')
  await page.getByRole('form', { name: 'Placement', exact: true })
    .getByRole('button', { name: 'Add', exact: true }).click()

  await expect(orbit).toBeVisible()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(undo).toBeEnabled()
  await page.locator('#workspace-main').focus()
  await page.keyboard.press('Control+z')
  await expect(orbit).toHaveCount(0)
  await expect(redo).toBeEnabled()
  await page.keyboard.press('Control+y')
  await expect(orbit).toBeVisible()
  await expect(undo).toBeEnabled()
  await expect(controls).toBeVisible()
})

test('saved Cluster system placement supports Undo and Redo while system Add stays armed', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  await returnToClusterMap(page)
  const map = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  const systems = map.locator('.cluster-system-node')
  await expect(systems).toHaveCount(1)

  await page.getByRole('button', { name: 'Add to map', exact: true }).click()
  await page.getByRole('button', { name: 'Add star system', exact: true }).click()
  await clickNormalizedClusterPoint(page, map, { x: 0.75, y: 0.75 })
  await expect(systems).toHaveCount(2)
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(undo).toBeEnabled()
  await page.locator('#workspace-main').focus()
  await page.keyboard.press('Control+z')
  await expect(systems).toHaveCount(1)
  await expect(redo).toBeEnabled()
  await page.keyboard.press('Control+y')
  await expect(systems).toHaveCount(2)
  await expect(undo).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toBeVisible()
})

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

  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') === 'true') await inspectToggle.click()
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await expect(undo).toBeVisible()
    const box = await page.getByRole('group', { name: 'Edit history' }).boundingBox()
    expect(box).not.toBeNull()
    if (!box) throw new Error('The history commands are outside the active map layout.')
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  }
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

test('open History, Map files and map zoom popovers own the shortcut until dismissed', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  await applySavedChartRename(page, 'Star system', 'Vesper Prime')
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await page.evaluate(() => {
    type ShortcutWindow = Window & { __historyChordPrevented?: boolean[] }
    const tracked = window as ShortcutWindow
    tracked.__historyChordPrevented = []
    window.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'z') tracked.__historyChordPrevented?.push(event.defaultPrevented)
    })
  })

  await page.getByRole('button', { name: 'History', exact: true }).click()
  const historyDialog = page.getByRole('dialog', { name: 'History', exact: true })
  await expect(historyDialog).toBeVisible()
  await page.keyboard.press('Control+z')
  await expect(historyDialog).toContainText('Applied')
  expect(await latestShortcutPrevented(page)).toBe(false)
  await page.keyboard.press('Escape')
  await expect(historyDialog).toBeHidden()

  await page.keyboard.press('Control+z')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper')
  await expect(redo).toBeEnabled()
  expect(await latestShortcutPrevented(page)).toBe(true)
  await page.keyboard.press('Control+Shift+z')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper Prime')
  await expect(undo).toBeEnabled()

  await page.getByRole('button', { name: 'Map files', exact: true }).click()
  await expect(page.getByRole('group', { name: /Map file actions for/ })).toBeVisible()
  await page.keyboard.press('Control+z')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper Prime')
  expect(await latestShortcutPrevented(page)).toBe(false)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('group', { name: /Map file actions for/ })).toBeHidden()

  const zoomPanel = await openWorkspaceZoomNavigation(page)
  await zoomPanel.getByRole('slider', { name: 'Map zoom level' }).focus()
  await page.keyboard.press('Control+z')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper Prime')
  await expect(undo).toBeEnabled()
  expect(await latestShortcutPrevented(page)).toBe(false)
  await page.keyboard.press('Escape')
  await expect(zoomPanel).toBeHidden()

  await page.keyboard.press('Control+z')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper')
  await expect(redo).toBeEnabled()
  expect(await latestShortcutPrevented(page)).toBe(true)
})

test('a nested Inspector USelect listbox owns Ctrl+Z while open', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  await addCustomFieldThroughDialog(page, 'Signal designation', 'single-select', 'Amber\nBlue')
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  await expect(undo).toBeEnabled()

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()
  await editMapObject(page)
  const designation = page.getByLabel('Signal designation', { exact: true })
  await designation.click()
  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible()

  await page.keyboard.press('Control+z')
  await expect(listbox).toBeVisible()
  await expect(designation).toBeVisible()
  await expect(page.getByRole('button', { name: /^Undo(?:\b|:)/, includeHidden: true })).toHaveText('Undo 1')

  await page.keyboard.press('Escape')
  await expect(listbox).toBeHidden()
  await page.keyboard.press('Control+z')
  await expect(page.getByLabel('Signal designation', { exact: true })).toHaveCount(0)
  await expect(undo).toBeDisabled()
})

test('IME and child-handled events are ignored, and a stopped keyup cannot block the next press', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  await applySavedChartRename(page, 'Star system', 'Vesper Prime')
  await applySavedChartRename(page, 'Jump Cluster', 'Kestrel Prime')
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })

  await page.evaluate(() => {
    type KeyboardProbeWindow = Window & {
      __ignoredShortcutDefaults?: boolean[]
    }
    const tracked = window as KeyboardProbeWindow
    tracked.__ignoredShortcutDefaults = []
    window.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'z') tracked.__ignoredShortcutDefaults?.push(event.defaultPrevented)
    })

    const imeTarget = document.createElement('button')
    imeTarget.id = 'history-ime-key-target'
    imeTarget.textContent = 'IME key target'
    const handledTarget = document.createElement('button')
    handledTarget.id = 'history-handled-key-target'
    handledTarget.textContent = 'Handled key target'
    handledTarget.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'z') event.preventDefault()
    })
    const stoppedKeyupTarget = document.createElement('button')
    stoppedKeyupTarget.id = 'history-stopped-keyup-target'
    stoppedKeyupTarget.textContent = 'Stopped keyup target'
    stoppedKeyupTarget.addEventListener('keyup', (event) => {
      if (event.code === 'KeyZ') event.stopPropagation()
    })
    document.body.append(imeTarget, handledTarget, stoppedKeyupTarget)
  })

  await page.evaluate(() => {
    const target = document.getElementById('history-ime-key-target')
    if (!(target instanceof HTMLElement)) throw new Error('The IME shortcut target is missing.')
    target.focus()
    target.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, composed: true }))
    const composing = new KeyboardEvent('keydown', {
      key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true,
    })
    Object.defineProperty(composing, 'isComposing', { value: true })
    target.dispatchEvent(composing)
    target.dispatchEvent(new KeyboardEvent('keyup', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true }))
    target.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, composed: true }))

    const legacyComposition = new KeyboardEvent('keydown', {
      key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true,
    })
    Object.defineProperty(legacyComposition, 'keyCode', { value: 229 })
    target.dispatchEvent(legacyComposition)
    target.dispatchEvent(new KeyboardEvent('keyup', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true }))
  })
  await expectSystemMapActive(page, 'Vesper Prime')
  expect(await page.evaluate(() =>
    (window as Window & { __ignoredShortcutDefaults?: boolean[] }).__ignoredShortcutDefaults,
  )).toEqual([false, false])

  const handledTarget = page.locator('#history-handled-key-target')
  await handledTarget.focus()
  await page.keyboard.press('Control+z')
  await expectSystemMapActive(page, 'Vesper Prime')
  await expect(undo).toBeEnabled()
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __ignoredShortcutDefaults?: boolean[] }).__ignoredShortcutDefaults?.at(-1),
  )).toBe(true)

  await page.locator('#history-stopped-keyup-target').focus()
  await page.keyboard.press('Control+z')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper Prime')
  await expect(redo).toBeEnabled()
  await page.keyboard.press('Control+z')
  await expectClusterSystemName(page, 'Kestrel Reach', 'Vesper')
  await expect(redo).toBeEnabled()
})

test('the welcome screen does not claim a workspace history shortcut', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible()
  await page.locator('#workspace-main').focus()
  await page.evaluate(() => {
    type ShortcutWindow = Window & { __welcomeShortcutDefaultPrevented?: boolean | null }
    const tracked = window as ShortcutWindow
    tracked.__welcomeShortcutDefaultPrevented = null
    window.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        tracked.__welcomeShortcutDefaultPrevented = event.defaultPrevented
      }
    })
  })

  await page.keyboard.press('Control+z')

  expect(await page.evaluate(() =>
    (window as Window & { __welcomeShortcutDefaultPrevented?: boolean | null }).__welcomeShortcutDefaultPrevented,
  )).toBe(false)
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible()
})

test('undoing a shared Fields action from the keyboard preserves usable map focus', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  await addCustomFieldThroughDialog(page, 'Signal designation', 'single-select', 'Amber\nBlue')
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  await expect(undo).toBeEnabled()
  await undo.focus()

  await page.keyboard.press('Control+z')

  await expect(undo).toBeDisabled()
  await expect.poll(() => page.evaluate(() => {
    const active = document.activeElement
    return active instanceof Element ? active.getAttribute('aria-label') : null
  })).toBe('Vesper star system map')
})

async function applySavedChartRename(
  page: import('@playwright/test').Page,
  field: 'Jump Cluster' | 'Star system',
  value: string,
): Promise<void> {
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart names' }).click()
  const names = page.getByRole('dialog', { name: 'Edit chart names' })
  await names.getByLabel(field, { exact: true }).fill(value)
  await names.getByRole('button', { name: 'Apply names', exact: true }).click()
  await expect(names).toBeHidden()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
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

async function latestShortcutPrevented(page: import('@playwright/test').Page): Promise<boolean | undefined> {
  return page.evaluate(() => (window as Window & { __historyChordPrevented?: boolean[] }).__historyChordPrevented?.at(-1))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
