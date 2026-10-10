<script setup lang="ts">
// The whole game is one screen plus three overlays. All state lives in useGame().
const g = reactive(useGame())
</script>

<template>
  <main class="app" id="app">
    <GameHeader :streak="g.run + 1" :timer-text="g.timerText" :timer-low="g.timerLow" @settings="g.settingsOpen = true" />

    <div class="progress">
      <div class="progress-row"><span>{{ g.roundLabel }}</span><span>{{ g.score.toLocaleString() }} pts</span></div>
      <SegmentBar :states="g.segments" />
    </div>

    <section class="stage">
      <WordBoard
        :layout="g.layout"
        :gaps="g.gaps"
        :next-empty="g.nextEmpty"
        :state="g.wordState"
        :empty-note="g.emptyNote"
        @clear="g.clearGap"
        @focus="g.focusGap"
      />
      <div class="status" :class="g.statusKind" aria-live="polite">{{ g.status || ' ' }}</div>
    </section>

    <div class="helpers">
      <button class="helper-btn" :disabled="!g.canReveal" @click="g.reveal()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" /></svg>
        <span>Reveal a letter</span><span class="dim">· {{ g.hintsLeft }} left</span>
      </button>
      <button class="undo-btn" :disabled="!g.canUndo" aria-label="Remove last letter" @click="g.undo()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 5H9l-6 7 6 7h11z" /><path d="M14 9l4 6M18 9l-4 6" /></svg>
      </button>
    </div>

    <LetterTray :keys="g.keys" :locked="g.locked" @pick="g.place" />

    <button class="primary" :disabled="!g.canCheck" @click="g.check()">Check</button>
    <button class="ghost" :disabled="g.locked || !g.hasPuzzle" @click="g.skip()">Skip this word</button>
  </main>

  <ResultScreen v-if="g.resultOpen && g.result" :result="g.result" :next-action="g.nextFromResult" :share-action="g.share" />
  <WelcomeScreen
    v-if="g.welcomeOpen"
    :error="g.loginError"
    :can-cancel="g.canCancelLogin"
    @login="g.login($event)"
    @cancel="g.welcomeOpen = false"
  />
  <SettingsScreen v-if="g.settingsOpen" @close="g.settingsOpen = false" @switch="g.switchPhone()" @timer="g.changeTimer($event)" />
</template>
