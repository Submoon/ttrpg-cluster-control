<template>
  <main class="player-reader" :class="{ 'player-reader--workspace map-workspace-shell': playerDocument }">
    <input
      ref="fileInput"
      class="player-reader-file-input--hidden"
      type="file"
      accept="application/json,.json"
      aria-label="Open player JSON"
      :disabled="!isClientReady"
      @change="openPlayerFile"
    >

    <template v-if="playerDocument">
      <PlayerDocumentView
        :document="playerDocument"
        :active="true"
        :workspace-presentation="true"
        aria-label="Player document"
      >
        <template #workspace-actions>
          <div class="player-reader-actions">
            <UButton color="neutral" variant="outline" size="sm" :disabled="!isClientReady" @click="requestFileOpen">
              Open player JSON
            </UButton>
            <a v-if="readerMode === 'link'" class="player-reader-file-link" :href="playerJsonHref">Open player JSON instead</a>
          </div>
        </template>
      </PlayerDocumentView>
    </template>

    <template v-else>
      <WorkspaceHeader
        :workspace="null"
        :public-title="readerMode === 'link' ? 'Open a shared player map' : 'Open a player map'"
        :public-eyebrow="readerMode === 'link' ? 'PLAYER LINK' : 'PLAYER VIEW'"
      >
        <template #player-actions>
          <div class="player-reader-actions">
            <UButton color="neutral" variant="outline" size="sm" :disabled="!isClientReady" @click="requestFileOpen">
              Open player JSON
            </UButton>
            <a v-if="readerMode === 'link'" class="player-reader-file-link" :href="playerJsonHref">Open player JSON instead</a>
          </div>
        </template>
      </WorkspaceHeader>

      <div class="player-reader-open-content">
        <section v-if="readerMode === 'file'" class="player-reader-file" aria-label="Open a player map file" :aria-busy="!isClientReady">
          <h2>Choose a player JSON file</h2>
          <p>Player maps are kept only in this tab. After a reload, open the JSON file again.</p>
          <p v-if="isLoading" role="status">Opening player JSON…</p>
        </section>
        <section v-else class="player-reader-link" aria-label="Open a player link" :aria-busy="isLoading">
          <p>This link contains an immutable player snapshot. Anyone with it can read and copy the shared data.</p>
          <p v-if="isLoading" role="status">Opening player link…</p>
        </section>
        <p v-if="errorMessage" role="alert" class="player-reader-error">{{ errorMessage }}</p>
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
/** Standalone file reader; it does not hydrate or persist the Warden workspace. */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PlayerDocumentError, parsePlayerJson } from '../domain/workspace'
import type { PlayerClusterDocument } from '../domain/workspace'
import { MAX_PLAYER_SHARE_URL_BYTES, decodePlayerShareFragment, PlayerShareLinkError } from '../utils/player-share-link'
import PlayerDocumentView from '../components/PlayerDocumentView.vue'
import WorkspaceHeader from '../components/WorkspaceHeader.vue'

defineOptions({ name: 'PlayerMapReaderPage' })

const MAX_PLAYER_JSON_FILE_BYTES = 4 * 1024 * 1024
const playerDocument = ref<PlayerClusterDocument | null>(null)
const errorMessage = ref<string | null>(null)
const isLoading = ref(false)
const isClientReady = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
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

function requestFileOpen(): void {
  fileInput.value?.click()
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
  display: flex;
  flex-direction: column;
  gap: .75rem;
  min-height: 100vh;
  padding: .5rem;
  background: var(--app-bg);
  color: var(--text-primary);
}

.player-reader--workspace {
  display: flex;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  padding: .5rem;
}

.player-reader-open-content {
  display: grid;
  width: min(100% - 2rem, 52rem);
  gap: .75rem;
  margin: clamp(2rem, 8vh, 6rem) auto;
  border: 1px solid var(--line-soft);
  border-radius: .35rem;
  padding: clamp(1rem, 4vw, 2.5rem);
  background: var(--panel-bg);
  box-shadow: 0 .7rem 2.2rem color-mix(in srgb, var(--map-bg) 18%, transparent);
}

.player-reader-file h2 {
  margin: 0;
  font-family: Georgia, serif;
  font-size: 1.4rem;
  font-weight: 400;
}

.player-reader-file p,
.player-reader-link p {
  margin: 0;
  color: var(--text-secondary);
  font-size: .85rem;
  line-height: 1.6;
}

.player-reader-actions {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: .4rem;
}

.player-reader-file-input--hidden {
  position: fixed;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.player-reader-file-link {
  width: fit-content;
  color: var(--text-secondary);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.player-reader-error {
  margin: 0;
  color: var(--error);
}
</style>
