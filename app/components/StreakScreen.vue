<script setup lang="ts">
import type { StreakPrompt } from '~/composables/useGame'

defineProps<{ prompt: StreakPrompt; busy: boolean; error: string }>()
defineEmits<{ continue: []; bank: [] }>()
</script>

<template>
  <div class="screen open">
    <div class="screen-inner">
      <div class="result-body">
        <div class="result-icon" :class="{ bad: prompt.mode === 'final' }">
          <svg v-if="prompt.mode === 'final'" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9 16H3L12 3zM12 10v4M12 17h.01" /></svg>
          <svg v-else width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" /></svg>
        </div>

        <template v-if="prompt.mode === 'decision'">
          <div>
            <div class="eyebrow">Streak {{ prompt.completed }} complete</div>
            <h1 class="result-word">Bank it or play on?</h1>
          </div>
          <div class="stats">
            <div class="stat-card"><div class="stat-num">{{ prompt.points.toLocaleString() }}</div><div class="stat-cap">points so far</div></div>
            <div class="stat-card"><div class="stat-num">x{{ prompt.multiplier }}</div><div class="stat-cap">streak {{ prompt.nextStreak }} pays</div></div>
          </div>
          <div class="result-note">
            More streaks mean more points and a higher place on today's leaderboard.
            <template v-if="prompt.penalty !== null"> Win streak {{ prompt.nextStreak }} and a final streak follows that you must win: lose it and {{ prompt.penalty.toLocaleString() }} points come off.</template>
            A miss ends the session; points you have earned stay.
          </div>
        </template>

        <template v-else>
          <div>
            <div class="eyebrow bad">Final streak</div>
            <h1 class="result-word">Win it, or pay.</h1>
          </div>
          <div class="stats">
            <div class="stat-card"><div class="stat-num">x{{ prompt.multiplier }}</div><div class="stat-cap">points</div></div>
            <div class="stat-card"><div class="stat-num">-{{ (prompt.penalty ?? 0).toLocaleString() }}</div><div class="stat-cap">if you miss</div></div>
          </div>
          <div class="result-note">You won every streak, so one more is compulsory. Get all of it right to finish the session. Miss and the points above come off your total.</div>
        </template>
        <div class="error" role="alert">{{ error }}</div>
      </div>

      <button class="primary" :disabled="busy" @click="$emit('continue')">
        {{ prompt.mode === 'final' ? 'Start the final streak' : `Play streak ${prompt.nextStreak}` }}
      </button>
      <button v-if="prompt.mode === 'decision'" class="ghost outline" :disabled="busy" @click="$emit('bank')">
        Bank {{ prompt.points.toLocaleString() }} points
      </button>
    </div>
  </div>
</template>
