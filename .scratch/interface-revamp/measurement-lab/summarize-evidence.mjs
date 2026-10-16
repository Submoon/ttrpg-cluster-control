import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const lab = path.dirname(fileURLToPath(import.meta.url))
const artifacts = path.join(lab, 'artifacts')

function summarize(values) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return { n: 0, min: null, median: null, max: null }
  const midpoint = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2
  return { n: sorted.length, min: sorted[0], median, max: sorted.at(-1) }
}

async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) } catch { return null }
}

async function desktop() {
  const result = {}
  for (const arm of ['baseline', 'B']) {
    const rows = []
    for (let sample = 1; sample <= 5; sample++) {
      const row = await readJson(path.join(artifacts, `${arm}-desktop-run-${sample}.json`))
      if (row?.startup && !row.failure) rows.push(row)
    }
    const first = (field) => summarize(rows.map(row => field(row)).filter(Number.isFinite))
    const gestures = {}
    for (const kind of ['cluster', 'system']) {
      const items = rows.map(row => row.gestures?.find(item => item.kind === kind) ?? {}).filter(item => !item.skipped)
      gestures[kind] = {
        panTransformChanged: items.filter(item => item.transformChanged).length,
        wheelZoomChanged: items.filter(item => item.wheelZoomChanged).length,
        scriptedGestureDurationToTwoRafMs: summarize(items.map(item => item.scriptedGestureDurationToTwoRafMs)),
        wheelInputToTransformChangeMs: summarize(items.map(item => item.wheelInputToTransformChangeMs)),
        rafIntervalMedianMs: summarize(items.map(item => item.rafIntervalMedianMs)),
        rafIntervalsOver32ms: summarize(items.map(item => item.rafIntervalsOver32ms)),
        skipped: rows.map(row => row.gestures?.find(item => item.kind === kind)).filter(item => item?.skipped).map(item => item.skipped),
      }
    }
    const byKind = (getter, kind) => summarize(rows.map(row => getter(row)?.byKind?.[kind]))
    result[arm] = {
      n: rows.length,
      nativeInitialMapKind: [...new Set(rows.map(row => row.startup.initialMapKind))],
      nativeStartupToMapMutationMs: first(row => row.startup.elapsedToMapMountMutationMs),
      nativeStartupToMapMutationPlusTwoRafMs: first(row => row.startup.elapsedToMapMountPlusTwoRafMs),
      clusterToVelaClickToMapPlusTwoRafMs: first(row => row.clusterToSystem.clickToMapVisiblePlusTwoRafMs),
      velaToClusterClickToMapPlusTwoRafMs: first(row => row.systemToCluster.clickToMapVisiblePlusTwoRafMs),
      warmClusterToVelaClickToMapPlusTwoRafMs: first(row => row.warmClusterToVela.clickToMapVisiblePlusTwoRafMs),
      warmVelaToClusterClickToMapPlusTwoRafMs: first(row => row.warmVelaToCluster.clickToMapVisiblePlusTwoRafMs),
      fieldsNativeDialogClickToTwoRafMs: first(row => row.overlay.clickToOverlayTwoRafMs),
      initialResourcesCompletedByNativeMapMutation: {
        documentBytes: byKind(row => row.initialResourcesByMapMutation, 'document'),
        jsBytes: byKind(row => row.initialResourcesByMapMutation, 'js'),
        cssBytes: byKind(row => row.initialResourcesByMapMutation, 'css'),
        imageBytes: byKind(row => row.initialResourcesByMapMutation, 'image'),
      },
      requestsStartedByNativeMapMutation: first(row => row.initialRequestsStartedByMapMutation),
      resourcesReceivedAfterNativeMapMutation: {
        jsBytes: byKind(row => row.resourcesReceivedAfterNativeMapMutation, 'js'),
        cssBytes: byKind(row => row.resourcesReceivedAfterNativeMapMutation, 'css'),
        imageBytes: byKind(row => row.resourcesReceivedAfterNativeMapMutation, 'image'),
        otherBytes: byKind(row => row.resourcesReceivedAfterNativeMapMutation, 'other'),
      },
      requestsStartedAfterNativeMapMutation: first(row => row.requestsStartedAfterNativeMapMutation),
      requestsPendingAtPreReloadCutoff: summarize(rows.map(row => row.pendingRequestsAtPreReloadCutoff?.length)),
      resourcesAfterOverlayAndCatalogue: {
        receivedBytes: first(row => row.resourcesAfterOverlay.receivedBytes),
        requestCount: first(row => row.resourcesAfterOverlay.requestCount),
        jsBytes: byKind(row => row.resourcesAfterOverlay, 'js'),
        cssBytes: byKind(row => row.resourcesAfterOverlay, 'css'),
      },
      hydratedErrorsPerRun: rows.map(row => row.consoleAndRequestErrors?.length ?? null),
      actualMapCounts: {
        clusterNodes: [...new Set(rows.map(row => row.startup.clusterNodeCount))],
        clusterRoutes: [...new Set(rows.map(row => row.startup.clusterRouteCount))],
        systemObjects: [...new Set(rows.map(row => row.systemMapMount.systemObjectCount))],
        systemOrbits: [...new Set(rows.map(row => row.systemMapMount.systemOrbitCount))],
      },
      gestures,
    }
  }
  return result
}

