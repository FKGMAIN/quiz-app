// Pitch Legends — masked-word game client.
// Server: POST /api/session, GET /api/puzzle/next, POST /api/puzzle/answer
// The server never repeats a word for 30 days after it was last played (served or answered).

const RUN_LEN = 4;                 // four correct in a row wins
const LEVELS = ['Easy', 'Medium', 'Hard', 'Expert'];

class MaskedWordGame {
  constructor() {
    this.sound = window.soundCtrl;
    this.$ = id => document.getElementById(id);

    this.phone = null;
    this.score = 0;
    this.streak = 1;
    this.maxTimer = 45;               // 0 = off
    this.remaining = 0;
    this.timer = null;
    this.startedAt = 0;

    this.puzzle = null;
    this.gaps = [];                   // { idx, charIdx, expected, value, keyId, revealed }
    this.keys = [];                   // { id, char, used }
    this.active = 0;
    this.locked = true;
    this.hintsLeft = 1;
    this.hintUsed = false;

    this.run = 0;                     // correct in a row (0..3). Level = run + 1
    this.wins = 0;
    this.attempts = 0;
    this.round = { points: 0 };       // points earned in the current run
    this.pips = [];                   // result-screen pips
    this.won = false;

    this.loadPrefs();
    this.bind();
    this.syncSettings();
    this.renderSegments();
    this.phone ? this.login(this.phone, true) : this.open('welcome-screen');
  }

  // ---------- small helpers ----------
  open(id) { this.$(id).classList.add('open'); }
  close(id) { this.$(id).classList.remove('open'); }
  shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  snd(name, ...args) { try { this.sound[name](...args); } catch (e) {} }
  buzz(p) { try { this.sound.vibrate(p); } catch (e) {} }
  store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  maskPhone(p) { return p && p.length > 8 ? `${p.slice(0, 4)} ••• ${p.slice(-4)}` : (p || '—'); }

  loadPrefs() {
    try {
      this.phone = localStorage.getItem('soccer_phone_number');
      const t = parseInt(localStorage.getItem('soccer_timer_sec'), 10);
      if (!isNaN(t)) this.maxTimer = t;
      if (localStorage.getItem('soccer_sound') === 'off') this.sound.soundEnabled = false;
      if (localStorage.getItem('soccer_haptics') === 'off') this.sound.hapticsEnabled = false;
    } catch (e) {}
  }

  bind() {
    this.$('primary-btn').onclick = () => this.check();
    this.$('skip-btn').onclick = () => this.skip();
    this.$('undo-btn').onclick = () => this.undo();
    this.$('reveal-btn').onclick = () => this.reveal();
    this.$('next-btn').onclick = () => this.nextFromResult();
    this.$('share-btn').onclick = () => this.share();
    this.$('settings-btn').onclick = () => { this.snd('playTap'); this.syncSettings(); this.open('settings-screen'); this.loadHistory(); };
    this.$('settings-close').onclick = () => this.close('settings-screen');
    this.$('login-btn').onclick = () => this.login(this.$('phone-input').value);
    this.$('login-cancel').onclick = () => this.close('welcome-screen');
    this.$('phone-input').addEventListener('keydown', e => { if (e.key === 'Enter') this.login(e.target.value); });
    this.$('switch-phone-btn').onclick = () => {
      this.close('settings-screen');
      this.$('phone-input').value = '';
      this.$('login-error').textContent = '';
      this.$('login-cancel').hidden = false;
      this.open('welcome-screen');
    };
    this.$('toggle-sound').onclick = () => { const on = this.sound.toggleSound(); this.store('soccer_sound', on ? 'on' : 'off'); this.syncSettings(); };
    this.$('toggle-haptics').onclick = () => { const on = this.sound.toggleHaptics(); this.store('soccer_haptics', on ? 'on' : 'off'); this.syncSettings(); if (on) this.buzz(30); };
    document.querySelectorAll('#timer-seg button').forEach(b => b.onclick = () => this.setTimer(parseInt(b.dataset.time, 10)));
    document.addEventListener('keydown', e => this.onKey(e));
    window.addEventListener('resize', () => this.puzzle && this.renderWord());
  }

