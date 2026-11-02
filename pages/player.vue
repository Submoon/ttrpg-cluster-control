<template>
  <main class="player-reader min-h-screen px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto grid w-full max-w-7xl gap-5">
      <template v-if="readerMode === 'file'">
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
      </template>

      <section v-else class="player-reader-link grid gap-2" aria-label="Open a player link" :aria-busy="isLoading">
        <span class="section-kicker">PLAYER LINK</span>
        <h1 class="m-0 text-3xl">Open a shared player map</h1>
        <p class="inspector-intro m-0">
          This link contains an immutable player snapshot. Anyone with it can read and copy the shared data.
        </p>
        <p v-if="isLoading" role="status" class="m-0">Opening player link…</p>
        <p v-if="errorMessage" role="alert" class="player-reader-error m-0">{{ errorMessage }}</p>
        <a class="player-reader-file-link" :href="playerJsonHref">Open player JSON instead</a>
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
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PlayerDocumentError, parsePlayerJson } from '../domain/workspace'
import type { PlayerClusterDocument } from '../domain/workspace'
import { MAX_PLAYER_SHARE_URL_BYTES, decodePlayerShareFragment, PlayerShareLinkError } from '../utils/player-share-link'
import PlayerDocumentView from '../components/PlayerDocumentView.vue'

defineOptions({ name: 'PlayerMapReaderPage' })

const MAX_PLAYER_JSON_FILE_BYTES = 4 * 1024 * 1024
const playerDocument = ref<PlayerClusterDocument | null>(null)
const errorMessage = ref<string | null>(null)
const isLoading = ref(false)
const isClientReady = ref(false)
const readerMode = ref<'file' | 'link'>('file')
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const configuredBasePath = runtimeConfig.app.baseURL.replace(/^\/+|\/+$/g, '')
const playerJsonHref = `/${configuredBasePath ? `${configuredBasePath}/` : ''}player`
let requestNonce = 0
let isDisposed = false
let lastRawHash: string | undefined
let activeLinkAbort: AbortController | null = null
let stopRouteHashWatch: (() => void) | null = null

onMounted(() => {
  isClientReady.value = true
  window.addEventListener('hashchange', refreshFromLocation)
  stopRouteHashWatch = watch(() => route.hash, refreshFromLocation, { flush: 'sync' })
  refreshFromLocation()
})

onBeforeUnmount(() => {
  isDisposed = true
  requestNonce += 1
  activeLinkAbort?.abort()
  activeLinkAbort = null
  stopRouteHashWatch?.()
  window.removeEventListener('hashchange', refreshFromLocation)
})

function isWithinShareUrlLimit(url: string): boolean {
  let byteLength = 0
  for (const character of url) {
    const codePoint = character.codePointAt(0)!
    byteLength += codePoint <= 0x7f ? 1
      : codePoint <= 0x7ff ? 2
        : codePoint <= 0xffff ? 3
          : 4
    if (byteLength > MAX_PLAYER_SHARE_URL_BYTES) return false
  }
  return true
}

function refreshFromLocation(): void {
  const rawHash = window.location.hash
  if (rawHash === lastRawHash) return
  lastRawHash = rawHash

  const request = ++requestNonce
  activeLinkAbort?.abort()
  activeLinkAbort = null
  readerMode.value = rawHash ? 'link' : 'file'
  playerDocument.value = null
  errorMessage.value = null
  isLoading.value = false
  if (!rawHash) return

  isLoading.value = true
  void openPlayerLink(rawHash, request)
}

async function openPlayerLink(rawHash: string, request: number): Promise<void> {
  const abortController = new AbortController()
  activeLinkAbort = abortController
  try {
    if (!isWithinShareUrlLimit(window.location.href)) {
      errorMessage.value = 'The complete player link exceeds the supported URL size limit.'
      return
    }
    const document = await decodePlayerShareFragment(rawHash, { signal: abortController.signal })
    if (isDisposed || request !== requestNonce || abortController.signal.aborted) return
    playerDocument.value = document
  } catch (error) {
    if (isDisposed || request !== requestNonce || abortController.signal.aborted) return
    errorMessage.value = error instanceof PlayerDocumentError || error instanceof PlayerShareLinkError
      ? error.message
      : 'The player link could not be opened.'
  } finally {
    if (!isDisposed && request === requestNonce) {
      isLoading.value = false
      if (activeLinkAbort === abortController) activeLinkAbort = null
    }
  }
}

async function openPlayerFile(event: Event): Promise<void> {
  const input = event.currentTarget
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.item(0)
  input.value = ''
  if (!file) return

  activeLinkAbort?.abort()
  activeLinkAbort = null
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

.player-reader-file-link {
  width: fit-content;
  color: var(--text-secondary);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.player-reader-error {
  color: var(--danger, #b42318);
}
</style>
