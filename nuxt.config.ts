export default defineNuxtConfig({
  compatibilityDate: '2026-10-08',
  ssr: true,
  modules: ['@nuxt/ui'],
  ui: { fonts: false },
  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
    storage: 'localStorage',
    storageKey: 'nuxt-color-mode',
    disableTransition: true,
  },
  icon: {
    provider: 'server',
    serverBundle: { collections: ['lucide'], remote: false },
    fallbackToApi: false,
  },
  app: {
    head: {
      title: 'TTRPG Cluster Control',
    },
  },
  nitro: {
    // Nuxt 4.6.0 misses this Nitro inline rule on Windows; remove when the upstream fix ships.
    externals: {
      inline: [/[\\/]node_modules[\\/]nuxt[\\/]dist[\\/]/],
    },
  },
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
})
