<script setup lang="ts">
type HydrationState = 'loading' | 'ready' | 'error'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

defineProps<{
  hydrationState: HydrationState
  loadError: string | null
  saveState: SaveState
  saveError: string | null
  formError: string
}>()

const clusterName = defineModel<string>('clusterName', { required: true })
const systemName = defineModel<string>('systemName', { required: true })
const emit = defineEmits<{
  retry: []
  submit: []
}>()
</script>

<template>
  <section v-if="hydrationState === 'loading'" class="message-panel max-w-[44rem] p-[clamp(1.5rem,4vw,3rem)]" role="status" aria-live="polite">
    <span class="section-kicker">LOCAL ARCHIVE</span>
    <h1 class="my-4 text-[clamp(2.2rem,5vw,3.7rem)]">Opening this browser's workspace...</h1>
    <p class="max-w-[38rem] mb-[1em]">Your campaign data is read after the app loads.</p>
  </section>

  <section v-else-if="hydrationState === 'error'" class="message-panel error-panel max-w-[44rem] p-[clamp(1.5rem,4vw,3rem)]">
    <span class="section-kicker">LOCAL ARCHIVE UNAVAILABLE</span>
    <h1 class="my-4 text-[clamp(2.2rem,5vw,3.7rem)]">Your workspace could not be opened.</h1>
    <p class="max-w-[38rem] mb-[1em]" role="alert">{{ loadError }}</p>
    <button class="secondary-button" type="button" @click="emit('retry')">
      Try again
    </button>
  </section>

  <section v-else class="welcome mx-auto my-[5vh] grid max-w-[72rem] grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)] items-center gap-[clamp(2rem,7vw,7rem)] max-[760px]:my-4 max-[760px]:grid-cols-1">
    <div class="intro">
      <span class="section-kicker">A PRIVATE CHART FOR YOUR CAMPAIGN</span>
      <h1 class="my-4 max-w-[11ch] text-[clamp(2.8rem,6vw,5.4rem)] leading-[0.98] tracking-[-0.055em]">Give the unknown a name.</h1>
      <p class="max-w-[38rem] mb-[1em]">
        Start with a Jump Cluster and its first star system. This workspace stays in this browser;
        there is no account and no remote workspace.
      </p>
    </div>

    <form class="setup-panel flex min-h-[22rem] flex-col p-[clamp(1.25rem,3vw,2rem)]" @submit.prevent="emit('submit')">
      <div class="panel-heading flex items-center justify-between gap-[0.8rem]">
        <span class="section-kicker">NEW LOCAL WORKSPACE</span>
        <span class="step-marker">01 / 01</span>
      </div>
      <fieldset class="mt-8 mb-0 grid gap-[0.7rem] border-0 p-0" :disabled="saveState === 'saving'">
        <label for="cluster-name">Jump Cluster</label>
        <input
          id="cluster-name"
          v-model="clusterName"
          name="clusterName"
          autocomplete="off"
          maxlength="80"
          required
        >
        <label for="system-name">First star system</label>
        <input
          id="system-name"
          v-model="systemName"
          name="systemName"
          autocomplete="off"
          maxlength="80"
          required
        >
        <p v-if="formError" class="feedback m-0 error-text" role="alert">{{ formError }}</p>
        <button class="primary-button mt-[0.65rem]" type="submit">
          {{ saveState === 'saving' ? 'Saving...' : 'Create local workspace' }}
          <span aria-hidden="true">-&gt;</span>
        </button>
      </fieldset>
      <p class="save-feedback text-[0.72rem]" :class="{ 'error-text': saveState === 'error' }">
        <span class="inline-block size-[0.45rem] shrink-0 rounded-full bg-[var(--status-good)]" aria-hidden="true"></span>
        {{ saveState === 'error' ? `Not saved. ${saveError ?? ''}` : 'Your archive remains on this device.' }}
      </p>
    </form>
  </section>
</template>
