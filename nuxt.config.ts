import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-08',
  ssr: true,
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
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
})
