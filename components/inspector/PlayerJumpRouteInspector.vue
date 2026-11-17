<template>
  <section class="player-jump-route-inspector" aria-label="Jump Route details">
    <div class="player-jump-route-inspector-body">
      <span class="section-kicker">JUMP ROUTE / PLAYER VIEW</span>
      <span class="type-chip mt-[0.65rem] inline-block border border-[var(--line)] px-[0.4rem] py-[0.27rem]">SYSTEM CONNECTIONS</span>
      <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere]">Jump Level {{ props.route.jumpLevel }}</h2>
      <dl class="player-jump-route-endpoints">
        <div>
          <dt>Origin</dt>
          <dd>{{ props.route.originLabel }}</dd>
        </div>
        <div>
          <dt>Destination</dt>
          <dd>{{ props.route.destinationLabel }}</dd>
        </div>
      </dl>
      <p v-if="props.route.unresolved" class="player-jump-route-unknown">
        The destination is not identified in the player view.
      </p>
    </div>
    <footer class="player-jump-route-inspector-footer" aria-label="Jump Route actions">
      <UButton block class="w-full justify-center" color="primary" aria-label="Center selected Jump Route" @click="emit('center')">
        Center route
      </UButton>
    </footer>
  </section>
</template>

<script setup lang="ts">
import type { PlayerContinuousRouteDescriptor } from '../../utils/player-continuous-route-projection'

const props = defineProps<{ route: PlayerContinuousRouteDescriptor }>()
const emit = defineEmits<{ center: [] }>()
</script>

<style scoped>
.player-jump-route-inspector {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
}

.player-jump-route-inspector-body {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: .8rem .9rem;
}

.player-jump-route-endpoints {
  display: grid;
  gap: .75rem;
  margin: 1rem 0;
  border-block: 1px solid var(--line-soft);
  padding-block: .8rem;
}

.player-jump-route-endpoints div { min-width: 0; }
.player-jump-route-endpoints dt { color: var(--text-muted); font-size: .75rem; }
.player-jump-route-endpoints dd { margin: .15rem 0 0; overflow-wrap: anywhere; }
.player-jump-route-unknown { color: var(--text-secondary); font-size: .85rem; }

.player-jump-route-inspector-footer {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-end;
  border-top: 1px solid var(--line-soft);
  background: var(--panel-bg);
  padding: .65rem .9rem max(.65rem, env(safe-area-inset-bottom, 0px));
}
</style>
