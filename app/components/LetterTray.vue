<script setup lang="ts">
import type { Key } from '~/composables/useGame'

defineProps<{ keys: Key[]; locked: boolean }>()
defineEmits<{ pick: [id: number] }>()
</script>

<template>
  <section class="tray" aria-label="Letters">
    <button v-for="k in keys" :key="k.id" type="button" class="key" :disabled="k.used || locked" @click="$emit('pick', k.id)">
      {{ k.char }}
    </button>
  </section>
</template>
