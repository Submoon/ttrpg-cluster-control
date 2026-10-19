<template>
  <section v-if="hydrationState === 'loading'" class="workspace-message mx-auto w-full max-w-[44rem]">
    <UCard class="message-panel workspace-message-card" variant="outline" :ui="messageCardUi" role="status" aria-live="polite">
      <span class="section-kicker">LOCAL ARCHIVE</span>
      <h1 class="workspace-message-title my-2">Opening this browser's workspace...</h1>
      <p class="workspace-message-copy m-0 max-w-[38rem]">Your campaign data is read after the app loads.</p>
    </UCard>
  </section>

  <section v-else-if="hydrationState === 'error'" class="workspace-message mx-auto w-full max-w-[44rem]">
    <UCard class="message-panel error-panel workspace-message-card" variant="outline" :ui="messageCardUi">
      <span class="section-kicker">LOCAL ARCHIVE UNAVAILABLE</span>
      <h1 class="workspace-message-title my-2">Your workspace could not be opened.</h1>
      <UAlert
        class="workspace-recovery-alert my-3"
        color="error"
        variant="subtle"
        :description="recoveryError ? `${loadError ?? ''} ${recoveryError}` : loadError ?? ''"
        role="alert"
        :ui="{ root: 'rounded-[2px] p-3 text-[0.875rem] leading-[1.5]' }"
      />
      <p class="workspace-recovery-copy my-3 max-w-[38rem]">
        This browser keeps the last valid workspace snapshot as a backup when one is available.
      </p>
      <div class="workspace-recovery-actions flex flex-wrap gap-2">
        <UButton
          class="secondary-button launch-action"
          color="neutral"
          variant="outline"
          size="md"
          type="button"
          @click="emit('retry')"
        >
        Try again
        </UButton>
        <UButton
          class="secondary-button launch-action"
          color="neutral"
          variant="outline"
          size="md"
          type="button"
          @click="emit('restore-backup')"
        >
        Restore last valid backup
        </UButton>
      </div>
    </UCard>
  </section>

  <section v-else class="workspace-welcome mx-auto my-[clamp(0.75rem,2.5vh,1.75rem)] grid w-full max-w-[66rem] grid-cols-[minmax(0,1.05fr)_minmax(19rem,0.95fr)] items-center gap-[clamp(1.5rem,5vw,5rem)] max-[760px]:my-3 max-[760px]:grid-cols-1">
    <div class="workspace-welcome-intro">
      <span class="section-kicker">A PRIVATE CHART FOR YOUR CAMPAIGN</span>
      <h1 class="workspace-welcome-title my-3 max-w-[14ch] leading-[1.02] tracking-[-0.04em]">Give the unknown a name.</h1>
      <p class="mb-0 max-w-[34rem] text-[0.92rem] leading-[1.65]">
        Start with a Jump Cluster and its first star system. This workspace stays in this browser;
        there is no account and no remote workspace.
      </p>
    </div>

    <form class="workspace-launch-form" aria-labelledby="workspace-form-title" @submit.prevent="emit('submit')">
      <UCard
        class="setup-panel workspace-launch-card"
        variant="outline"
        :ui="{
          root: 'rounded-[2px] overflow-hidden',
          header: 'px-4 py-2.5 sm:px-5',
          body: 'px-4 py-4 sm:px-5',
          footer: 'px-4 py-2.5 sm:px-5',
        }"
      >
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <span id="workspace-form-title" class="section-kicker">NEW LOCAL WORKSPACE</span>
            <span class="step-marker">01 / 01</span>
          </div>
        </template>

        <fieldset class="workspace-launch-fields mb-0 grid gap-3 border-0 p-0" :disabled="saveState === 'saving'">
          <UFormField
            label="Jump Cluster"
            required
            class="grid gap-1.5"
            :ui="{ label: 'text-[0.65rem] font-medium tracking-[0.08em] uppercase text-[var(--text-secondary)]' }"
          >
            <UInput
              v-model="clusterName"
              class="w-full"
              :ui="launchInputUi"
              name="clusterName"
              autocomplete="off"
              maxlength="80"
              required
            />
          </UFormField>
          <UFormField
            label="First star system"
            required
            class="grid gap-1.5"
            :ui="{ label: 'text-[0.65rem] font-medium tracking-[0.08em] uppercase text-[var(--text-secondary)]' }"
          >
            <UInput
              v-model="systemName"
              class="w-full"
              :ui="launchInputUi"
              name="systemName"
              autocomplete="off"
              maxlength="80"
              required
            />
          </UFormField>
          <UAlert
            v-if="formError"
            class="workspace-form-alert"
            color="error"
            variant="subtle"
            :description="formError"
            role="alert"
            :ui="{ root: 'rounded-[2px] p-3 text-sm' }"
          />
          <UButton
            class="workspace-launch-submit primary-button launch-action mt-1"
            color="primary"
            variant="solid"
            size="md"
            block
            type="submit"
            :disabled="saveState === 'saving'"
            :loading="saveState === 'saving'"
          >
            {{ saveState === 'saving' ? 'Saving...' : 'Create local workspace' }}
            <span aria-hidden="true">-&gt;</span>
          </UButton>
        </fieldset>

        <template #footer>
          <UAlert
            v-if="saveState === 'error'"
            color="error"
            variant="subtle"
            :description="`Not saved. ${saveError ?? ''}`"
            role="alert"
            :ui="{ root: 'rounded-[2px] p-3 text-sm' }"
          />
          <p v-else class="workspace-launch-save-feedback m-0 flex items-center gap-2 text-[0.72rem]" role="status" aria-live="polite">
            <span
              class="inline-block size-[0.45rem] shrink-0 rounded-full"
              :class="saveState === 'saved' ? 'bg-[var(--status-good)]' : 'bg-[var(--text-muted)]'"
              aria-hidden="true"
            ></span>
            Your archive remains on this device.
          </p>
        </template>
      </UCard>
    </form>
  </section>
