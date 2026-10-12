<script setup lang="ts">
import type { RecapResponse } from '~/types/api'

const props = defineProps<{ sessionId: string }>()
const emit = defineEmits<{ close: [] }>()

const api = useApi()
const recap = ref<RecapResponse | null>(null)
const error = ref('')
const label = ref('Share')

onMounted(async () => {
  try { recap.value = await api.share(props.sessionId) } catch (e: any) { error.value = e?.message || 'Could not load this session.' }
})

const link = computed(() => `${location.origin}/s/${props.sessionId}`)
const fmt = (n: number) => n.toLocaleString('en-US')

function flash(text: string) {
  label.value = text
  setTimeout(() => { label.value = 'Share' }, 1800)
}

async function share() {
  if (!recap.value) return
  const text = recap.value.share_text
  try {
    if (navigator.share) { await navigator.share({ text, url: link.value }); return }
    await navigator.clipboard.writeText(`${text}\n${link.value}`)
    flash('Copied to clipboard')
  } catch (e: any) {
    if (e?.name !== 'AbortError') flash('Could not share')
  }
}

async function copyLink() {
  try { await navigator.clipboard.writeText(link.value); flash('Link copied') } catch { flash('Could not copy') }
}
</script>

<template>
  <div class="screen open" role="dialog" aria-label="Share your session">
    <div class="screen-inner">
      <div class="progress-row">
        <span>Your session</span>
        <button class="small-btn" @click="emit('close')">Close</button>
      </div>

      <div v-if="error" class="result-note">{{ error }}</div>
      <div v-else-if="!recap" class="result-note">Loading…</div>

      <template v-else>
        <div class="share-card">
          <div class="eyebrow">Pitch Legends · {{ recap.day }}</div>
          <h1 class="share-title">{{ recap.outcome_text }}</h1>
          <div class="stats">
            <div class="stat-card"><div class="stat-num">{{ fmt(recap.points) }}</div><div class="stat-cap">points</div></div>
            <div class="stat-card"><div class="stat-num">{{ recap.streaks_won }}</div><div class="stat-cap">{{ recap.streaks_won === 1 ? 'streak' : 'streaks' }}</div></div>
            <div class="stat-card"><div class="stat-num">{{ recap.rank ? `#${recap.rank}` : '—' }}</div><div class="stat-cap">{{ recap.rank ? `of ${recap.players} today` : 'on the board' }}</div></div>
          </div>
          <div class="share-grid">
            <div v-for="st in recap.streaks" :key="st.no" class="share-row">
              <span class="share-lbl">{{ st.compulsory ? 'Final' : `Streak ${st.no}` }}<small>x{{ st.multiplier }}</small></span>
              <span class="share-cells"><i v-for="(c, i) in st.cells" :key="i" :class="c" /></span>
            </div>
          </div>
          <div v-if="recap.penalty" class="share-penalty">Final streak lost: -{{ fmt(recap.penalty) }} pts</div>
          <div class="fine">Green solved · yellow with a hint · red missed. The words stay secret.</div>
        </div>

        <button class="primary" @click="share">{{ label }}</button>
        <button class="ghost outline" @click="copyLink">Copy link</button>
      </template>
    </div>
  </div>
</template>
