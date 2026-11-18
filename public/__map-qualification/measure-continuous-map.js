/* Load in the test page and start after the map has hydrated and settled. */
globalThis.measureContinuousMap = function measureContinuousMap(scene, scenario) {
  if (!(scene instanceof SVGSVGElement)) throw new TypeError('Pass the mounted map SVG.')
  const markSelectors = {
    objects: '.continuous-warden-object, .player-continuous-object',
    orbits: '.continuous-warden-orbit-target, .player-continuous-orbit-hit-target',
    routes: '.cluster-route[data-route-id], .player-cluster-route',
    labels: '.continuous-warden-name-target, .player-continuous-name-target, .continuous-warden-object-name, .player-continuous-object-label, .cluster-route-label, .cluster-route-destination-caption, .player-continuous-destination-caption',
  }
  const measureMarks = () => {
    const map = scene.getBoundingClientRect()
    return Object.fromEntries(Object.entries(markSelectors).map(([kind, selector]) => [kind,
      [...scene.querySelectorAll(selector)].filter(mark => {
        const bounds = mark.getBoundingClientRect()
        return bounds.right > Math.max(0, map.left) && bounds.bottom > Math.max(0, map.top)
          && bounds.left < Math.min(innerWidth, map.right) && bounds.top < Math.min(innerHeight, map.bottom)
          && getComputedStyle(mark).visibility !== 'hidden'
      }).length,
    ]))
  }

  const visibleBefore = measureMarks()
  const cameraLayer = scene.querySelector(':scope > g[transform]')
  const inputs = []
  const frames = []
  const contacts = new Map()
  const clockStart = performance.now()
  const listeners = new AbortController()
  const detailChangesMs = []
  let lastDetailChange = null
  let lastCameraChange = null
  let lastRouteChange = null
  let selection = null
  let selectionPaint = null
  let frameRequest

  function addInput(event) {
    inputs.push({ type: event.type, at: performance.now() - clockStart })
  }

  function sampleFrame(at) {
    frames.push(at - clockStart)
    frameRequest = requestAnimationFrame(sampleFrame)
  }

  function observePaint(records) {
    const at = performance.now() - clockStart
    for (const record of records) {
      const target = record.target
      if (!(target instanceof SVGElement)) continue
      if (record.attributeName === 'transform' && target === cameraLayer) {
        lastCameraChange = at
      }
      if (record.attributeName === 'd' && target.matches('.cluster-route-line, .player-cluster-route-path')) {
        lastRouteChange = at
      }
      if (record.type === 'childList' && [...record.addedNodes, ...record.removedNodes].some(node =>
        node instanceof SVGElement && node.matches('.continuous-warden-system-detail, .player-continuous-system-detail'))) {
        lastDetailChange = at
        if (detailChangesMs.at(-1) !== at) detailChangesMs.push(at)
      }
      if (selection?.mark === target && record.attributeName === 'aria-pressed' && target.getAttribute('aria-pressed') === 'true') {
        const pending = selection
        // The RAF timestamp can precede input in the same browser frame. Read the clock when this callback actually runs.
        requestAnimationFrame(() => { if (selection === pending) selectionPaint ??= performance.now() - clockStart })
      }
    }
  }

  const capture = { capture: true, signal: listeners.signal }
  const targetsMap = event => event.target instanceof Node && scene.contains(event.target)
  function buttonMark(target) {
    if (!(target instanceof Element)) return null
    const anonymousEnd = target.closest('[data-player-destination-route-id]')
    const routeId = anonymousEnd?.getAttribute('data-player-destination-route-id')
    return routeId
      ? scene.querySelector(`[role="button"][data-route-id="${CSS.escape(routeId)}"]`)
      : target.closest('[role="button"][aria-pressed]')
  }
  function beginSelection(event, mark) {
    if (!mark || mark.getAttribute('aria-pressed') === 'true' || selection?.mark === mark) return
    addInput(event)
    selection = { mark, at: performance.now() - clockStart }
    selectionPaint = null
  }
  window.addEventListener('wheel', event => {
    if (targetsMap(event)) addInput(event)
  }, { ...capture, passive: true })
  window.addEventListener('pointerdown', event => {
    if (!targetsMap(event)) return
    contacts.set(event.pointerId, {
      startX: event.clientX,
      startY: event.clientY,
      mark: buttonMark(event.target),
      pointerType: event.pointerType,
      moved: false,
    })
  }, capture)
  window.addEventListener('pointermove', event => {
    const contact = contacts.get(event.pointerId)
    if (!contact) return
    contact.moved ||= Math.hypot(event.clientX - contact.startX, event.clientY - contact.startY) > 8
    addInput(event)
  }, capture)
  for (const type of ['pointerup', 'pointercancel']) {
    window.addEventListener(type, event => {
      const contact = contacts.get(event.pointerId)
      if (scenario === 'Selection' && type === 'pointerup' && contact?.pointerType === 'touch' && !contact.moved) {
        beginSelection(event, contact.mark)
      }
      if (contacts.delete(event.pointerId) && inputs.length) addInput(event)
    }, capture)
  }
  window.addEventListener('click', (event) => {
    if (targetsMap(event)) beginSelection(event, buttonMark(event.target))
  }, capture)

  const paint = new MutationObserver(observePaint)
  paint.observe(scene, { subtree: true, childList: true, attributeFilter: ['aria-pressed', 'd', 'transform'] })
  frameRequest = requestAnimationFrame(sampleFrame)

  return function finish() {
    cancelAnimationFrame(frameRequest)
    listeners.abort()
    paint.disconnect()
    const firstInput = inputs[0]?.at
    const lastInput = inputs.at(-1)?.at
    const firstInputFrame = firstInput === undefined ? undefined : frames.findLast(at => at < firstInput)
    const finalInputFrame = lastInput === undefined ? undefined : frames.find(at => at >= lastInput)
    const activeStart = firstInputFrame ?? firstInput
    const activeEnd = finalInputFrame ?? lastInput
    const activeFrames = frames.filter(at => activeStart !== undefined && activeEnd !== undefined && at >= activeStart && at <= activeEnd)
    const frameIntervalsMs = activeFrames.slice(1).map((at, index) => at - activeFrames[index])
    const firstPaintAt = firstInput === undefined ? undefined : frames.find(at => at >= firstInput)
    const idleFrames = frames.filter(at => firstInput === undefined || at < firstInput)
    const idleIntervals = idleFrames.slice(1).map((at, index) => at - idleFrames[index]).sort((a, b) => a - b)
    const medianIdleInterval = idleIntervals.at(Math.floor(idleIntervals.length / 2))
    const lastChange = Math.max(lastCameraChange ?? 0, lastDetailChange ?? 0, lastRouteChange ?? 0)
    return {
      scenario, recordedAt: new Date().toISOString(), userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio },
      visibleBefore, visibleAfter: measureMarks(), inputs, frameIntervalsMs, detailChangesMs,
      estimatedRefreshHz: medianIdleInterval ? 1000 / medianIdleInterval : null,
      longestFrameMs: frameIntervalsMs.length ? Math.max(...frameIntervalsMs) : null,
      firstInputToFrameMs: firstInput === undefined || firstPaintAt === undefined ? null : firstPaintAt - firstInput,
      selectionToNextFrameMs: selectionPaint === null || selection === null ? null : selectionPaint - selection.at,
      settleMs: lastInput !== undefined && lastChange ? Math.max(0, lastChange - lastInput) : null,
    }
  }
}