async function mobilePartials() {
  const result = {}
  for (const arm of ['baseline', 'B']) {
    const records = []
    for (const attempt of ['initial-mobile-attempt', 'focused-mobile-attempt']) {
      for (let sample = 1; sample <= 2; sample++) {
        const file = path.join(artifacts, attempt, `${arm}-mobile-emulation-run-${sample}.partial.json`)
        const row = await readJson(file)
        if (row) records.push({ attempt, sample, row })
      }
    }
    const native = records.map(item => item.row.stages?.nativeStartup?.startup).filter(Boolean)
    const cluster = records.map(item => item.row.stages?.clusterToVela?.clusterToSystem?.clickToMapVisiblePlusTwoRafMs).filter(Number.isFinite)
    result[arm] = {
      nPartialFreshContexts: records.length,
      attemptGroups: ['initial-mobile-attempt', 'focused-mobile-attempt'].map(attempt => ({
        attempt,
        records: records.filter(item => item.attempt === attempt).length,
      })),
      nativeInitialMapKind: [...new Set(native.map(item => item.initialMapKind))],
      nativeStartupToMapMutationMs: summarize(native.map(item => item.elapsedToMapMountMutationMs)),
      clusterToVelaClickToMapPlusTwoRafMs: summarize(cluster),
      otherMobileComparisons: {
        clusterGestures: { n: 0, reason: 'Not reached or the target point was occluded; see preserved partial/failure records.' },
        systemGestures: { n: 0, reason: 'The mobile system-object and overlay flow did not complete.' },
        fieldsOverlay: { n: 0, reason: 'The required map/inspector interaction path did not complete.' },
      },
      failurePaths: records.map(({ attempt, sample, row }) => ({ attempt, sample, checkpoint: `${attempt}/${arm}-mobile-emulation-run-${sample}.partial.json`, stagesCaptured: Object.keys(row.stages ?? {}) })),
    }
  }
  return result
}

const summary = {
  generatedAt: new Date().toISOString(),
  source: {
    baselineCommit: '629d2a98715c3a16b954e0f77c639b1f0c31212c',
    acceptedBCommit: '7ea41e0a9b0e585e23812eb9165e95420d72dc89',
    measuredB: 'accepted B plus the exact three-order normalization patch in this lab',
    normalizationPatch: 'artifacts/b-fixture-normalization.patch',
    originalAcceptedBOutput: 'source-b-original-output/',
  },
  fixture: { systems: 3, routes: 4, objects: 13, orbits: 6, note: 'Modest populated fixture; counts derived from seedWorkspace.' },
  measurementDefinitions: {
    mapMount: 'First effective visible SVG map DOM mutation plus two requestAnimationFrame callbacks; a paint proxy, not a compositor-paint timestamp.',
    networkBytes: 'CDP loadingFinished encodedDataLength, labelled CDP received bytes; not upload volume or exact wire bytes.',
    startup: 'Native initial map scenes differ: baseline begins on Vela system; B begins on cluster with Gannet selection / desktop inspector. Kept separate.',
    warmTransition: 'A second cluster→Vela→cluster cycle after both arms have reached Vela and returned to cluster once.',
    mobile: 'CPU throttle 4 and 150 ms / 1.6 Mbps down / 750 kbps up are host emulation, not physical phone results. Mobile run data is partial after real UI occlusions/out-of-viewport objects.',
    ssrMarkupAudit: 'The saved pre-hydration HTML files contain 0 actual SVG elements and 0 map SVG elements in both arms. Raw containsClusterSvg/containsSystemSvg fields are broad substring checks matching CSS class names; startup SVG timings are measured from the hydrated client DOM.',
  },
  conditions: {
    desktop: { viewport: '1440x900', deviceScaleFactor: 1, cpuThrottle: 1, latencyMs: 20, downMbps: 10, upMbps: 5, reducedMotion: 'reduce', samplesRequested: 5 },
    mobileEmulation: { viewport: '390x844', deviceScaleFactor: 1, touch: true, cpuThrottle: 4, latencyMs: 150, downMbps: 1.6, upMbps: 0.75, reducedMotion: 'reduce', samplesRequested: 5 },
  },
  desktop: await desktop(),
  mobilePartial: await mobilePartials(),
  themeProbePath: 'artifacts/theme-probe.json',
  rawData: 'artifacts/{baseline,B}-{desktop,mobile-emulation}-run-*.json plus initial-mobile-attempt/ and focused-mobile-attempt/ partials/failures',
}

await fs.writeFile(path.join(artifacts, 'summary.json'), JSON.stringify(summary, null, 2))
console.log('WROTE', path.join(artifacts, 'summary.json'))
