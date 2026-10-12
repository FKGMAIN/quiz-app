import type { AnswerResponse, PuzzleResponse, SessionSummary, SessionView } from '~/types/api'

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

/** What the between-streaks screen shows. */
export interface StreakPrompt {
  mode: 'decision' | 'final'
  completed: number          // streak number just won
  nextStreak: number
  multiplier: number
  points: number             // session points so far
  penalty: number | null     // cost of failing the compulsory streak
}

const DEFAULT_SESSION: SessionView = {
  id: '', status: 'active', phase: 'playing', streak_no: 1, in_streak: 0, streaks_won: 0, questions_per_streak: 5,
  entitled_streaks: 2, max_streaks: 3, compulsory: false, multiplier: 1, correct: 0, points: 0, words: 0, expires_at: '',
  decision: null, penalty_if_failed: null
}

/**
 * Game state and actions. The server owns the truth (answer, clock, points, streak counters);
 * this composable only keeps what is on screen and sends the player's letters.
 */
export function useGame() {
  const api = useApi()
  const settings = useSettings()
  const sound = useSound()

  // ---- player ----
  const score = ref(0)
  const wins = ref(0)
  const session = ref<SessionView>({ ...DEFAULT_SESSION })

  // ---- current word ----
  const playId = ref(0)
  const difficulty = ref(1)
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
  const leaderboardOpen = ref(false)
  const resultOpen = ref(false)
  const streakOpen = ref(false)
  const loginError = ref('')
  const canCancelLogin = ref(false)
  const result = ref<ResultView | null>(null)
  const prompt = ref<StreakPrompt | null>(null)
  const pendingPrompt = ref<StreakPrompt | null>(null)   // shown after the result screen is dismissed
  const busy = ref(false)
  const promptError = ref('')
  const lastShare = ref('')
  const shareSessionId = ref('')      // finished session the share screen shows
  const shareOpen = ref(false)

  // ---- timer ----
  const remaining = ref(0)
  let timerHandle: ReturnType<typeof setInterval> | null = null
  const timerRunning = ref(false)

  const phone = settings.phone

  // ---------- derived ----------
  const perStreak = computed(() => session.value.questions_per_streak)
  const filled = computed(() => gaps.value.length > 0 && gaps.value.every(g => g.value))
  const emptyCount = computed(() => gaps.value.filter(g => !g.value).length)
  const nextEmpty = computed(() => gaps.value.find(g => !g.value)?.idx ?? -1)
  const canCheck = computed(() => !locked.value && filled.value)
  const canReveal = computed(() => !locked.value && hintsLeft.value > 0 && emptyCount.value > 0)
  const canUndo = computed(() => !locked.value && gaps.value.some(g => g.value && !g.revealed))
  const streakLabel = computed(() => {
    const s = session.value
    return s.compulsory ? 'Final streak' : `Streak ${s.streak_no}`
  })
  const roundLabel = computed(() => {
    const s = session.value
    const level = hasPuzzle.value ? ` · ${LEVELS[Math.min(difficulty.value, 4) - 1]}` : ''
    return `${s.compulsory ? 'Final streak, must win' : `Streak ${s.streak_no} of ${s.max_streaks}`}${level}`
  })
  const segments = computed(() =>
    Array.from({ length: perStreak.value }, (_, i) => (i < session.value.in_streak ? 'ok' : i === session.value.in_streak ? 'now' : '')))
  const multiplierText = computed(() => `x${session.value.multiplier} pts`)
  const status = computed(() => {
    if (message.value) return message.value
    if (locked.value || !hasPuzzle.value) return ''
    return filled.value ? 'Ready to check' : `${emptyCount.value} ${emptyCount.value === 1 ? 'letter' : 'letters'} to go`
  })
  const timerText = computed(() => {
    if (!settings.timer.value) return 'No timer'
    const s = timerRunning.value ? remaining.value : settings.timer.value
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  })
  const timerLow = computed(() => !!settings.timer.value && timerRunning.value && remaining.value <= 10)

  function setStatus(text: string, kind: '' | 'good' | 'bad' = '') {
    message.value = text
    statusKind.value = kind
  }

  const EXPIRED = 'Your last session expired after 24 hours, so we started a fresh one.'

  // ---------- session ----------
  async function login(raw: string, silent = false) {
    loginError.value = ''
    if (!raw || !raw.trim()) { loginError.value = 'Enter your phone number.'; return }
    try {
      const d = await api.session(raw)
      settings.setPhone(d.phone_number)
      score.value = d.score
      wins.value = d.wins
      session.value = d.session
      if (d.session_expired) notice.value = EXPIRED
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
      const d = await api.next(phone.value)
      if (d.between) {
        // A refresh while choosing between streaks lands here.
        session.value = d.session
        hasPuzzle.value = false
        openPrompt(promptFrom(d.session, 'decision'))
        return
      }
      load(d)
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 404) showEmpty('All caught up', e.message)
      else showEmpty('Offline', e?.message || 'Could not reach the server. Check your connection and refresh.')
    }
  }

  function showEmpty(title: string, text: string) {
    hasPuzzle.value = false
    layout.value = []
    gaps.value = []
    keys.value = []
    emptyNote.value = { title, message: text }
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
    difficulty.value = p.difficulty
    session.value = p.session
    active.value = 0
    hintsLeft.value = 1
    wordState.value = ''
    emptyNote.value = null
    hasPuzzle.value = true
    locked.value = false
    if (p.hint) applyHint(p.hint.gap, p.hint.letter)          // a refresh keeps an already-used hint
    if (p.session_expired) notice.value = EXPIRED
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
        sound.play('playCorrect', session.value.in_streak + 1)
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
      // The session expired while the word was open: start over from the server's state.
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
  const fmt = (n: number) => n.toLocaleString()

  function promptFrom(s: SessionView, mode: 'decision' | 'final'): StreakPrompt {
    return mode === 'decision'
      ? { mode, completed: s.streak_no, nextStreak: s.decision?.next_streak ?? s.streak_no + 1, multiplier: s.decision?.multiplier ?? s.multiplier, points: s.points, penalty: s.penalty_if_failed }
      : { mode, completed: s.streak_no - 1, nextStreak: s.streak_no, multiplier: s.multiplier, points: s.points, penalty: s.penalty_if_failed }
  }

  function showResult(d: AnswerResponse, label?: string) {
    const ok = d.correct
    const ended = !!d.session_ended
    const flow = d.flow || null
    const before = session.value                              // state before this answer
    const prev = before.in_streak                             // position of this word within its streak
    const streakNo = before.streak_no
    const per = before.questions_per_streak
    const pts = d.points_awarded || 0
    if (typeof d.score === 'number') score.value = d.score
    if (typeof d.wins === 'number') wins.value = d.wins
    session.value = d.session
    if (ended) shareSessionId.value = d.session.id

    const pips = ok
      ? Array.from({ length: per }, (_, i) => (i <= prev ? 'ok' : ''))
      : Array.from({ length: per }, (_, i) => (i < prev ? 'ok' : i === prev ? 'miss' : ''))

    const total: SessionSummary = d.summary || { outcome: '', streaks: d.session.streaks_won, correct: d.session.correct, points: d.session.points, words: d.session.words, penalty: 0 }
    const won = !!d.won
    let note: string
    if (won) note = `Session complete: all ${d.session.max_streaks + 1} streaks won, ${fmt(total.points)} points. You have ${wins.value} ${wins.value === 1 ? 'win' : 'wins'}.`
    else if (!ok) {
      note = `Session over: ${fmt(total.points)} points from ${total.streaks} ${total.streaks === 1 ? 'streak' : 'streaks'}.`
      if (d.penalty) note += ` The final streak was lost, so ${fmt(d.penalty)} points were taken off.`
      note += ' A new session starts at Streak 1. This word comes back after 30 days.'
    } else if (flow === 'decision') note = `Streak ${streakNo} complete. Bank ${fmt(d.session.points)} points, or play on for x${d.session.decision?.multiplier ?? ''} points.`
    else if (flow === 'final') note = `All ${before.max_streaks} streaks won. The final streak is compulsory: win it, or lose ${fmt(d.session.penalty_if_failed || 0)} points.`
    else if (flow === 'next') note = `Streak ${streakNo} complete. Streak ${streakNo + 1} pays x${d.session.multiplier} points.`
    else note = `${d.hint_used ? 'You used a hint, so this one earned fewer points. ' : ''}${per - (prev + 1)} to go in this streak.`

    const streakDone = ok && !!flow
    result.value = {
      ok, won, ended,
      label: `${before.compulsory ? 'Final streak' : `Streak ${streakNo}`} · Question ${prev + 1} of ${per}`,
      state: won ? 'Winner' : ok ? (streakDone ? 'Streak won' : 'Solved') : (label || 'Missed'),
      eyebrow: won ? 'You won' : streakDone ? `Streak ${streakNo} complete` : ok ? 'Correct' : (label || 'Missed'),
      word: (d.word || '').toUpperCase(),
      points: ended ? fmt(total.points) : `+${fmt(pts)}`,
      pointsCap: ended ? 'session points' : 'points',
      time: ended ? String(total.words) : `${d.time_spent || 0}s`,
      timeCap: ended ? 'words played' : 'solve time',
      streak: ended ? String(total.streaks) : String(d.session.streaks_won),
      streakCap: ended || d.session.streaks_won !== 1 ? 'streaks won' : 'streak won',
      note,
      nextLabel: ended ? (won ? 'Play again' : 'Start a new session') : flow === 'decision' || flow === 'final' ? 'Continue' : flow === 'next' ? 'Next streak' : 'Next word',
      pips
    }
    pendingPrompt.value = ok && (flow === 'decision' || flow === 'final') ? promptFrom(d.session, flow) : null
    lastShare.value = ended
      ? `Pitch Legends: ${fmt(total.points)} pts and ${total.streaks} ${total.streaks === 1 ? 'streak' : 'streaks'} today${won ? ', including the final one' : ''}.`
      : `Pitch Legends: ${fmt(score.value)} pts, ${wins.value} ${wins.value === 1 ? 'win' : 'wins'}.`
    resultOpen.value = true
  }

  function openPrompt(p: StreakPrompt) {
    prompt.value = p
    promptError.value = ''
    streakOpen.value = true
  }

  function nextFromResult() {
    resultOpen.value = false
    result.value = null
    if (pendingPrompt.value) {
      const p = pendingPrompt.value
      pendingPrompt.value = null
      openPrompt(p)
      return
    }
    return next()
  }

  // ---------- between streaks ----------
  async function continuePlaying() {
    if (busy.value) return
    // The compulsory streak has already started on the server; only a normal decision needs a call.
    if (prompt.value?.mode === 'decision') {
      busy.value = true
      try {
        session.value = (await api.choose(phone.value, 'continue')).session
      } catch (e: any) {
        busy.value = false
        promptError.value = e?.message || 'Could not continue. Try again.'
        return
      }
      busy.value = false
    }
    streakOpen.value = false
    prompt.value = null
    await next()
  }

  async function bankPoints() {
    if (busy.value) return
    busy.value = true
    try {
      const d = await api.choose(phone.value, 'stop')
      streakOpen.value = false
      prompt.value = null
      const s = d.summary!
      session.value = d.session
      shareSessionId.value = d.session.id
      result.value = {
        ok: true, won: false, ended: true,
        label: `${s.streaks} ${s.streaks === 1 ? 'streak' : 'streaks'} banked`,
        state: 'Banked', eyebrow: 'Points banked', word: '',
        points: fmt(s.points), pointsCap: 'session points',
        time: String(s.words), timeCap: 'words played',
        streak: String(s.streaks), streakCap: 'streaks won',
        note: `You banked ${fmt(s.points)} points from ${s.streaks} streaks. A new session starts at Streak 1.`,
        nextLabel: 'Start a new session',
        pips: Array.from({ length: session.value.questions_per_streak }, () => 'ok')
      }
      lastShare.value = `Pitch Legends: ${fmt(s.points)} pts and ${s.streaks} streaks today.`
      resultOpen.value = true
    } catch (e: any) {
      promptError.value = e?.message || 'Could not bank your points. Try again.'
    } finally {
      busy.value = false
    }
  }

  function openShare(id = shareSessionId.value) {
    if (!id) return
    shareSessionId.value = id
    shareOpen.value = true
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
    if (welcomeOpen.value || settingsOpen.value || shareOpen.value || leaderboardOpen.value || resultOpen.value || streakOpen.value || !hasPuzzle.value || locked.value) return
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
    score, wins, session, hasPuzzle, layout, gaps, keys, active, locked, hintsLeft, wordState,
    status, statusKind, emptyNote, welcomeOpen, settingsOpen, leaderboardOpen, shareOpen, shareSessionId, resultOpen, streakOpen, loginError, canCancelLogin,
    result, prompt, busy, promptError,
    // derived
    filled, nextEmpty, canCheck, canReveal, canUndo, streakLabel, roundLabel, segments, multiplierText, timerText, timerLow,
    // actions
    login, switchPhone, place, clearGap, focusGap, undo, reveal, check, skip, nextFromResult, continuePlaying, bankPoints, share, openShare, changeTimer
  }
}
