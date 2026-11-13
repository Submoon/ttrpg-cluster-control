export default defineNuxtConfig({
  compatibilityDate: '2026-10-08',
  ssr: true,
  runtimeConfig: {
    public: {
      googleDriveClientId: '',
      googleDriveProjectNumber: '',
      googleDriveApiKey: '',
    },
  },
  modules: ['@nuxt/ui', '@pinia/nuxt'],
  typescript: {
    tsConfig: {
      // Reports contain generated third-party bundles, not project source.
      exclude: ['../test-results/**', '../playwright-report/**'],
    },
  },
  pinia: {
    storesDirs: ['./stores/**'],
  },
  vite: {
    // Keep the Nuxt plugin and application stores on the same Pinia SSR runtime.
    ssr: { noExternal: ['pinia'] },
  },
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
  css: ['~/assets/css/main.css', '~/assets/css/map-workspace.css'],
})
