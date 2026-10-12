<script setup lang="ts">
defineProps<{ streakLabel: string; multiplier: string; timerText: string; timerLow: boolean }>()
defineEmits<{ leaderboard: []; settings: [] }>()
</script>

<template>
  <header class="top">
    <div class="chip">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accentText)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" /></svg>
      <span>{{ streakLabel }} · {{ multiplier }}</span>
    </div>
    <div class="spacer" />
    <div class="chip" :class="{ low: timerLow }">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>
      <span>{{ timerText }}</span>
    </div>
    <button class="icon-btn" aria-label="Leaderboard" @click="$emit('leaderboard')">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8" /></svg>
    </button>
    <button class="icon-btn" aria-label="Settings" @click="$emit('settings')">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
    </button>
  </header>
</template>
