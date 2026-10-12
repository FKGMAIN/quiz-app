<script setup lang="ts">
import type { ResultView } from '~/composables/useGame'

const props = defineProps<{
  result: ResultView
  nextAction: () => unknown
  shareAction: () => Promise<'shared' | 'copied' | 'failed'>
  openShare?: () => unknown
}>()

const shareLabel = ref('Share result')
async function share() {
  if (props.result.ended && props.openShare) return props.openShare()
  const outcome = await props.shareAction()
  if (outcome === 'shared') return
  shareLabel.value = outcome === 'copied' ? 'Copied to clipboard' : 'Could not share'
  setTimeout(() => { shareLabel.value = 'Share result' }, 1800)
}

// Word split over lines the way the old screen did (one word per line).
const lines = computed(() => props.result.word.split(' '))
</script>

<template>
  <div class="screen open">
    <div class="screen-inner">
      <div class="progress-row"><span>{{ result.label }}</span><span class="r-state" :class="{ bad: !result.ok }">{{ result.state }}</span></div>
      <SegmentBar :states="result.pips" />
      <div class="result-body">
        <div class="result-icon" :class="{ bad: !result.ok }">
          <svg v-if="result.won" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8" /></svg>
          <svg v-else-if="result.ok" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          <svg v-else width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </div>
        <div>
          <div class="eyebrow" :class="{ bad: !result.ok }">{{ result.eyebrow }}</div>
          <h1 v-if="result.word" class="result-word">
            <template v-for="(part, i) in lines" :key="i">{{ part }}<br v-if="i < lines.length - 1"></template>
          </h1>
        </div>
        <div class="stats">
          <div class="stat-card"><div class="stat-num">{{ result.points }}</div><div class="stat-cap">{{ result.pointsCap }}</div></div>
          <div class="stat-card"><div class="stat-num">{{ result.time }}</div><div class="stat-cap">{{ result.timeCap }}</div></div>
          <div class="stat-card"><div class="stat-num">{{ result.streak }}</div><div class="stat-cap">{{ result.streakCap }}</div></div>
        </div>
        <div class="result-note">{{ result.note }}</div>
      </div>
      <button class="primary" @click="nextAction()">{{ result.nextLabel }}</button>
      <button class="ghost outline" @click="share">{{ shareLabel }}</button>
    </div>
  </div>
</template>
