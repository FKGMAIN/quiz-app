<script setup lang="ts">
// Four bars showing progress through a run. Each state is '', 'ok', 'now' or 'miss'.
defineProps<{ states: string[] }>()
</script>

<template>
  <div class="segments">
    <div v-for="(s, i) in states" :key="i" class="seg-bar" :class="s" />
  </div>
</template>
