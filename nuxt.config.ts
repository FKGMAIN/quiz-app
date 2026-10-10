// Pitch Legends: a single-page Vue app (no SSR) served by Nuxt's Nitro server, which also hosts the /api routes.

// Runs before first paint so the saved theme shows without a flash.
const themeBootstrap = `(function(){try{var t=localStorage.getItem('soccer_theme');if(t!=='light'&&t!=='dark')t=(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark';document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})()`

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'Pitch Legends',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover' },
        { id: 'meta-theme-color', name: 'theme-color', content: '#0e1a14' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=Instrument+Sans:wght@500;600;700&display=swap' }
      ],
      script: [{ innerHTML: themeBootstrap }]
    }
  },

  nitro: {
    // The puzzle bank ships inside the server bundle and is read at startup by server/utils/seed.ts.
    serverAssets: [{ baseName: 'seed', dir: './server/database/seed' }]
  }
})
