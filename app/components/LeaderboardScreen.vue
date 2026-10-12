<script setup lang="ts">
import type { LeaderboardResponse } from '~/types/api'

const emit = defineEmits<{ close: [] }>()
const api = useApi()
const { phone } = useSettings()

const board = ref<LeaderboardResponse | null>(null)
const failed = ref(false)
const left = ref('')

// Countdown to the daily reset.
let tick: ReturnType<typeof setInterval> | null = null
function updateCountdown() {
  if (!board.value?.resets_at) { left.value = ''; return }
  const ms = Math.max(0, Date.parse(board.value.resets_at) - Date.now())
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  left.value = `${h}h ${String(m).padStart(2, '0')}m`
  if (ms === 0) load()
}

async function load() {
  try {
    board.value = await api.leaderboard(phone.value)
    failed.value = false
    updateCountdown()
  } catch {
    failed.value = true
  }
}

onMounted(() => {
  load()
  tick = setInterval(updateCountdown, 30_000)
})
onBeforeUnmount(() => { if (tick) clearInterval(tick) })

const youBelowList = computed(() => !!board.value?.you && !board.value.entries.some(e => e.you))
</script>

<template>
  <div class="screen open">
    <div class="screen-inner settings">
      <div class="settings-head">
        <h1 class="h2">Today's leaderboard</h1>
        <button class="icon-btn boxed" aria-label="Close" @click="emit('close')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div class="fine" v-if="board">
        Resets in {{ left || '—' }} ({{ board.timezone }}). Points decide the order; more streaks win ties.
      </div>
      <div class="fine" v-else-if="failed">The leaderboard is unavailable right now.</div>
      <div class="fine" v-else>Loading…</div>

      <ul v-if="board" class="history board">
        <li v-if="!board.entries.length"><span>No scores yet today. Be the first.</span></li>
        <li v-for="e in board.entries" :key="e.rank" :class="{ you: e.you }">
          <span><b class="rank">{{ e.rank }}</b> {{ e.you ? 'You' : e.player }}</span>
          <span class="dim">{{ e.points.toLocaleString() }} pts · {{ e.streaks }} {{ e.streaks === 1 ? 'streak' : 'streaks' }}</span>
        </li>
        <li v-if="youBelowList && board.you" class="you">
          <span><b class="rank">{{ board.you.rank }}</b> You</span>
          <span class="dim">{{ board.you.points.toLocaleString() }} pts · {{ board.you.streaks }} {{ board.you.streaks === 1 ? 'streak' : 'streaks' }}</span>
        </li>
      </ul>
      <div v-if="board && !board.you" class="fine">Play a word to get on today's board.</div>
    </div>
  </div>
</template>
