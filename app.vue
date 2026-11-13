<template>
  <UApp :toaster="{ ui: { viewport: 'app-toast-viewport' } }">
    <NuxtPage />
  </UApp>
</template>

<style>
/* Keep global notifications above the Fields dialog actions. */
body:has(.field-definitions-modal[data-state='open']) .app-toast-viewport {
  bottom: calc(7rem + env(safe-area-inset-bottom));
}
</style>
