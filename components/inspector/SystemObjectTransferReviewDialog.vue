<template>
  <UModal
    v-model:open="dialogOpen"
    title="Change system"
    description="Choose the destination, placement, keys, and relationship changes for this hosted branch."
    :dismissible="!props.session?.confirming && !props.session?.placingOnMap"
    :content="{ onOpenAutoFocus: focusFirstControl, onCloseAutoFocus: restoreFocus }"
    :ui="{
      content: 'system-transfer-review-content max-h-[calc(100dvh-2rem)] overflow-hidden max-[760px]:h-[calc(100dvh-1rem)] max-[760px]:max-h-none max-[760px]:w-[calc(100vw-1rem)]',
      body: 'min-h-0 overflow-y-auto',
      footer: 'shrink-0 border-t border-[var(--line-soft)]',
    }"
  >
    <template #body>
      <div v-if="props.session" class="grid gap-4">
        <section class="grid gap-3" aria-label="Transfer placement">
          <div>
            <span class="section-kicker">MOVE HOSTED BRANCH</span>
            <h2 class="mb-1 mt-2 break-words text-xl">Choose a destination and review the effects</h2>
            <p class="inspector-intro m-0">
              The root leaves its current Orbit. Its hosted Orbits and recursive occupants keep their geometry and identities.
            </p>
          </div>

          <label class="grid gap-1 text-sm font-medium">
            Destination star system
            <select
              class="workspace-control min-h-10 w-full rounded-md px-3"
              data-transfer-destination
              :value="props.session.destinationSystemId ?? ''"
              :disabled="props.session.confirming || props.session.placingOnMap"
              @change="selectDestination"
            >
              <option value="">Choose a destination</option>
              <option v-for="system in props.session.destinationSystems" :key="system.id" :value="system.id">
                {{ system.name }}
              </option>
            </select>
          </label>

          <fieldset class="grid gap-3 rounded-md border border-[var(--line-soft)] p-3" :disabled="!props.session.destinationSystemId || props.session.confirming || props.session.placingOnMap">
            <legend class="px-1 text-sm font-semibold">Root placement</legend>
            <label class="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="transfer-placement"
                :checked="props.session.placement?.kind === 'system'"
                @change="chooseFreeDefault"
              >
              <span>Free position</span>
            </label>
            <div v-if="props.session.placement?.kind === 'system'" class="grid grid-cols-2 gap-3">
              <label class="grid gap-1 text-sm">
                Local X
                <input class="workspace-control min-h-10 rounded-md px-3" type="number" step="any" :value="props.session.placement.x" @input="updateFreeX">
              </label>
              <label class="grid gap-1 text-sm">
                Local Y
                <input class="workspace-control min-h-10 rounded-md px-3" type="number" step="any" :value="props.session.placement.y" @input="updateFreeY">
              </label>
              <p class="inspector-intro col-span-2 m-0">Coordinates are normalized to the destination system map. Positions beyond the visible envelope are allowed.</p>
            </div>

            <label class="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="transfer-placement"
                :checked="props.session.placement?.kind === 'orbit'"
                :disabled="eligibleDestinationOrbits.length === 0"
                @change="chooseOrbitDefault"
              >
              <span>Destination Orbit</span>
            </label>
            <div v-if="props.session.placement?.kind === 'orbit'" class="grid gap-3">
              <label class="grid gap-1 text-sm">
                Eligible Orbit
                <select class="workspace-control min-h-10 rounded-md px-3" :value="props.session.placement.orbitId" @change="selectOrbit">
                  <option v-for="orbit in eligibleDestinationOrbits" :key="orbit.id" :value="orbit.id">
                    Orbit {{ orbit.order }} · {{ orbitHostName(orbit) }}
                  </option>
                </select>
              </label>
              <label class="grid gap-1 text-sm">
                Ellipse angle (radians)
                <input class="workspace-control min-h-10 rounded-md px-3" type="number" step="any" :value="props.session.placement.angle" @input="updateOrbitAngle">
              </label>
            </div>

            <UButton
              class="justify-self-start"
              color="neutral"
              variant="outline"
              :disabled="!props.session.destinationSystemId || props.session.confirming || props.session.placingOnMap"
              @click="emit('intent', { kind: 'place-on-map', sessionId: props.session.sessionId })"
            >
              {{ props.session.placement ? 'Change position on map' : 'Place on map' }}
            </UButton>
          </fieldset>
        </section>

        <section v-if="props.session.review" class="grid gap-3" aria-label="Transfer consequences">
          <div>
            <h3 class="m-0 text-sm font-semibold">Branch and Location keys</h3>
            <p class="inspector-intro m-0">
              {{ props.session.movedObjectIds.length }} objects and {{ props.session.movedOrbitIds.length }} hosted Orbits will move together.
            </p>
          </div>
          <ul class="m-0 grid gap-2 pl-5">
            <li v-for="objectId in props.session.movedObjectIds" :key="objectId" class="grid gap-1 break-words">
              <template v-if="objectById.get(objectId)">
                <span>
                  {{ objectById.get(objectId)?.name }}
                  <span v-if="!conflictById.has(objectId)"> · {{ props.session.locationKeys.get(objectId) }} (kept)</span>
                </span>
                <label v-if="conflictById.has(objectId)" class="grid gap-1 text-sm">
                  Replacement Location key for {{ objectById.get(objectId)?.name }}
                  <input
                    class="workspace-control min-h-10 rounded-md px-3"
                    :aria-invalid="props.session.validationErrors.has(objectId)"
                    :value="props.session.locationKeys.get(objectId) ?? ''"
                    :disabled="props.session.confirming || props.session.stale"
                    @input="updateLocationKey(objectId, $event)"
                  >
                </label>
                <p v-if="conflictById.has(objectId)" class="inspector-intro m-0">
                  Current key: {{ conflictById.get(objectId)?.currentKey }}
                </p>
                <p v-if="props.session.validationErrors.get(objectId)" class="m-0 text-sm text-[var(--status-error)]" role="alert">
                  {{ props.session.validationErrors.get(objectId) }}
                </p>
                <p v-else-if="conflictById.has(objectId)" class="inspector-intro m-0">
                  Suggested: {{ conflictById.get(objectId)!.suggestedKey }}
                </p>
              </template>
              <span v-else>{{ objectId }} (object no longer available)</span>
            </li>
          </ul>

          <div class="grid gap-2">
            <h3 class="m-0 text-sm font-semibold">Jump Route attachments that will clear</h3>
            <ul class="m-0 grid gap-1 pl-5">
              <li v-if="!props.session.review.detachedRouteAttachments.length">None</li>
              <li v-for="attachment in props.session.review.detachedRouteAttachments" :key="`${attachment.routeId}:${attachment.end}`" class="break-words">
                {{ routeAttachmentDescription(attachment) }}
              </li>
            </ul>
          </div>

          <div class="grid gap-2">
            <h3 class="m-0 text-sm font-semibold">Jump Point–Station links that will clear</h3>
            <ul class="m-0 grid gap-1 pl-5">
              <li v-if="!props.session.review.clearedStationLinks.length">None</li>
              <li v-for="link in props.session.review.clearedStationLinks" :key="`${link.objectId}:${link.stationId}`" class="break-words">
                {{ stationLinkDescription(link) }}
              </li>
            </ul>
          </div>
        </section>

        <UAlert
          v-if="props.session.error"
          color="error"
          variant="subtle"
          :description="props.session.error"
          role="alert"
        />
        <UAlert
          v-else-if="props.session.stale"
          color="warning"
          variant="subtle"
          description="The workspace changed after this review. Close this review and start again to confirm the current placement, keys, and relationships."
          role="status"
        />
        <UAlert
          v-else-if="props.session.review && props.session.review.detachedRouteAttachments.length + props.session.review.clearedStationLinks.length === 0"
          color="neutral"
          variant="subtle"
          description="No Jump Route attachments or Jump Point–Station links will change."
          role="status"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="props.session?.confirming"
          @click="cancel"
        >Cancel transfer</UButton>
        <UButton
          color="primary"
          :loading="props.session?.confirming"
          :disabled="!props.session?.canAccept || props.session.confirming || props.session.placingOnMap"
          data-system-transfer-apply
          @click="props.session && emit('intent', { kind: 'apply', sessionId: props.session.sessionId })"
        >Apply transfer</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
