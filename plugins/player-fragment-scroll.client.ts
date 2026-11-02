export default defineNuxtPlugin({
  name: 'player-fragment-scroll',
  dependsOn: ['nuxt:router'],
  setup(nuxtApp) {
    const router = useRouter()
    let guarded: typeof router.options.scrollBehavior

    function installGuard(): void {
      if (guarded && router.options.scrollBehavior === guarded) return

      const delegate = router.options.scrollBehavior
      guarded = (to, from, savedPosition) => {
        if (to.path.replace(/\/+$/, '') === '/player') return false
        return delegate ? delegate(to, from, savedPosition) : false
      }
      router.options.scrollBehavior = guarded
    }

    installGuard()
    nuxtApp.hook('app:beforeMount', installGuard)
  },
})
