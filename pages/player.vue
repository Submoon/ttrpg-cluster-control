<template>
  <main class="player-reader min-h-screen px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto grid w-full max-w-7xl gap-5">
      <header class="grid gap-1">
        <span class="section-kicker">PLAYER VIEW</span>
        <h1 class="m-0 text-3xl">Open a player map</h1>
        <p class="inspector-intro m-0">Choose a player JSON file to view its shared Jump Cluster.</p>
      </header>

      <section
        class="player-reader-file grid gap-2"
        aria-label="Open a player map file"
        :aria-busy="!isClientReady"
      >
        <label class="grid w-fit cursor-pointer gap-2 font-semibold">
          <span>Open player JSON</span>
          <input
            class="player-reader-file-input"
            type="file"
            accept="application/json,.json"
            aria-label="Open player JSON"
            :disabled="!isClientReady"
            @change="openPlayerFile"
          >
        </label>
        <p class="inspector-intro m-0">
          Player maps are kept only in this tab. After a reload, open the JSON file again.
        </p>
        <p v-if="isLoading" role="status" class="m-0">Opening player JSON…</p>
        <p v-if="errorMessage" role="alert" class="player-reader-error m-0">{{ errorMessage }}</p>
      </section>

      <PlayerDocumentView
        v-if="playerDocument"
        :document="playerDocument"
        :active="true"
        :heading-level="'h2'"
        aria-label="Player document"
        description="Read-only view of the information shared in this document."
      />
    </div>
  </main>
</template>

<script setup lang="ts">
/** Standalone file reader; it does not hydrate or persist the Warden workspace. */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { PlayerDocumentError, parsePlayerJson } from '../domain/workspace'
import type { PlayerClusterDocument } from '../domain/workspace'
import PlayerDocumentView from '../components/PlayerDocumentView.vue'

defineOptions({ name: 'PlayerMapReaderPage' })

const MAX_PLAYER_JSON_FILE_BYTES = 4 * 1024 * 1024
const playerDocument = ref<PlayerClusterDocument | null>(null)
const errorMessage = ref<string | null>(null)
const isLoading = ref(false)
const isClientReady = ref(false)
let requestNonce = 0
let isDisposed = false

onMounted(() => {
  isClientReady.value = true
})

onBeforeUnmount(() => {
  isDisposed = true
  requestNonce += 1
})

async function openPlayerFile(event: Event): Promise<void> {
  const input = event.currentTarget
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.item(0)
  input.value = ''
  if (!file) return

  const request = ++requestNonce
  playerDocument.value = null
  errorMessage.value = null
  isLoading.value = true

  try {
    if (file.size > MAX_PLAYER_JSON_FILE_BYTES) throw new PlayerDocumentError('too-large')
    const json = await file.text()
    if (isDisposed || request !== requestNonce) return
    playerDocument.value = parsePlayerJson(json)
  } catch (error) {
    if (isDisposed || request !== requestNonce) return
    errorMessage.value = error instanceof PlayerDocumentError
      ? error.message
      : 'The player JSON file could not be opened.'
  } finally {
    if (!isDisposed && request === requestNonce) isLoading.value = false
  }
}
</script>

<style scoped>
.player-reader {
  background: var(--page-bg);
  color: var(--text-primary);
}

.player-reader-file-input {
  max-width: min(100%, 28rem);
  border: 1px solid var(--line-soft);
  border-radius: .375rem;
  background: var(--panel-bg);
  padding: .5rem;
  color: var(--text-primary);
  font-weight: 400;
}

.player-reader-error {
  color: var(--danger, #b42318);
}
</style>