/** Presents a readonly transfer review and emits intents to the owning editor workflow. */
import { computed } from 'vue'
import { canPlaceObjectInOrbit } from '../../domain/workspace'
import type { Orbit } from '../../domain/workspace'
import type {
  SystemObjectTransferRouteAttachment,
  SystemObjectTransferStationLink,
} from '../../domain/workspace'
import type {
  SystemObjectTransferIntent,
  SystemObjectTransferReviewState,
} from '../../composables/editor-workflows/system-object-transfer-types'

const props = defineProps<{
  session: SystemObjectTransferReviewState | null
}>()

const emit = defineEmits<{
  intent: [intent: SystemObjectTransferIntent]
}>()

const dialogOpen = computed({
  get: () => props.session?.open ?? false,
  set: (open: boolean) => {
    if (!open && props.session?.open && !props.session.confirming && !props.session.placingOnMap) cancel()
  },
})

const destinationSystem = computed(() => props.session?.previewWorkspace?.cluster.systems.find(system =>
  system.id === props.session?.destinationSystemId,
) ?? props.session?.destinationSystems.find(system => system.id === props.session?.destinationSystemId))
const eligibleDestinationOrbits = computed(() => {
  const system = destinationSystem.value
  const rootObjectId = props.session?.rootObjectId
  if (!system || !rootObjectId) return []
  return system.orbits.filter(orbit => canPlaceObjectInOrbit(system, rootObjectId, orbit.id))
})
const conflictById = computed(() => new Map((props.session?.review?.keyConflicts ?? [])
  .map(conflict => [conflict.objectId, conflict])))
