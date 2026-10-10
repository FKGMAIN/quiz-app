<script setup lang="ts">
import type { Cell, Gap } from '~/composables/useGame'

const props = defineProps<{
  layout: Cell[][]
  gaps: Gap[]
  nextEmpty: number
  state: '' | 'correct' | 'wrong'
  emptyNote: { title: string; message: string } | null
}>()
const emit = defineEmits<{ clear: [idx: number]; focus: [idx: number] }>()

// Tiles shrink to fit the longest word on narrow phones.
const width = ref(480)
const onResize = () => { width.value = window.innerWidth }
onMounted(() => { onResize(); window.addEventListener('resize', onResize) })
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

const tile = computed(() => {
  const longest = Math.max(1, ...props.layout.map(w => w.length))
  const avail = Math.min(width.value, 480) - 40
  return Math.max(26, Math.min(42, Math.floor((avail - (longest - 1) * 6) / longest)))
})

const gapOf = (idx: number) => props.gaps[idx]
</script>

<template>
  <div class="word" :class="state" :style="{ '--tile': tile + 'px' }" aria-live="polite">
    <div v-if="emptyNote" class="empty-note">
      <strong>{{ emptyNote.title }}</strong>{{ emptyNote.message }}
    </div>
    <div v-for="(word, w) in layout" :key="w" class="segment">
      <template v-for="(cell, c) in word" :key="c">
        <div v-if="cell.kind === 'fixed'" class="tile">{{ cell.ch }}</div>
        <template v-else>
          <div v-if="gapOf(cell.idx)?.revealed" class="tile revealed" :aria-label="`Revealed letter ${gapOf(cell.idx)?.value}`">
            {{ gapOf(cell.idx)?.value }}
          </div>
          <button
            v-else-if="gapOf(cell.idx)?.value"
            type="button"
            class="tile filled"
            :aria-label="`Letter ${gapOf(cell.idx)?.value}, tap to remove`"
            @click="emit('clear', cell.idx)"
          >{{ gapOf(cell.idx)?.value }}</button>
          <button
            v-else
            type="button"
            class="tile gap"
            :class="{ next: nextEmpty === cell.idx }"
            :aria-label="`Empty gap ${cell.idx + 1}`"
            @click="emit('focus', cell.idx)"
          >&nbsp;</button>
        </template>
      </template>
    </div>
  </div>
</template>
