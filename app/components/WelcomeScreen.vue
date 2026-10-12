<script setup lang="ts">
defineProps<{ error: string; canCancel: boolean }>()
const emit = defineEmits<{ login: [phone: string]; cancel: [] }>()

const phone = ref('')
const submit = () => emit('login', phone.value)
</script>

<template>
  <div class="screen open">
    <div class="screen-inner welcome">
      <div class="welcome-top">
        <div class="logo" aria-hidden="true"><span class="lt">P</span><span class="lt gap" /><span class="lt">T</span><span class="lt">C</span><span class="lt">H</span></div>
        <div>
          <h1 class="h1">Fill the gaps.<br>Name the legend.</h1>
          <p class="lede">Five right in a row makes a streak. Play two to start, more for bigger points and a higher place on today's leaderboard. Names from football, film, music, TV and games, each with letters missing. No clues, just what you remember.</p>
        </div>
      </div>
      <form class="welcome-form" @submit.prevent="submit">
        <label for="phone-input" class="label">Your phone number</label>
        <input id="phone-input" v-model="phone" class="field" type="tel" inputmode="tel" autocomplete="tel" placeholder="0801 234 5678">
        <div class="fine">We save your score and streak to this number. A word you play won't come back for 30 days.</div>
        <div class="error" role="alert">{{ error }}</div>
        <button class="primary" type="submit">Start playing</button>
        <button v-if="canCancel" class="ghost" type="button" @click="emit('cancel')">Cancel</button>
      </form>
    </div>
  </div>
</template>