const objectById = computed(() => new Map((props.session?.previewWorkspace?.cluster.systems
  .find(system => system.id === props.session?.destinationSystemId)?.objects ?? [])
  .map(object => [object.id, object])))
const sourceObjectsById = computed(() => new Map((props.session?.sourceWorkspace?.cluster.systems ?? [])
  .flatMap(system => system.objects.map(object => [object.id, { object, system }] as const)))
)

function objectReference(objectId: string): string {
  const entry = sourceObjectsById.value.get(objectId)
  return entry ? `${entry.object.name} (${entry.object.locationKey})` : 'Jump Point'
}

function ownerName(systemId: string | null): string {
  if (systemId === null) return 'unresolved exit'
  return props.session?.sourceWorkspace?.cluster.systems.find(system => system.id === systemId)?.name ?? 'unknown system'
}

function routeEndpointDescription(systemId: string | null, pointId: string | null, unresolvedExit?: string): string {
  if (systemId === null) return unresolvedExit?.trim() || 'unresolved exit'
  const systemName = ownerName(systemId)
  if (!pointId) return systemName
  const point = sourceObjectsById.value.get(pointId)?.object
  return point
    ? `${systemName} · ${point.name} (${point.locationKey})`
    : `${systemName} · unattached Jump Point`
}

function routeAttachmentDescription(attachment: SystemObjectTransferRouteAttachment): string {
  const source = props.session?.sourceWorkspace
  const route = source?.cluster.routes.find(candidate => candidate.id === attachment.routeId)
  if (!route) return `${objectReference(attachment.pointId)} in ${ownerName(props.session?.sourceSystemId ?? null)} has a Jump Route endpoint that will detach.`
  const from = routeEndpointDescription(route.fromSystemId, route.fromPointId)
  const to = route.toSystemId === null
    ? routeEndpointDescription(null, null, route.unresolvedExit)
    : routeEndpointDescription(route.toSystemId, route.toPointId)
  const routeLabel = route.name?.trim()
    ? `Jump Route “${route.name.trim()}”`
    : 'Jump Route'
  return `${routeLabel}: ${from} → ${to}. ${objectReference(attachment.pointId)} in ${ownerName(attachment.end === 'from' ? route.fromSystemId : route.toSystemId)} will be detached from its ${attachment.end} endpoint.`
}