  onKey(e) {
    if (document.querySelector('.screen.open') || !this.puzzle || this.locked) return;
    if (e.key === 'Backspace') return this.undo();
    if (e.key === 'Enter') return this.check();
    const ch = e.key.length === 1 ? e.key.toUpperCase() : '';
    const k = this.keys.find(k => k.char === ch && !k.used);
    if (k) this.place(k.id);
  }

  // ---------- session ----------
  async login(raw, silent) {
    const err = this.$('login-error'); err.textContent = '';
    if (!raw || !raw.trim()) { err.textContent = 'Enter your phone number.'; return; }
    try {
      const res = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone_number: raw }) });
      const d = await res.json();
      if (!res.ok) { err.textContent = d.error || 'Could not sign in.'; this.open('welcome-screen'); return; }
      const changed = this.phone !== d.phone_number;
      this.phone = d.phone_number; this.score = d.score; this.streak = d.streak;
      this.store('soccer_phone_number', this.phone);
      this.wins = d.wins || 0;
      this.run = Math.max(0, Math.min(RUN_LEN - 1, (d.streak || 1) - 1));
      if (changed) { this.round = { points: 0 }; this.clearPending(); }
      this.round.points = d.session_points || 0;           // the server owns the session; it resets after 24h
      if (d.session_expired) { this.clearPending(); this.notice = 'Your last session expired after 24 hours, so we started a fresh one.'; }
      this.renderHud(); this.renderSegments(); this.syncSettings();
      this.close('welcome-screen');
      this.$('login-cancel').hidden = true;
      this.next();
    } catch (e) {
      err.textContent = 'Connection error. Check the server and try again.';
      this.open('welcome-screen');
    }
  }

  // The round (progress segments and points) survives a refresh within the same tab.
  saveRound() { try { sessionStorage.setItem('pl_round', JSON.stringify({ phone: this.phone, round: this.round })); } catch (e) {} }
  restoreRound() {
    try { const r = JSON.parse(sessionStorage.getItem('pl_round') || 'null'); if (r && r.phone === this.phone && r.round && typeof r.round.points === 'number') this.round = r.round; } catch (e) {}
  }

  // The word currently on screen is remembered for this browser tab, so a refresh doesn't burn it.
  savePending() { try { sessionStorage.setItem('pl_current', JSON.stringify({ phone: this.phone, puzzle: this.puzzle })); } catch (e) {} }
  clearPending() { try { sessionStorage.removeItem('pl_current'); } catch (e) {} }
  readPending() {
    try { const p = JSON.parse(sessionStorage.getItem('pl_current') || 'null'); return p && p.phone === this.phone ? p.puzzle : null; } catch (e) { return null; }
  }

  async next() {
    this.stopTimer(); this.locked = true;
    const pending = this.readPending();
    if (pending) return this.load(pending);
    try {
      const res = await fetch(`/api/puzzle/next?phone_number=${encodeURIComponent(this.phone)}&difficulty=${this.run + 1}`);
      const d = await res.json();
      if (!res.ok) return this.showEmpty(d.message);
      this.load(d);
    } catch (e) {
      this.showEmpty('Could not reach the server. Check your connection and refresh.', true);
    }
  }

  showEmpty(msg, isError) {
    this.puzzle = null;
    this.$('word').innerHTML = '';
    const n = document.createElement('div'); n.className = 'empty-note';
    const t = document.createElement('strong'); t.textContent = isError ? 'Offline' : 'All caught up';
    n.appendChild(t); n.appendChild(document.createTextNode(msg || 'No more words right now.'));
    this.$('word').appendChild(n);
    this.$('tray').innerHTML = '';
    this.setStatus('');
    ['primary-btn', 'skip-btn', 'reveal-btn', 'undo-btn'].forEach(id => this.$(id).disabled = true);
    this.$('timer-chip').classList.remove('low'); this.$('hud-timer').textContent = '—';
  }

  // ---------- puzzle ----------
  load(p) {
    this.puzzle = p; this.savePending();
    const word = p.word.toUpperCase();
    // The pattern is the word's characters joined by spaces. Strip whitespace so it lines up 1:1 with
    // the word's non-space characters (this keeps multi-word names aligned).
    const mask = p.masked_pattern.toUpperCase().replace(/\s+/g, '');
    this.gaps = []; let mi = 0, g = 0;
    for (let i = 0; i < word.length; i++) {
      if (word[i] === ' ') continue;
      if (mask[mi++] === '_') this.gaps.push({ idx: g++, charIdx: i, expected: word[i], value: null, keyId: null, revealed: false });
    }
    this.active = 0; this.attempts = 0; this.hintsLeft = 1; this.hintUsed = false; this.locked = false;
    this.keys = this.shuffle([...p.missing_letters, ...p.distractors]).map((c, i) => ({ id: i, char: c.toUpperCase(), used: false }));
    this.$('skip-btn').disabled = false;
    this.setStatus(''); this.$('word').className = 'word';
    this.renderAll(); this.startTimer();
    if (this.notice) { this.setStatus(this.notice); this.notice = ''; }
  }

  renderAll() { this.renderHud(); this.renderSegments(); this.renderWord(); this.renderTray(); this.renderControls(); }

  renderHud() {
    this.$('hud-score').textContent = `${this.score.toLocaleString()} pts`;
    this.$('hud-streak').textContent = `Streak x${this.streak}`;
    this.$('round-label').textContent = `Streak ${this.run} of ${RUN_LEN} · ${LEVELS[Math.min(this.run, 3)]}`;
  }

  renderSegments() {
    const build = (el, list) => {
      el.innerHTML = '';
      for (let i = 0; i < RUN_LEN; i++) {
        const b = document.createElement('div'); b.className = 'seg-bar';
        if (list[i]) b.classList.add(list[i]);
        el.appendChild(b);
      }
    };
    const live = []; for (let i = 0; i < RUN_LEN; i++) live.push(i < this.run ? 'ok' : i === this.run ? 'now' : '');
    build(this.$('segments'), live);
    build(this.$('r-segments'), this.pips);
  }

  renderWord() {
    if (!this.puzzle) return;
    const wrap = this.$('word'); wrap.innerHTML = '';
    const segs = this.puzzle.word.toUpperCase().split(' ');
    const longest = Math.max(...segs.map(s => s.length));
    const avail = Math.min(window.innerWidth, 480) - 40;
    const tile = Math.max(26, Math.min(42, Math.floor((avail - (longest - 1) * 6) / longest)));
    wrap.style.setProperty('--tile', tile + 'px');

    const nextEmpty = this.gaps.find(g => !g.value);
    let off = 0;
    segs.forEach(seg => {
      const row = document.createElement('div'); row.className = 'segment';
      for (let i = 0; i < seg.length; i++) {
        const gap = this.gaps.find(x => x.charIdx === off + i);
        let t;
        if (!gap) { t = document.createElement('div'); t.className = 'tile'; t.textContent = seg[i]; }
        else if (gap.revealed) { t = document.createElement('div'); t.className = 'tile revealed'; t.textContent = gap.value; t.setAttribute('aria-label', `Revealed letter ${gap.value}`); }
        else {
          t = document.createElement('button'); t.type = 'button';
          if (gap.value) { t.className = 'tile filled'; t.textContent = gap.value; t.setAttribute('aria-label', `Letter ${gap.value}, tap to remove`); t.onclick = () => this.clearGap(gap.idx); }
          else { t.className = 'tile gap' + (nextEmpty && nextEmpty.idx === gap.idx ? ' next' : ''); t.innerHTML = '&nbsp;'; t.setAttribute('aria-label', `Empty gap ${gap.idx + 1}`); t.onclick = () => { this.active = gap.idx; this.renderWord(); }; }
        }
        row.appendChild(t);
      }
      wrap.appendChild(row);
      off += seg.length + 1;
    });
  }

  renderTray() {
    const tray = this.$('tray'); tray.innerHTML = '';
    this.keys.forEach(k => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'key'; b.textContent = k.char; b.disabled = k.used || this.locked;
      b.onclick = () => this.place(k.id); tray.appendChild(b);
    });
  }

  renderControls() {
    const filled = this.gaps.length && this.gaps.every(g => g.value);
    this.$('primary-btn').disabled = this.locked || !filled;
    this.$('reveal-btn').disabled = this.locked || this.hintsLeft < 1 || !this.gaps.some(g => !g.value);
    this.$('reveal-left').textContent = `· ${this.hintsLeft} left`;
    this.$('undo-btn').disabled = this.locked || !this.gaps.some(g => g.value && !g.revealed);
    if (!this.locked && !this.$('status').classList.contains('bad')) {
      const left = this.gaps.filter(g => !g.value).length;
      this.setStatus(filled ? 'Ready to check' : `${left} ${left === 1 ? 'letter' : 'letters'} to go`);
    }
  }

  setStatus(t, kind) { const s = this.$('status'); s.textContent = t || ' '; s.className = 'status' + (kind ? ' ' + kind : ''); }

  // ---------- input ----------
  place(keyId) {
    if (this.locked) return;
    const key = this.keys.find(k => k.id === keyId); if (!key || key.used) return;
    let gap = this.gaps[this.active];
    if (!gap || gap.value) gap = this.gaps.find(g => !g.value);
    if (!gap) return;
    gap.value = key.char; gap.keyId = key.id; key.used = true;
    const nxt = this.gaps.find(g => !g.value); this.active = nxt ? nxt.idx : gap.idx;
    this.snd('playSlot'); this.buzz(10);
    this.$('word').classList.remove('wrong'); this.setStatus('');
    this.renderWord(); this.renderTray(); this.renderControls();
  }

  clearGap(idx) {
    if (this.locked) return;
    const gap = this.gaps.find(g => g.idx === idx); if (!gap || !gap.value || gap.revealed) return;
    const key = this.keys.find(k => k.id === gap.keyId); if (key) key.used = false;
    gap.value = null; gap.keyId = null; this.active = gap.idx;
    this.snd('playUnslot'); this.setStatus('');
    this.renderWord(); this.renderTray(); this.renderControls();
  }

  undo() {
    const last = [...this.gaps].reverse().find(g => g.value && !g.revealed);
    if (last) this.clearGap(last.idx);
  }

  reveal() {
    if (this.locked || this.hintsLeft < 1) return;
    const gap = this.gaps.find(g => !g.value); if (!gap) return;
    const key = this.keys.find(k => k.char === gap.expected && !k.used);
    gap.value = gap.expected; gap.revealed = true; gap.keyId = key ? key.id : null; if (key) key.used = true;
    this.hintsLeft--; this.hintUsed = true;
    this.snd('playSlot'); this.buzz(15);
    this.setStatus('');
    this.renderWord(); this.renderTray(); this.renderControls();
  }

  // ---------- answers ----------
  check() {
    if (this.locked || !this.gaps.every(g => g.value)) return;
    const w = this.$('word');
    if (this.gaps.every(g => g.value === g.expected)) {
      this.locked = true; this.stopTimer();
      w.classList.remove('wrong'); w.classList.add('correct');
      this.setStatus('Nice one!', 'good');
      this.snd('playCorrect', this.streak); this.buzz([20, 40, 20]);
      this.renderTray(); this.renderControls();
      this.record(true).then(d => setTimeout(() => this.showResult(true, d), 650));
    } else {
      this.attempts++;
      this.snd('playWrong'); this.buzz(80);
      w.classList.remove('wrong'); void w.offsetWidth; w.classList.add('wrong');
      if (this.attempts >= 2) {
        this.locked = true; this.stopTimer(); this.renderTray(); this.renderControls();
        this.setStatus('Out of tries', 'bad');
        this.record(false).then(d => setTimeout(() => this.showResult(false, d, 'Out of tries'), 650));
        return;
      }
      this.setStatus('Not quite. One try left. Tap a letter to swap it.', 'bad');
      this.renderControls();
    }
  }

  async record(correct, reason) {
    const spent = Math.max(0, Math.round((Date.now() - this.startedAt) / 1000));
    this.lastSpent = spent;
    try {
      const res = await fetch('/api/puzzle/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: this.phone, puzzle_id: this.puzzle.id, is_correct: correct, reason: reason || (correct ? '' : 'wrong'), time_spent: spent, hints_used: this.hintUsed ? 1 : 0 }) });
      const d = await res.json();
      if (d.success) { this.score = d.new_score; this.streak = d.new_streak; this.wins = d.wins || this.wins; return d; }
    } catch (e) {}
    return null;
  }

  async skip() {
    if (this.locked || !this.puzzle) return;
    this.locked = true; this.stopTimer(); this.renderControls(); this.renderTray();
    const d = await this.record(false, 'skipped');          // logged so the word isn't served again for 30 days
    this.showResult(false, d, 'Skipped');
  }

  timeUp() {
    if (this.locked) return;
    this.locked = true; this.renderControls(); this.renderTray();
    this.snd('playWhistle', false); this.buzz([60, 60, 60]);
    this.record(false, 'timeout').then(d => this.showResult(false, d, "Time's up"));
  }

  // ---------- result screen ----------
  showResult(ok, data, label) {
    this.clearPending();
    const prev = this.run;
    const pts = ok && data ? (data.points_awarded || 0) : 0;
    const sum = data && data.session_summary;
    this.round.points = sum ? sum.points : (data && typeof data.session_points === 'number' ? data.session_points : this.round.points + pts);
    const won = !!(ok && data && data.won);
    this.won = won;
    const runPoints = this.round.points;
    // Pips for the result screen, then move to the new run state.
    if (won) this.pips = ['ok', 'ok', 'ok', 'ok'];
    else if (ok) this.pips = Array.from({ length: RUN_LEN }, (_, i) => (i <= prev ? 'ok' : ''));
    else this.pips = Array.from({ length: RUN_LEN }, (_, i) => (i < prev ? 'ok' : i === prev ? 'miss' : ''));
    this.run = won || !ok ? 0 : Math.min(RUN_LEN - 1, data && data.new_streak ? data.new_streak - 1 : prev + 1);
    if (this.run === 0) this.round.points = 0;
    this.saveRound();
    this.renderHud(); this.renderSegments();

    this.$('r-label').textContent = won ? 'Four in a row' : `Streak ${ok ? prev + 1 : prev} of ${RUN_LEN} · ${LEVELS[Math.min(prev, 3)]}`;
    const st = this.$('r-state'); st.textContent = won ? 'Winner' : ok ? 'Solved' : (label || 'Missed'); st.className = 'r-state' + (ok ? '' : ' bad');
    const ic = this.$('result-icon'); ic.className = 'result-icon' + (ok ? '' : ' bad');
    ic.innerHTML = won
      ? '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8"/></svg>'
      : ok
      ? '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
      : '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    const ey = this.$('result-eyebrow'); ey.textContent = won ? 'You won' : ok ? 'Correct' : (label || 'Missed'); ey.className = 'eyebrow' + (ok ? '' : ' bad');

    const rw = this.$('result-word'); rw.textContent = '';
    this.puzzle.word.toUpperCase().split(' ').forEach((part, i, arr) => { rw.appendChild(document.createTextNode(part)); if (i < arr.length - 1) rw.appendChild(document.createElement('br')); });

    // When the session ends, the stat cards show the whole session instead of the last word.
    const ended = !!(won || !ok);
    const total = sum || { points: runPoints, words: prev + 1, streak: won ? RUN_LEN : prev };
    this.$('r-points').textContent = ended ? total.points.toLocaleString() : `+${pts}`;
    this.$('r-time').textContent = ended ? total.words : `${this.lastSpent || 0}s`;
    this.$('r-streak').textContent = ended ? total.streak : prev + 1;
    this.$('r-points-cap').textContent = ended ? 'session points' : 'points';
    this.$('r-time-cap').textContent = ended ? 'words played' : 'solve time';
    this.$('r-streak-cap').textContent = ended ? 'total streak' : 'streak';
    let note;
    if (won) note = `Session complete. Four in a row, ${total.points.toLocaleString()} points in ${total.words} words. You have ${this.wins} ${this.wins === 1 ? 'win' : 'wins'}.`;
    else if (ok) note = `${this.hintUsed ? 'You used a hint, so this one earned fewer points. ' : ''}Next up: ${LEVELS[this.run]} level.`;
    else note = `Session over: ${total.points.toLocaleString()} points, a streak of ${total.streak}. A new session starts at Easy. This word comes back after 30 days.`;
    this.$('result-note').textContent = note;
    this.$('next-btn').textContent = won ? 'Play again' : ok ? 'Next word' : 'Start a new streak';
    this.$('share-btn').textContent = 'Share result';
    this.lastWon = won; this.lastRunPoints = runPoints;
    this.open('result-screen');
  }

  nextFromResult() {
    this.close('result-screen');
    this.pips = [];
    this.next();
  }

  // Play history for this number (finished sessions, newest first).
  async loadHistory() {
    const list = this.$('history-list'), tot = this.$('history-totals');
    if (!list || !this.phone) return;
    try {
      const d = await (await fetch(`/api/history?phone_number=${encodeURIComponent(this.phone)}&limit=10`)).json();
      const t = d.totals || {};
      tot.textContent = t.sessions ? `${t.sessions} sessions, ${t.wins} won, best ${Number(t.best_points).toLocaleString()} pts, best streak ${t.best_streak}` : 'No finished sessions yet.';
      list.innerHTML = '';
      const names = { won: 'Won', missed: 'Missed', skipped: 'Skipped', timeout: "Time's up", expired: 'Expired' };
      (d.sessions || []).forEach(s => {
        const li = document.createElement('li');
        const when = new Date(s.ended_at);
        const a = document.createElement('span'); a.textContent = `${names[s.outcome] || s.outcome} · streak ${s.streak}`;
        const b = document.createElement('span'); b.className = 'dim'; b.textContent = `${Number(s.points).toLocaleString()} pts · ${isNaN(when) ? '' : when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
        li.appendChild(a); li.appendChild(b); list.appendChild(li);
      });
    } catch (e) { tot.textContent = 'History unavailable offline.'; }
  }

  async share() {
    const text = this.lastWon
      ? `Pitch Legends: I won a run, four in a row! ${this.lastRunPoints.toLocaleString()} pts, ${this.wins} ${this.wins === 1 ? 'win' : 'wins'}.`
      : `Pitch Legends: ${this.score.toLocaleString()} pts, ${this.wins} ${this.wins === 1 ? 'win' : 'wins'}.`;
    const btn = this.$('share-btn');
    try {
      if (navigator.share) { await navigator.share({ text, url: location.origin }); return; }
      await navigator.clipboard.writeText(`${text} ${location.origin}`);
      btn.textContent = 'Copied to clipboard';
    } catch (e) { btn.textContent = 'Could not share'; }
    setTimeout(() => { btn.textContent = 'Share result'; }, 1800);
  }

  // ---------- timer ----------
  setTimer(sec) {
    this.maxTimer = sec; this.store('soccer_timer_sec', sec);
    this.syncSettings();
    if (this.puzzle && !this.locked) this.startTimer();
    else this.drawTimer();
  }

  syncSettings() {
    document.querySelectorAll('#timer-seg button').forEach(b => b.classList.toggle('active', parseInt(b.dataset.time, 10) === this.maxTimer));
    this.$('toggle-sound').setAttribute('aria-checked', String(!!this.sound.soundEnabled));
    this.$('toggle-haptics').setAttribute('aria-checked', String(!!this.sound.hapticsEnabled));
    this.$('player-label').textContent = this.maskPhone(this.phone);
    if (!this.timer) this.drawTimer();
  }

  startTimer() {
    this.stopTimer(); this.startedAt = Date.now();
    if (!this.maxTimer) { this.drawTimer(); return; }
    this.remaining = this.maxTimer; this.drawTimer();
    this.timer = setInterval(() => {
      this.remaining--; this.drawTimer();
      if (this.remaining <= 5 && this.remaining > 0) this.snd('playTick', true);
      if (this.remaining <= 0) { this.stopTimer(); this.timeUp(); }
    }, 1000);
  }
  stopTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  drawTimer() {
    const chip = this.$('timer-chip'), txt = this.$('hud-timer');
    if (!this.maxTimer) { txt.textContent = 'No timer'; chip.classList.remove('low'); return; }
    const s = this.timer ? this.remaining : this.maxTimer;
    txt.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    chip.classList.toggle('low', !!this.timer && s <= 10);
  }
}

window.addEventListener('DOMContentLoaded', () => { window.game = new MaskedWordGame(); });
