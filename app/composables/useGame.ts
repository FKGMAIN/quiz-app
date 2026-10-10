import type { AnswerResponse, PuzzleResponse } from '~/types/api'

export const RUN_LEN = 4
export const LEVELS = ['Easy', 'Medium', 'Hard', 'Expert']

export interface Gap { idx: number; value: string | null; keyId: number | null; revealed: boolean }
export interface Key { id: number; char: string; used: boolean }
export type Cell = { kind: 'fixed'; ch: string } | { kind: 'gap'; idx: number }

export interface ResultView {
  ok: boolean
  won: boolean
  ended: boolean
  label: string
  state: string
  eyebrow: string
  word: string
  points: string
  pointsCap: string
  time: string
  timeCap: string
  streak: string
  streakCap: string
  note: string
  nextLabel: string
  pips: string[]
}

/**
 * Game state and actions. The server owns the truth (answer, clock, points, run counter);
 * this composable only keeps what is on screen and sends the player's letters.
 */
export function useGame() {
  const api = useApi()
  const settings = useSettings()
  const sound = useSound()

  // ---- player ----
  const score = ref(0)
  const wins = ref(0)
  const run = ref(0)                         // words solved in the current run, 0..3; level = run + 1
  const runPoints = ref(0)

  // ---- current word ----
  const playId = ref(0)
  const hasPuzzle = ref(false)
  const layout = shallowRef<Cell[][]>([])
  const gaps = ref<Gap[]>([])
  const keys = ref<Key[]>([])
  const active = ref(0)
  const locked = ref(true)
  const hintsLeft = ref(1)
  const wordState = ref<'' | 'correct' | 'wrong'>('')
  const message = ref('')                     // explicit message ('Nice one!', errors); empty = show the default line
  const statusKind = ref<'' | 'good' | 'bad'>('')
  const emptyNote = ref<{ title: string; message: string } | null>(null)
  const notice = ref('')

  // ---- screens ----
  const welcomeOpen = ref(false)
  const settingsOpen = ref(false)
  const resultOpen = ref(false)
  const loginError = ref('')
  const canCancelLogin = ref(false)
  const result = ref<ResultView | null>(null)
  const lastShare = ref('')

  // ---- timer ----
  const remaining = ref(0)
  let timerHandle: ReturnType<typeof setInterval> | null = null
  const timerRunning = ref(false)

  const phone = settings.phone

  // ---------- derived ----------
  const filled = computed(() => gaps.value.length > 0 && gaps.value.every(g => g.value))
  const emptyCount = computed(() => gaps.value.filter(g => !g.value).length)
  const nextEmpty = computed(() => gaps.value.find(g => !g.value)?.idx ?? -1)
  const canCheck = computed(() => !locked.value && filled.value)
  const canReveal = computed(() => !locked.value && hintsLeft.value > 0 && emptyCount.value > 0)
  const canUndo = computed(() => !locked.value && gaps.value.some(g => g.value && !g.revealed))
  const roundLabel = computed(() => `Streak ${run.value} of ${RUN_LEN} · ${LEVELS[Math.min(run.value, 3)]}`)
  const segments = computed(() => Array.from({ length: RUN_LEN }, (_, i) => (i < run.value ? 'ok' : i === run.value ? 'now' : '')))
  const timerText = computed(() => {
    if (!settings.timer.value) return 'No timer'
    const s = timerRunning.value ? remaining.value : settings.timer.value
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  })
  const timerLow = computed(() => !!settings.timer.value && timerRunning.value && remaining.value <= 10)

  const status = computed(() => {
    if (message.value) return message.value
    if (locked.value || !hasPuzzle.value) return ''
    return filled.value ? 'Ready to check' : `${emptyCount.value} ${emptyCount.value === 1 ? 'letter' : 'letters'} to go`
  })

  function setStatus(text: string, kind: '' | 'good' | 'bad' = '') {
    message.value = text
    statusKind.value = kind
  }

  // ---------- session ----------
  async function login(raw: string, silent = false) {
    loginError.value = ''
    if (!raw || !raw.trim()) { loginError.value = 'Enter your phone number.'; return }
    try {
      const d = await api.session(raw)
      settings.setPhone(d.phone_number)
      score.value = d.score
      wins.value = d.wins
      run.value = Math.min(RUN_LEN - 1, d.session.correct)
      runPoints.value = d.session.points
      if (d.session_expired) notice.value = 'Your last session expired after 24 hours, so we started a fresh one.'
      welcomeOpen.value = false
      canCancelLogin.value = false
      await next()
    } catch (e: any) {
      if (silent && e instanceof ApiError && e.status === 0) {
        showEmpty('Offline', 'Could not reach the server. Check your connection and refresh.')
        return
      }
      loginError.value = e?.message || 'Could not sign in.'
      welcomeOpen.value = true
    }
  }

  function switchPhone() {
    settingsOpen.value = false
    loginError.value = ''
    canCancelLogin.value = true
    welcomeOpen.value = true
  }

  // ---------- puzzle ----------
  async function next() {
    stopTimer()
    locked.value = true
    try {
      load(await api.next(phone.value))
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 404) showEmpty('All caught up', e.message)
      else showEmpty('Offline', e?.message || 'Could not reach the server. Check your connection and refresh.')
    }
  }

  function showEmpty(title: string, message: string) {
    hasPuzzle.value = false
    layout.value = []
    gaps.value = []
    keys.value = []
    emptyNote.value = { title, message }
    setStatus('')
    stopTimer()
  }

  function load(p: PuzzleResponse) {
    // The pattern is the word with "_" for each hidden letter; spaces separate words.
    let g = 0
    layout.value = p.pattern.split(' ').map(word =>
      word.split('').map<Cell>(ch => (ch === '_' ? { kind: 'gap', idx: g++ } : { kind: 'fixed', ch }))
    )
    gaps.value = Array.from({ length: g }, (_, idx) => ({ idx, value: null, keyId: null, revealed: false }))
    keys.value = p.tiles.map((char, id) => ({ id, char: char.toUpperCase(), used: false }))
    playId.value = p.play_id
    run.value = Math.min(RUN_LEN - 1, p.session.correct)
    runPoints.value = p.session.points
    active.value = 0
    hintsLeft.value = 1
    wordState.value = ''
    emptyNote.value = null
    hasPuzzle.value = true
    locked.value = false
    if (p.hint) applyHint(p.hint.gap, p.hint.letter)          // a refresh keeps an already-used hint
    if (p.session_expired) notice.value = 'Your last session expired after 24 hours, so we started a fresh one.'
    setStatus(notice.value)
    notice.value = ''
    startTimer(p.elapsed_ms)
  }

  function applyHint(gapIdx: number, letter: string) {
    const gap = gaps.value[gapIdx]
    if (!gap) return
    const key = keys.value.find(k => k.char === letter && !k.used)
    gap.value = letter
    gap.revealed = true
    gap.keyId = key ? key.id : null
    if (key) key.used = true
    hintsLeft.value = 0
  }

  // ---------- input ----------
  function place(keyId: number) {
    if (locked.value) return
    const key = keys.value.find(k => k.id === keyId)
    if (!key || key.used) return
    let gap: Gap | undefined = gaps.value[active.value]
    if (!gap || gap.value) gap = gaps.value.find(x => !x.value)
    if (!gap) return
    gap.value = key.char
    gap.keyId = key.id
    key.used = true
    active.value = gaps.value.find(x => !x.value)?.idx ?? gap.idx
    sound.play('playSlot')
    sound.buzz(10)
    wordState.value = ''
    setStatus('')
  }

  function clearGap(idx: number) {
    if (locked.value) return
    const gap = gaps.value.find(x => x.idx === idx)
    if (!gap || !gap.value || gap.revealed) return
    const key = keys.value.find(k => k.id === gap.keyId)
    if (key) key.used = false
    gap.value = null
    gap.keyId = null
    active.value = gap.idx
    sound.play('playUnslot')
    setStatus('')
  }

  function focusGap(idx: number) {
    active.value = idx
  }

  function undo() {
    const last = [...gaps.value].reverse().find(x => x.value && !x.revealed)
    if (last) clearGap(last.idx)
  }

  async function reveal() {
    if (!canReveal.value) return
    const gap = gaps.value.find(x => !x.value)
    if (!gap) return
    try {
      const h = await api.hint(phone.value, playId.value, gap.idx)
      applyHint(h.gap, h.letter)
      sound.play('playSlot')
      sound.buzz(15)
      setStatus('')
    } catch (e: any) {
      setStatus(e?.message || 'Could not get a hint.', 'bad')
    }
  }

  // ---------- answers ----------
  async function check() {
    if (!canCheck.value) return
    locked.value = true
    try {
      const d = await api.answer(phone.value, playId.value, 'submit', gaps.value.map(x => x.value || ''))
      if (d.correct) {
        stopTimer()
        wordState.value = 'correct'
        setStatus('Nice one!', 'good')
        sound.play('playCorrect', run.value + 1)
        sound.buzz([20, 40, 20])
        setTimeout(() => showResult(d), 650)
        return
      }
      sound.play('playWrong')
      sound.buzz(80)
      wordState.value = ''
      await nextTick()
      wordState.value = 'wrong'
      if (d.finished) {
        stopTimer()
        setStatus('Out of tries', 'bad')
        setTimeout(() => showResult(d, 'Out of tries'), 650)
        return
      }
      locked.value = false
      setStatus('Not quite. One try left. Tap a letter to swap it.', 'bad')
    } catch (e: any) {
      await handleAnswerError(e)
    }
  }

  async function skip() {
    if (locked.value || !hasPuzzle.value) return
    locked.value = true
    stopTimer()
    try {
      showResult(await api.answer(phone.value, playId.value, 'skip'), 'Skipped')
    } catch (e: any) {
      await handleAnswerError(e)
    }
  }

  async function timeUp() {
    if (locked.value) return
    locked.value = true
    sound.play('playWhistle', false)
    sound.buzz([60, 60, 60])
    try {
      showResult(await api.answer(phone.value, playId.value, 'timeout'), "Time's up")
    } catch (e: any) {
      await handleAnswerError(e)
    }
  }

  async function handleAnswerError(e: any) {
    if (e instanceof ApiError && e.status === 410) {
      // The run expired while the word was open: start over from the server's state.
      notice.value = e.message
      await login(phone.value, true)
      return
    }
    if (e instanceof ApiError && e.status === 409) {
      await next()
      return
    }
    locked.value = false
    resumeTimer()
    setStatus(e?.message || 'Could not reach the server. Try again.', 'bad')
  }

  // ---------- result screen ----------
  function showResult(d: AnswerResponse, label?: string) {
    const ok = d.correct
    const won = !!d.won
    const ended = !!d.session_ended
    const prev = run.value
    const pts = d.points_awarded || 0
    if (typeof d.score === 'number') score.value = d.score
    if (typeof d.wins === 'number') wins.value = d.wins

    const pips = won ? ['ok', 'ok', 'ok', 'ok']
      : ok ? Array.from({ length: RUN_LEN }, (_, i) => (i <= prev ? 'ok' : ''))
      : Array.from({ length: RUN_LEN }, (_, i) => (i < prev ? 'ok' : i === prev ? 'miss' : ''))

    // Move to the next run state.
    run.value = ended ? 0 : Math.min(RUN_LEN - 1, d.session ? d.session.correct : prev + 1)
    runPoints.value = ended ? 0 : d.session ? d.session.points : runPoints.value

    const total = d.summary || { outcome: '', streak: prev, points: runPoints.value, words: prev + 1 }
    const hint = d.hint_used
    let note: string
    if (won) note = `Session complete. Four in a row, ${total.points.toLocaleString()} points in ${total.words} words. You have ${wins.value} ${wins.value === 1 ? 'win' : 'wins'}.`
    else if (ok) note = `${hint ? 'You used a hint, so this one earned fewer points. ' : ''}Next up: ${LEVELS[run.value]} level.`
    else note = `Session over: ${total.points.toLocaleString()} points, a streak of ${total.streak}. A new session starts at Easy. This word comes back after 30 days.`

    result.value = {
      ok, won, ended,
      label: won ? 'Four in a row' : `Streak ${ok ? prev + 1 : prev} of ${RUN_LEN} · ${LEVELS[Math.min(prev, 3)]}`,
      state: won ? 'Winner' : ok ? 'Solved' : (label || 'Missed'),
      eyebrow: won ? 'You won' : ok ? 'Correct' : (label || 'Missed'),
      word: (d.word || '').toUpperCase(),
      points: ended ? total.points.toLocaleString() : `+${pts}`,
      pointsCap: ended ? 'session points' : 'points',
      time: ended ? String(total.words) : `${d.time_spent || 0}s`,
      timeCap: ended ? 'words played' : 'solve time',
      streak: String(ended ? total.streak : prev + 1),
      streakCap: ended ? 'total streak' : 'streak',
      note,
      nextLabel: won ? 'Play again' : ok ? 'Next word' : 'Start a new streak',
      pips
    }
    lastShare.value = won
      ? `Pitch Legends: I won a run, four in a row! ${total.points.toLocaleString()} pts, ${wins.value} ${wins.value === 1 ? 'win' : 'wins'}.`
      : `Pitch Legends: ${score.value.toLocaleString()} pts, ${wins.value} ${wins.value === 1 ? 'win' : 'wins'}.`
    resultOpen.value = true
  }

  function nextFromResult() {
    resultOpen.value = false
    result.value = null
    return next()
  }

  async function share(): Promise<'shared' | 'copied' | 'failed'> {
    const text = lastShare.value
    try {
      if (navigator.share) { await navigator.share({ text, url: location.origin }); return 'shared' }
      await navigator.clipboard.writeText(`${text} ${location.origin}`)
      return 'copied'
    } catch {
      return 'failed'
    }
  }

  // ---------- timer ----------
  // The server measures the real time; this clock is for display and for reporting a timeout.
  function startTimer(elapsedMs = 0) {
    stopTimer()
    const limit = settings.timer.value
    if (!limit) return
    remaining.value = Math.max(0, limit - Math.floor(elapsedMs / 1000))
    if (remaining.value <= 0) { timerRunning.value = true; timeUp(); return }
    resumeTimer()
  }

  // Continue ticking from the current value (used after a failed request stopped the clock).
  function resumeTimer() {
    if (timerHandle || !settings.timer.value || remaining.value <= 0 || !hasPuzzle.value) return
    timerRunning.value = true
    timerHandle = setInterval(() => {
      remaining.value--
      if (remaining.value <= 5 && remaining.value > 0) sound.play('playTick', true)
      if (remaining.value <= 0) { stopTimer(); timeUp() }
    }, 1000)
  }

  function stopTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null }
    timerRunning.value = false
  }

  function changeTimer(sec: number) {
    settings.setTimer(sec)
    if (hasPuzzle.value && !locked.value) startTimer(0)
  }

  // ---------- keyboard + lifecycle ----------
  function onKey(e: KeyboardEvent) {
    if (welcomeOpen.value || settingsOpen.value || resultOpen.value || !hasPuzzle.value || locked.value) return
    if (e.key === 'Backspace') return undo()
    if (e.key === 'Enter') return void check()
    const ch = e.key.length === 1 ? e.key.toUpperCase() : ''
    const k = keys.value.find(x => x.char === ch && !x.used)
    if (k) place(k.id)
  }

  onMounted(() => {
    window.addEventListener('keydown', onKey)
    if (phone.value) login(phone.value, true)
    else welcomeOpen.value = true
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey)
    stopTimer()
  })

  return {
    // state
    score, wins, run, runPoints, hasPuzzle, layout, gaps, keys, active, locked, hintsLeft, wordState,
    status, statusKind, emptyNote, welcomeOpen, settingsOpen, resultOpen, loginError, canCancelLogin, result,
    // derived
    filled, nextEmpty, canCheck, canReveal, canUndo, roundLabel, segments, timerText, timerLow,
    // actions
    login, switchPhone, place, clearGap, focusGap, undo, reveal, check, skip, nextFromResult, share, changeTimer
  }
}
