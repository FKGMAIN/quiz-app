// Keeps <html data-theme> and the browser chrome colour in step with the chosen theme.
// The inline script in nuxt.config.ts sets the first value before paint to avoid a flash.
const COLORS = { dark: '#0e1a14', light: '#f4f2ea' }

export default defineNuxtPlugin(() => {
  const { theme } = useSettings()
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null

  const paint = () => {
    const resolved = theme.value === 'auto' ? (mq?.matches ? 'light' : 'dark') : theme.value
    document.documentElement.setAttribute('data-theme', resolved)
    document.getElementById('meta-theme-color')?.setAttribute('content', COLORS[resolved])
  }
  watch(theme, paint, { immediate: true })
  mq?.addEventListener('change', () => { if (theme.value === 'auto') paint() })
})
