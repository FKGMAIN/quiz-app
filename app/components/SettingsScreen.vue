<script setup lang="ts">
import type { HistoryResponse } from '~/types/api'

const emit = defineEmits<{ close: []; switch: []; timer: [seconds: number] }>()

const settings = useSettings()
const sound = useSound()
const api = useApi()

const THEMES = [['dark', 'Dark'], ['light', 'Light'], ['auto', 'Auto']] as const
const TIMERS = [[0, 'Off'], [30, '30s'], [45, '45s'], [60, '60s']] as const

const maskedPhone = computed(() => {
  const p = settings.phone.value
  return p && p.length > 8 ? `${p.slice(0, 4)} ••• ${p.slice(-4)}` : p || '—'
})

function toggleSound() {
  settings.toggleSound()
  sound.play('playTap')
}
function toggleHaptics() {
  if (settings.toggleHaptics()) sound.buzz(30)
}

// Play history for this number.
const shareId = ref('')
const history = ref<HistoryResponse | null>(null)
const historyError = ref(false)
const OUTCOMES: Record<string, string> = { won: 'Won', banked: 'Banked', missed: 'Missed', skipped: 'Skipped', timeout: "Time's up", expired: 'Expired' }
const totalsText = computed(() => {
  if (historyError.value) return 'History unavailable offline.'
  if (!history.value) return 'Loading…'
  const t = history.value.totals
  return t.sessions ? `${t.sessions} sessions, ${t.wins} won, best ${t.best_points.toLocaleString()} pts, most streaks ${t.best_streaks}` : 'No finished sessions yet.'
})
const shortDate = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

onMounted(async () => {
  sound.play('playTap')
  try { history.value = await api.history(settings.phone.value) } catch { historyError.value = true }
})
</script>

<template>
  <div class="screen open">
    <div class="screen-inner settings">
      <div class="settings-head">
        <h1 class="h2">Settings</h1>
        <button class="icon-btn boxed" aria-label="Close" @click="emit('close')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div class="group">
        <div class="group-label">Appearance</div>
        <div class="seg">
          <button v-for="[value, label] in THEMES" :key="value" type="button" :class="{ active: settings.theme.value === value }" @click="settings.setTheme(value)">{{ label }}</button>
        </div>
      </div>

      <div class="group">
        <div class="group-label">Timer per word</div>
        <div class="seg">
          <button v-for="[value, label] in TIMERS" :key="value" type="button" :class="{ active: settings.timer.value === value }" @click="emit('timer', value)">{{ label }}</button>
        </div>
        <div class="fine">Off means relaxed play. Streaks still count.</div>
      </div>

      <div class="group">
        <div class="group-label">Play history</div>
        <div class="fine">{{ totalsText }}</div>
        <ul class="history">
          <li v-for="(s, i) in history?.sessions || []" :key="i" :class="{ tap: !s.id.startsWith('legacy-') }" @click="!s.id.startsWith('legacy-') && (shareId = s.id)">
            <span>{{ OUTCOMES[s.outcome] || s.outcome }} · {{ s.streaks }} {{ s.streaks === 1 ? 'streak' : 'streaks' }}</span>
            <span class="dim">{{ s.points.toLocaleString() }} pts · {{ shortDate(s.ended_at) }}</span>
          </li>
        </ul>
      </div>

      <div class="list">
        <div class="list-row">
          <div><div class="list-title">Sound</div><div class="list-sub">Taps and results</div></div>
          <button class="toggle" role="switch" :aria-checked="settings.soundOn.value" aria-label="Sound" @click="toggleSound"><span /></button>
        </div>
        <div class="list-row">
          <div><div class="list-title">Haptics</div><div class="list-sub">Small buzz on each letter</div></div>
          <button class="toggle" role="switch" :aria-checked="settings.hapticsOn.value" aria-label="Haptics" @click="toggleHaptics"><span /></button>
        </div>
      </div>

      <div class="spacer" />
      <div class="player-card">
        <div><div class="list-sub">Playing as</div><div class="list-title">{{ maskedPhone }}</div></div>
        <button class="small-btn" @click="emit('switch')">Change</button>
      </div>
    </div>
  </div>
  <ShareScreen v-if="shareId" :session-id="shareId" @close="shareId = ''" />
</template>
