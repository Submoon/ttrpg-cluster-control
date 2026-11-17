<template>
  <main class="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
    <p class="text-sm text-muted" role="status">Dropbox authorization finished. Return to TTRPG Cluster Control to continue.</p>
  </main>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { publishDropboxOAuthCallback } from '../../../utils/dropbox-auth'

defineOptions({ name: 'DropboxOAuthCallbackPage' })

onMounted(() => publishDropboxOAuthCallback(window))
</script>