</template>

<script setup lang="ts">
/**
 * Presents workspace loading and creation states without owning hydration or persistence.
 */
type HydrationState = 'loading' | 'ready' | 'error'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

defineProps<{
  hydrationState: HydrationState
  loadError: string | null
  recoveryError: string | null
  saveState: SaveState
  saveError: string | null
  formError: string
}>()

const clusterName = defineModel<string>('clusterName', { required: true })
const systemName = defineModel<string>('systemName', { required: true })
const launchInputUi = {
  root: 'w-full',
  base: 'min-h-[2.75rem] w-full rounded-[2px] border border-[var(--control-border)] bg-[var(--control-bg)] px-[0.7rem] py-[0.6rem] text-[0.875rem] text-[var(--text-primary)] shadow-none focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-[3px]',
}
const messageCardUi = {
  root: 'rounded-[2px] overflow-hidden',
  body: 'p-4 sm:p-5',
}
const emit = defineEmits<{
  retry: []
  'restore-backup': []
  submit: []
}>()
</script>

<style scoped>
.workspace-welcome :deep(:is(button, input):focus-visible),
.workspace-message :deep(button:focus-visible) {
  outline-color: var(--focus) !important;
}

.launch-action {
  scroll-margin-block: 0.75rem;
}

.workspace-welcome-title {
  font-size: clamp(2rem, 4vw, 3.5rem);
}

.workspace-message-title {
  font-size: clamp(1.65rem, 5vw, 2.25rem);
  line-height: 1.15;
}

.workspace-message-copy,
.workspace-recovery-copy {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.55;
}

.workspace-recovery-actions > :deep(button) {
  min-height: 2.65rem;
}

.workspace-launch-save-feedback {
  color: var(--text-muted);
  line-height: 1.45;
}

@media (max-width: 760px) {
  .workspace-welcome-title {
    font-size: clamp(2rem, 7.5vw, 2.65rem);
  }
}

@media (max-height: 450px) {
  .workspace-welcome {
    align-items: start;
    gap: 0.8rem;
    margin-block: 0.35rem;
  }

  .workspace-welcome-title {
    margin-block: 0.3rem;
    font-size: clamp(1.6rem, 3.5vw, 2rem);
  }

  .workspace-welcome-intro p {
    max-width: 32rem;
    font-size: 0.8rem;
    line-height: 1.4;
  }

  .workspace-launch-card :deep([data-slot='header']),
  .workspace-launch-card :deep([data-slot='footer']) {
    padding-block: 0.4rem;
  }

  .workspace-launch-card :deep([data-slot='body']) {
    padding-block: 0.5rem;
  }

  .workspace-launch-fields {
    gap: 0.45rem;
  }

  .workspace-launch-card :deep(input) {
    min-height: 2.3rem;
    padding-block: 0.45rem;
  }

  .workspace-launch-submit {
    min-height: 2.35rem;
  }
}

@media (max-height: 560px) {
  .workspace-message-card :deep([data-slot='body']) {
    padding-block: 0.75rem;
  }

  .workspace-message-title {
    margin-block: 0.4rem;
    font-size: clamp(1.6rem, 6vw, 2rem);
    line-height: 1.08;
  }

  .workspace-recovery-alert {
    margin-block: 0.5rem;
  }

  .workspace-recovery-copy {
    margin-block: 0.5rem;
    font-size: 0.82rem;
    line-height: 1.4;
  }

  .workspace-recovery-actions {
    gap: 0.5rem;
  }

  .workspace-recovery-actions > :deep(button) {
    min-height: 2.5rem;
    padding-inline: 0.65rem;
    font-size: 0.68rem;
  }
}

@media (max-height: 450px) {
  .workspace-message-card :deep([data-slot='body']) {
    padding-block: 0.6rem;
  }

  .error-panel {
    border-color: var(--error-border);
  }
}
</style>