function stationLinkDescription(link: SystemObjectTransferStationLink): string {
  const jumpPoint = sourceObjectsById.value.get(link.objectId)
  const station = sourceObjectsById.value.get(link.stationId)
  const jumpPointName = jumpPoint ? `${jumpPoint.object.name} (${jumpPoint.object.locationKey})` : 'Jump Point'
  const stationName = station ? `${station.object.name} (${station.object.locationKey})` : 'Station'
  const jumpPointOwner = jumpPoint?.system.name ?? ownerName(props.session?.sourceSystemId ?? null)
  const stationOwner = station?.system.name ?? jumpPointOwner
  const movingEnd = link.direction === 'outgoing' ? 'The Jump Point moves.' : 'The Station moves.'
  return `${jumpPointName} in ${jumpPointOwner} → ${stationName} in ${stationOwner}. ${movingEnd} The association will clear.`
}

let opener: HTMLElement | null = null

function focusFirstControl(event: Event): void {
  const content = event.target
  if (!(content instanceof HTMLElement)) return
  if (!opener && document.activeElement instanceof HTMLElement) opener = document.activeElement
  const firstControl = content.querySelector<HTMLElement>('[data-transfer-destination]')
  if (firstControl) {
    event.preventDefault()
    firstControl.focus()
  }
}

function restoreFocus(event: Event): void {
  if (props.session?.placingOnMap) {
    event.preventDefault()
    return
  }
  event.preventDefault()
  const target = opener?.isConnected && !opener.matches(':disabled')
    ? opener
    : document.querySelector<HTMLElement>('#workspace-main [role="group"][aria-label$="star system map"]')
      ?? document.getElementById('workspace-main')
  target?.focus({ preventScroll: true })
  opener = null
}

function cancel(): void {
  if (props.session) emit('intent', { kind: 'cancel', sessionId: props.session.sessionId })
}

function selectDestination(event: Event): void {
  const systemId = (event.target as HTMLSelectElement).value
  if (props.session && systemId) {
    emit('intent', { kind: 'select-destination', sessionId: props.session.sessionId, systemId })
  }
}

function emitFreePlacement(point: { x: number; y: number }): void {
  if (!props.session || !props.session.destinationSystemId) return
  emit('intent', { kind: 'choose-free-placement', sessionId: props.session.sessionId, point })
}

function chooseFreeDefault(): void {
  const existing = props.session?.placement
  emitFreePlacement(existing?.kind === 'system' ? { x: existing.x, y: existing.y } : { x: 0.5, y: 0.5 })
}

function chooseOrbitDefault(): void {
  const orbit = eligibleDestinationOrbits.value[0]
  if (!props.session || !orbit) return
  const existingAngle = props.session.placement?.kind === 'orbit' ? props.session.placement.angle : -Math.PI / 2
  emit('intent', { kind: 'choose-orbit-placement', sessionId: props.session.sessionId, orbitId: orbit.id, angle: existingAngle })
}

function parseNumberInput(event: Event): number {
  const value = (event.target as HTMLInputElement).value
  return value.trim() ? Number(value) : Number.NaN
}

function updateFreeX(event: Event): void {
  const current = props.session?.placement
  if (current?.kind === 'system') emitFreePlacement({ x: parseNumberInput(event), y: current.y })
}

function updateFreeY(event: Event): void {
  const current = props.session?.placement
  if (current?.kind === 'system') emitFreePlacement({ x: current.x, y: parseNumberInput(event) })
}

function selectOrbit(event: Event): void {
  const orbitId = (event.target as HTMLSelectElement).value
  const current = props.session?.placement
  if (!props.session || current?.kind !== 'orbit' || !orbitId) return
  emit('intent', { kind: 'choose-orbit-placement', sessionId: props.session.sessionId, orbitId, angle: current.angle })
}

function updateOrbitAngle(event: Event): void {
  const current = props.session?.placement
  if (current?.kind === 'orbit' && props.session) {
    emit('intent', {
      kind: 'choose-orbit-placement',
      sessionId: props.session.sessionId,
      orbitId: current.orbitId,
      angle: parseNumberInput(event),
    })
  }
}

function updateLocationKey(objectId: string, event: Event): void {
  if (!props.session) return
  emit('intent', {
    kind: 'set-location-key',
    sessionId: props.session.sessionId,
    objectId,
    value: (event.target as HTMLInputElement).value,
  })
}

function orbitHostName(orbit: Orbit): string {
  if (orbit.hostId === null) return 'unoccupied center'
  return destinationSystem.value?.objects.find(object => object.id === orbit.hostId)?.name ?? 'missing host'
}

</script>
