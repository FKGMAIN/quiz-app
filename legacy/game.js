// ==========================================================================
// Pitch Legends: Historic Football Word Gap Puzzle - Client Game Engine
// Dual SQLite/Postgres Backend + Phone Session with 30-Day Cooldown
// ==========================================================================

class SoccerWordGapGame {
  constructor() {
    this.sound = window.soundCtrl;
    this.particles = null;

    // Player Phone Session
    this.phoneNumber = localStorage.getItem('soccer_phone_number') || null;
    this.playerScore = 0;
    this.playerStreak = 1;
    this.answeredIn30Days = 0;
    this.totalPuzzles = 120;
    this.selectedCategory = null;

    // Modifiable Match Timer
    this.maxTimer = 45;
    this.remainingTimer = 45;
    this.timerInterval = null;
    this.isZenMode = false;
    this.speedBonusEnabled = true;
    this.urgencyTickEnabled = true;
    this.timerUrgentThreshold = 10;

    // Current Puzzle State
    this.currentPuzzle = null;
    this.gapSlots = []; // Array of { gapIdx, expectedChar, slottedChar, wordCharIdx }
    this.activeGapIdx = 0;
    this.letterBank = []; // Array of { id, char, placed }
    this.usedHints = { clue: false, eliminate: false };

    this.initElements();
    this.loadPreferences();
    this.bindEvents();
    this.initParticles();

    if (!this.phoneNumber) {
      // Prompt for phone login
      this.openModal(this.phoneModal);
    } else {
      this.initPlayerSession(this.phoneNumber);
    }
  }

  initElements() {
    // HUD Elements
    this.hudPhoneText = document.getElementById('hud-phone-text');
    this.hudMonthProgress = document.getElementById('hud-month-progress');
    this.phonePillBtn = document.getElementById('phone-pill-btn');
    this.hudScore = document.getElementById('hud-score');
    this.hudTimerText = document.getElementById('hud-timer-text');
    this.hudTimerBtn = document.getElementById('timer-hud-btn');
    this.timerCircle = document.getElementById('timer-circle');
    this.hudStreak = document.getElementById('hud-streak');
    this.hudStreakWrap = document.getElementById('hud-streak-wrap');

    // Mascot
    this.mascotSpeech = document.getElementById('mascot-speech');

    // Puzzle Board
    this.scenarioYear = document.getElementById('scenario-year');
    this.puzzleCategory = document.getElementById('puzzle-category');
    this.matchTeamsBar = document.getElementById('match-teams-bar');
    this.historicClueBox = document.getElementById('historic-clue-box');
    this.wordGapsWrapper = document.getElementById('word-gaps-wrapper');
    this.puzzleBoard = document.getElementById('puzzle-board');
    this.cooldownStatusBar = document.getElementById('cooldown-status-bar');

    // Letter Bank & Action Buttons
    this.letterBankGrid = document.getElementById('letter-bank-grid');
    this.checkAnswerBtn = document.getElementById('check-answer-btn');
    this.clearSlotsBtn = document.getElementById('clear-slots-btn');
    this.shuffleWordsBtn = document.getElementById('shuffle-words-btn');

    // Hints
    this.hintClueBtn = document.getElementById('hint-clue-btn');
    this.hintClueText = document.getElementById('hint-clue-text');
    this.hintEliminateBtn = document.getElementById('hint-eliminate-btn');
    this.skipPuzzleBtn = document.getElementById('skip-puzzle-btn');

    // Modals
    this.phoneModal = document.getElementById('phone-modal');
    this.phoneInput = document.getElementById('phone-input');
    this.savePhoneBtn = document.getElementById('save-phone-btn');
    this.phoneStatsCard = document.getElementById('phone-stats-card');

    this.timerModal = document.getElementById('timer-modal');
    this.realmModal = document.getElementById('realm-modal');
    this.victoryModal = document.getElementById('victory-modal');
    this.timeupModal = document.getElementById('timeup-modal');
    this.settingsModal = document.getElementById('settings-modal');

    // Timer modal controls
    this.customTimerSlider = document.getElementById('custom-timer-slider');
    this.sliderTimerVal = document.getElementById('slider-timer-val');
    this.toggleSpeedBonus = document.getElementById('toggle-speed-bonus');
    this.toggleUrgencyTick = document.getElementById('toggle-urgency-tick');
    this.saveTimerBtn = document.getElementById('save-timer-btn');
  }

  loadPreferences() {
    try {
      const savedTimer = localStorage.getItem('soccer_timer_sec');
      if (savedTimer !== null) {
        const val = parseInt(savedTimer, 10);
        this.maxTimer = val;
        this.isZenMode = (val === 0);
      }
      const savedSpeedBonus = localStorage.getItem('soccer_speed_bonus');
      if (savedSpeedBonus !== null) {
        this.speedBonusEnabled = savedSpeedBonus === 'true';
      }
      this.toggleSpeedBonus.checked = this.speedBonusEnabled;
    } catch (e) {}
    this.updateTimerModalInputs();
  }

  savePreferences() {
    try {
      localStorage.setItem('soccer_timer_sec', this.maxTimer);
      localStorage.setItem('soccer_speed_bonus', this.speedBonusEnabled);
    } catch (e) {}
  }

  initParticles() {
    try {
      this.particles = new ParticleEngine('fx-canvas');
    } catch (e) {}
  }

  // ==========================================================================
  // PHONE SESSION & 30-DAY COOLDOWN LOGIC
  // ==========================================================================
  async initPlayerSession(phoneNumber) {
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to authenticate phone session.');
        this.openModal(this.phoneModal);
        return;
      }

      this.phoneNumber = data.phone_number;
      localStorage.setItem('soccer_phone_number', this.phoneNumber);
      this.playerScore = data.score;
      this.playerStreak = data.streak;
      this.answeredIn30Days = data.answered_in_30_days;
      this.totalPuzzles = data.total_puzzles;

      // Update HUD
      const displayPhone = this.phoneNumber.length > 10 
        ? `${this.phoneNumber.slice(0, 4)}...${this.phoneNumber.slice(-4)}`
        : this.phoneNumber;
      this.hudPhoneText.textContent = displayPhone;
      this.hudMonthProgress.textContent = `${this.answeredIn30Days}/${this.totalPuzzles}`;
      this.hudScore.textContent = this.playerScore;
      this.hudStreak.textContent = `x${this.playerStreak}`;

      const dbBadge = document.getElementById('db-type-badge');
      if (dbBadge) dbBadge.textContent = data.db_type ? data.db_type.toUpperCase() : 'SQLITE';

      // Update phone stats card in modal
      document.getElementById('p-score').textContent = this.playerScore;
      document.getElementById('p-streak').textContent = `x${this.playerStreak}`;
      document.getElementById('p-answered').textContent = this.answeredIn30Days;
      document.getElementById('p-remaining').textContent = data.remaining_available;
      this.phoneStatsCard.style.display = 'flex';

      this.closeModal(this.phoneModal);
      this.mascotSpeech.textContent = `Player verified! Questions answered by ${this.phoneNumber} will not repeat for 30 days.`;

      // Load next puzzle
      this.fetchNextPuzzle();
    } catch (err) {
      console.error('Session init error:', err);
      this.mascotSpeech.textContent = 'Connection error. Playing in offline practice mode.';
    }
  }

  // ==========================================================================
  // FETCH PUZZLE (WORDS ONLY, EXCLUDING 30-DAY ANSWERED)
  // ==========================================================================
  async fetchNextPuzzle() {
    this.stopTimer();

    if (!this.phoneNumber) {
      this.openModal(this.phoneModal);
      return;
    }

    try {
      let url = `/api/puzzle/next?phone_number=${encodeURIComponent(this.phoneNumber)}`;
      if (this.selectedCategory) {
        url += `&category=${encodeURIComponent(this.selectedCategory)}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        this.mascotSpeech.textContent = data.message || 'All historic questions completed for this 30-day window!';
        this.cooldownStatusBar.innerHTML = '🏆 <strong>All questions solved this month! Cycle resets automatically.</strong>';
        return;
      }

      this.currentPuzzle = data;
      this.setupWordGapPuzzle(data);
    } catch (err) {
      console.error('Failed to fetch puzzle:', err);
    }
  }

  setupWordGapPuzzle(puzzle) {
    this.scenarioYear.textContent = puzzle.year || 'HISTORIC';
    this.puzzleCategory.textContent = puzzle.category;
    this.matchTeamsBar.textContent = `⚽ ${puzzle.team || puzzle.category}`;
    this.historicClueBox.textContent = puzzle.clue;

    if (puzzle.recycled_after_30_days) {
      this.cooldownStatusBar.innerHTML = '<span>♻️ 30-day window elapsed: Questions recycled for extra training!</span>';
    } else {
      this.cooldownStatusBar.innerHTML = '<span>🛡️ 30-Day Fresh Question Guarantee (No repeats)</span>';
    }

    // Reset hints
    this.usedHints = { clue: false, eliminate: false };
    this.hintClueBtn.classList.remove('used');
    this.hintEliminateBtn.classList.remove('used');
    this.hintClueText.textContent = 'Letter Clue';

    // Parse Word & Mask Pattern into Gaps
    const word = puzzle.word.toUpperCase();
    const pattern = puzzle.masked_pattern.toUpperCase();
    this.gapSlots = [];

    // Parse pattern to identify gap positions
    let patternIdx = 0;
    let gapCounter = 0;

    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (char === ' ') {
        patternIdx++; // Skip space in pattern
        continue;
      }

      const patternChar = pattern[patternIdx] || '_';
      if (patternChar === '_') {
        this.gapSlots.push({
          gapIdx: gapCounter++,
          wordCharIdx: i,
          expectedChar: char,
          slottedChar: null
        });
      }
      patternIdx += 2; // Advance past character and space in pattern string
    }

    this.activeGapIdx = 0;

    // Create Letter Bank (missing letters + distractors, shuffled)
    const allLetters = [...puzzle.missing_letters, ...puzzle.distractors];
    this.letterBank = this.shuffleArray(allLetters).map((letter, idx) => ({
      id: `l-${idx}-${letter}`,
      char: letter.toUpperCase(),
      placed: false
    }));

    this.renderWordGaps();
    this.renderLetterBank();

    this.mascotSpeech.textContent = `Complete the missing letters to name the legend: ${puzzle.clue.slice(0, 55)}...`;
    this.startTimer();
  }

  // ==========================================================================
  // WORD GAP RENDERING (WORDS ONLY, LETTER GAPS)
  // ==========================================================================
  renderWordGaps() {
    this.wordGapsWrapper.innerHTML = '';
    const word = this.currentPuzzle.word.toUpperCase();

    // Group into word segments for multi-word phrases (e.g. CAMP NOU, JULES RIMET)
    const segments = word.split(' ');

    let charOffset = 0;
    segments.forEach((seg, sIdx) => {
      const segEl = document.createElement('div');
      segEl.className = 'word-segment';

      for (let i = 0; i < seg.length; i++) {
        const fullWordCharIdx = charOffset + i;
        const char = seg[i];

        const gap = this.gapSlots.find(g => g.wordCharIdx === fullWordCharIdx);

        const box = document.createElement('div');
        box.className = 'letter-box';

        if (!gap) {
          // Fixed given letter
          box.classList.add('fixed');
          box.textContent = char;
        } else {
          // Missing letter gap slot
          box.id = `gap-${gap.gapIdx}`;
          if (gap.slottedChar) {
            box.classList.add('filled-gap');
            box.textContent = gap.slottedChar;
            box.addEventListener('click', () => {
              this.unslotGap(gap.gapIdx);
            });
          } else {
            box.classList.add('empty-gap');
            box.textContent = '_';
            if (gap.gapIdx === this.activeGapIdx) {
              box.classList.add('active');
            }
            box.addEventListener('click', () => {
              this.setActiveGap(gap.gapIdx);
            });
          }
        }
        segEl.appendChild(box);
      }

      this.wordGapsWrapper.appendChild(segEl);

      // Space between segments
      if (sIdx < segments.length - 1) {
        const spacer = document.createElement('div');
        spacer.className = 'word-space-separator';
        this.wordGapsWrapper.appendChild(spacer);
      }

      charOffset += seg.length + 1; // +1 for the space
    });

    this.updateCheckButtonState();
  }

  renderLetterBank() {
    this.letterBankGrid.innerHTML = '';
    this.letterBank.forEach((item) => {
      const chip = document.createElement('button');
      chip.className = 'runic-word-chip';
      if (item.placed) chip.classList.add('placed');
      chip.id = item.id;
      chip.innerHTML = `<span>${item.char}</span>`;

      chip.addEventListener('click', () => {
        if (!item.placed) {
          this.slotLetter(item.char, item.id);
        }
      });

      this.letterBankGrid.appendChild(chip);
    });
  }

  setActiveGap(idx) {
    this.activeGapIdx = idx;
    document.querySelectorAll('.letter-box.empty-gap').forEach(b => {
      b.classList.remove('active');
    });
    const target = document.getElementById(`gap-${idx}`);
    if (target) target.classList.add('active');
    this.sound.playTap();
  }

  slotLetter(char, letterBankId) {
    let targetGapIdx = this.activeGapIdx;
    let targetGap = this.gapSlots[targetGapIdx];

    if (!targetGap || targetGap.slottedChar !== null) {
      targetGap = this.gapSlots.find(g => g.slottedChar === null);
    }
    if (!targetGap) {
      targetGap = this.gapSlots[this.activeGapIdx];
      // Return previous letter to bank
      const oldLetter = targetGap.slottedChar;
      const oldItem = this.letterBank.find(l => l.char === oldLetter && l.placed);
      if (oldItem) oldItem.placed = false;
    }

    targetGap.slottedChar = char;
    const bankItem = this.letterBank.find(l => l.id === letterBankId);
    if (bankItem) bankItem.placed = true;

    // Advance to next empty gap
    const nextEmpty = this.gapSlots.find(g => g.slottedChar === null);
    this.activeGapIdx = nextEmpty ? nextEmpty.gapIdx : targetGap.gapIdx;

    this.sound.playSlot();
    this.renderWordGaps();
    this.renderLetterBank();

    // Auto check if all gaps filled
    if (this.gapSlots.every(g => g.slottedChar !== null)) {
      setTimeout(() => this.verifyAnswer(), 200);
    }
  }

  unslotGap(gapIdx) {
    const gap = this.gapSlots.find(g => g.gapIdx === gapIdx);
    if (!gap || !gap.slottedChar) return;

    const char = gap.slottedChar;
    gap.slottedChar = null;
    this.activeGapIdx = gapIdx;

    const bankItem = this.letterBank.find(l => l.char === char && l.placed);
    if (bankItem) bankItem.placed = false;

    this.sound.playUnslot();
    this.renderWordGaps();
    this.renderLetterBank();
  }

  unslotActiveOrLast() {
    let target = this.gapSlots.find(g => g.gapIdx === this.activeGapIdx && g.slottedChar !== null);
    if (!target) {
      for (let i = this.gapSlots.length - 1; i >= 0; i--) {
        if (this.gapSlots[i].slottedChar !== null) {
          target = this.gapSlots[i];
          break;
        }
      }
    }
    if (target) {
      this.unslotGap(target.gapIdx);
    }
  }

  clearAllSlots() {
    this.gapSlots.forEach(g => g.slottedChar = null);
    this.letterBank.forEach(l => l.placed = false);
    this.activeGapIdx = 0;
    this.renderWordGaps();
    this.renderLetterBank();
  }

  shuffleAvailableWords() {
    this.letterBank = this.shuffleArray(this.letterBank);
    this.renderLetterBank();
  }

  updateCheckButtonState() {
    const hasAnyFilled = this.gapSlots.some(g => g.slottedChar !== null);
    this.checkAnswerBtn.disabled = !hasAnyFilled;
  }

  // ==========================================================================
  // ANSWER SUBMISSION & 30-DAY BACKEND LOGGING
  // ==========================================================================
  async verifyAnswer() {
    const isComplete = this.gapSlots.every(g => g.slottedChar !== null);
    if (!isComplete) {
      this.mascotSpeech.textContent = 'Referee whistle! Complete all missing letters in the word!';
      this.sound.playWrong();
      this.puzzleBoard.classList.add('shake');
      setTimeout(() => this.puzzleBoard.classList.remove('shake'), 400);
      return;
    }

    const isCorrect = this.gapSlots.every(g => g.slottedChar === g.expectedChar);

    if (isCorrect) {
      await this.handleCorrectAnswer();
    } else {
      this.handleWrongAnswer();
    }
  }

  async handleCorrectAnswer() {
    this.stopTimer();

    document.querySelectorAll('.letter-box').forEach(b => {
      b.classList.add('correct-pulse');
    });

    this.sound.playCorrect(this.playerStreak);
    this.playerStreak++;
    this.hudStreak.textContent = `x${this.playerStreak}`;

    // Celebration Canvas Effects
    if (this.particles) {
      const rect = this.wordGapsWrapper.getBoundingClientRect();
      const phoneRect = document.getElementById('phone-frame').getBoundingClientRect();
      const x = rect.left - phoneRect.left + rect.width / 2;
      const y = rect.top - phoneRect.top + rect.height / 2;
      this.particles.burstStars(x, y, 45);
      this.particles.launchConfetti();
    }

    const timeSpent = this.maxTimer - this.remainingTimer;

    // Send answer to server to log timestamp in user_answers & update score
    try {
      const res = await fetch('/api/puzzle/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: this.phoneNumber,
          puzzle_id: this.currentPuzzle.id,
          is_correct: true,
          time_spent: timeSpent
        })
      });
      const data = await res.json();
      if (data.success) {
        this.playerScore = data.new_score;
        this.hudScore.textContent = this.playerScore;
        this.answeredIn30Days++;
        this.hudMonthProgress.textContent = `${this.answeredIn30Days}/${this.totalPuzzles}`;
      }
    } catch (e) {
      console.warn('Backend answer sync error:', e);
    }

    if (this.speedBonusEnabled && !this.isZenMode) {
      this.addTimeBonus(5);
    }

    // Victory modal details
    document.getElementById('victory-word-display').textContent = this.currentPuzzle.word;
    document.getElementById('v-base-score').textContent = '+250';
    document.getElementById('v-time-score').textContent = `+${Math.max(0, this.remainingTimer * 6)}`;
    document.getElementById('v-streak-score').textContent = `x${this.playerStreak}`;
    document.getElementById('v-total-score').textContent = `+${250 + Math.max(0, this.remainingTimer * 6)}`;

    const comments = [
      'GOLAZO! Clean strike! The word is completed!',
      'TASTEFUL FINISH! Top drawer football knowledge!',
      'BALLON D\'OR FORM! Your memory of the pitch is legendary!',
      'MAGNIFICENT! You cracked the word with clinical speed!'
    ];
    this.mascotSpeech.textContent = comments[Math.floor(Math.random() * comments.length)];

    setTimeout(() => {
      this.sound.playFanfare();
      this.openModal(this.victoryModal);
    }, 650);
  }

  handleWrongAnswer() {
    this.sound.playWrong();
    this.playerStreak = 1;
    this.hudStreak.textContent = 'x1';

    this.puzzleBoard.classList.add('shake');
    setTimeout(() => this.puzzleBoard.classList.remove('shake'), 400);

    this.mascotSpeech.textContent = 'Foul! The letters do not spell the correct historic word. Re-check your gaps!';
  }

  // ==========================================================================
  // MODIFIABLE MATCH TIMER
  // ==========================================================================
  updateTimerModalInputs() {
    this.customTimerSlider.value = this.isZenMode ? 0 : this.maxTimer;
    this.sliderTimerVal.textContent = this.isZenMode ? 'Training Ground (Untimed)' : `${this.maxTimer} seconds`;
    document.querySelectorAll('.timer-preset-btn').forEach(btn => {
      const timeVal = parseInt(btn.getAttribute('data-time'), 10);
      btn.classList.toggle('active', (this.isZenMode && timeVal === 0) || (!this.isZenMode && timeVal === this.maxTimer));
    });
  }

  applyModifiedTimerSettings() {
    const selectedPreset = document.querySelector('.timer-preset-btn.active');
    let timeVal = this.maxTimer;

    if (selectedPreset) {
      timeVal = parseInt(selectedPreset.getAttribute('data-time'), 10);
    } else {
      timeVal = parseInt(this.customTimerSlider.value, 10);
    }

    this.isZenMode = (timeVal === 0);
    this.maxTimer = timeVal === 0 ? 0 : timeVal;
    this.speedBonusEnabled = this.toggleSpeedBonus.checked;
    this.urgencyTickEnabled = this.toggleUrgencyTick.checked;

    this.savePreferences();

    this.remainingTimer = this.maxTimer;
    this.updateTimerDisplay();

    this.mascotSpeech.textContent = this.isZenMode 
      ? 'Training Ground active! Relax, solve words at your own pace.'
      : `Match Clock modified to ${this.maxTimer} seconds! Keep sharp!`;
  }

  startTimer() {
    this.stopTimer();
    if (this.isZenMode) {
      this.hudTimerText.textContent = '∞ Zen';
      this.timerCircle.style.strokeDashoffset = '0';
      this.timerCircle.style.stroke = 'var(--emerald-400)';
      this.hudTimerBtn.classList.remove('urgent');
      return;
    }

    this.remainingTimer = this.maxTimer;
    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      this.remainingTimer--;
      this.updateTimerDisplay();

      if (this.remainingTimer <= this.timerUrgentThreshold && this.remainingTimer > 0) {
        if (this.urgencyTickEnabled) {
          this.sound.playTick(true);
        }
      }

      if (this.remainingTimer <= 0) {
        this.stopTimer();
        this.handleTimeExpired();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  addTimeBonus(seconds = 5) {
    if (this.isZenMode) return;
    this.remainingTimer = Math.min(this.maxTimer + 15, this.remainingTimer + seconds);
    this.updateTimerDisplay();
    this.sound.playTimeBonus();

    this.hudTimerBtn.style.transform = 'scale(1.15)';
    setTimeout(() => {
      this.hudTimerBtn.style.transform = '';
    }, 250);
  }

  updateTimerDisplay() {
    if (this.isZenMode) {
      this.hudTimerText.textContent = '∞ Zen';
      return;
    }

    this.hudTimerText.textContent = `${this.remainingTimer}s`;

    const fraction = Math.max(0, this.remainingTimer / this.maxTimer);
    const strokeOffset = (1 - fraction) * 100;
    this.timerCircle.style.strokeDashoffset = strokeOffset;

    if (fraction > 0.45) {
      this.timerCircle.style.stroke = 'var(--emerald-400)';
      this.hudTimerBtn.classList.remove('urgent');
    } else if (fraction > 0.22) {
      this.timerCircle.style.stroke = 'var(--gold-400)';
      this.hudTimerBtn.classList.remove('urgent');
    } else {
      this.timerCircle.style.stroke = 'var(--ruby-500)';
      this.hudTimerBtn.classList.add('urgent');
    }
  }

  handleTimeExpired() {
    this.sound.playWhistle(false);
    document.getElementById('timeup-solution').textContent = this.currentPuzzle.word;
    this.playerStreak = 1;
    this.hudStreak.textContent = 'x1';
    this.openModal(this.timeupModal);
  }

  // ==========================================================================
  // HINTS & CATEGORY FILTER
  // ==========================================================================
  useClueHint() {
    if (this.usedHints.clue) return;
    this.usedHints.clue = true;
    this.hintClueBtn.classList.add('used');
    this.hintClueText.textContent = 'Clue Given';

    const firstMissing = this.gapSlots.find(g => g.slottedChar === null);
    if (firstMissing) {
      this.mascotSpeech.textContent = `💡 Letter Clue: The next gap is '${firstMissing.expectedChar}'!`;
    } else {
      this.mascotSpeech.textContent = `💡 Category: ${this.currentPuzzle.category} (${this.currentPuzzle.year || ''})`;
    }
    this.sound.playSlot();
  }

  useEliminateHint() {
    if (this.usedHints.eliminate) return;
    this.usedHints.eliminate = true;
    this.hintEliminateBtn.classList.add('used');

    const expectedLetters = this.gapSlots.map(g => g.expectedChar);
    const distractors = this.letterBank.filter(l => !expectedLetters.includes(l.char) && !l.placed);

    if (distractors.length > 0) {
      distractors.slice(0, 2).forEach(d => d.placed = true);
      this.renderLetterBank();
      this.mascotSpeech.textContent = '🟥 Banished 2 incorrect letters from the dugout!';
      this.sound.playUnslot();
    }
  }

  async renderCategoryModal() {
    const list = document.getElementById('realm-cards-list');
    list.innerHTML = '<div style="color: var(--text-muted); text-align: center;">Loading categories...</div>';

    const categoryIcons = {
      'World Cup Epics': '🏆',
      'World Cup Legends': '👑',
      'European Championships': '🇪🇺',
      'Champions League Miracles': '⭐',
      'Europa League & UEFA Cup': '🥈',
      'African Cup of Nations': '🌍',
      'Tactics & Iconic Plays': '⚡',
      'Historic Stadiums': '🏟️',
      'Underdogs & Fairytales': '🛡️',
      'Trophies & Awards': '🥇'
    };

    try {
      const res = await fetch('/api/categories');
      const categories = await res.json();
      list.innerHTML = '';

      // All categories option
      const allCard = document.createElement('div');
      allCard.className = 'realm-card';
      if (!this.selectedCategory) allCard.classList.add('active');
      allCard.innerHTML = `
        <div class="realm-card-left">
          <div class="realm-card-icon">⚽</div>
          <div>
            <div class="realm-card-title">All Historic Tournaments</div>
            <div class="realm-card-count">Full 190+ football question library</div>
          </div>
        </div>
        <span style="font-size: 14px; color: var(--gold-400);">▶</span>
      `;
      allCard.addEventListener('click', () => {
        this.selectedCategory = null;
        this.closeModal(this.realmModal);
        this.fetchNextPuzzle();
        this.sound.playWhistle(true);
      });
      list.appendChild(allCard);

      categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'realm-card';
        if (this.selectedCategory === cat.category) card.classList.add('active');
        const icon = categoryIcons[cat.category] || '⚽';
        card.innerHTML = `
          <div class="realm-card-left">
            <div class="realm-card-icon">${icon}</div>
            <div>
              <div class="realm-card-title">${cat.category}</div>
              <div class="realm-card-count">${cat.count} Historic Words</div>
            </div>
          </div>
          <span style="font-size: 14px; color: var(--gold-400);">▶</span>
        `;
        card.addEventListener('click', () => {
          this.selectedCategory = cat.category;
          this.closeModal(this.realmModal);
          this.fetchNextPuzzle();
          this.sound.playWhistle(true);
        });
        list.appendChild(card);
      });
    } catch (e) {
      list.innerHTML = '<div style="color: #f87171;">Failed to load categories.</div>';
    }
  }

  // ==========================================================================
  // EVENT BINDINGS
  // ==========================================================================
  bindEvents() {
    // Phone pill triggers profile modal
    this.phonePillBtn.addEventListener('click', () => {
      this.phoneInput.value = this.phoneNumber || '';
      this.openModal(this.phoneModal);
      this.sound.playTap();
    });

    const quickPhoneBtn = document.getElementById('quick-phone-bar-btn');
    if (quickPhoneBtn) {
      quickPhoneBtn.addEventListener('click', () => {
        this.phoneInput.value = this.phoneNumber || '';
        this.openModal(this.phoneModal);
        this.sound.playTap();
      });
    }

    // Save phone submit
    this.savePhoneBtn.addEventListener('click', () => {
      const inputVal = this.phoneInput.value.trim();
      if (!inputVal) {
        alert('Please enter a phone number to start playing.');
        return;
      }
      this.initPlayerSession(inputVal);
      this.sound.playWhistle(true);
    });

    // View switchers
    const desktopWrapper = document.getElementById('desktop-wrapper');
    const viewPhoneBtn = document.getElementById('view-mode-phone');
    const viewExpandBtn = document.getElementById('view-mode-expand');
    const quickTimerBarBtn = document.getElementById('quick-timer-bar-btn');

    viewPhoneBtn.addEventListener('click', () => {
      desktopWrapper.classList.remove('fullscreen-mode');
      viewPhoneBtn.classList.add('active');
      viewExpandBtn.classList.remove('active');
      this.sound.playTap();
      if (this.particles) this.particles.resize();
    });

    viewExpandBtn.addEventListener('click', () => {
      desktopWrapper.classList.add('fullscreen-mode');
      viewExpandBtn.classList.add('active');
      viewPhoneBtn.classList.remove('active');
      this.sound.playTap();
      if (this.particles) this.particles.resize();
    });

    if (quickTimerBarBtn) {
      quickTimerBarBtn.addEventListener('click', () => {
        this.openModal(this.timerModal);
        this.sound.playTap();
      });
    }

    this.hudTimerBtn.addEventListener('click', () => {
      this.openModal(this.timerModal);
      this.sound.playTap();
    });

    // Whistle sound
    const whistleBtn = document.getElementById('whistle-sound-btn');
    if (whistleBtn) {
      whistleBtn.addEventListener('click', () => this.sound.playWhistle(false));
    }

    // Sound toggle
    const soundBtn = document.getElementById('sound-btn');
    soundBtn.addEventListener('click', () => {
      const state = this.sound.toggleSound();
      soundBtn.textContent = state ? '🔊' : '🔇';
      this.sound.playTap();
    });

    // Category filter button
    document.getElementById('category-filter-btn').addEventListener('click', () => {
      this.renderCategoryModal();
      this.openModal(this.realmModal);
      this.sound.playTap();
    });

    // Settings button
    document.getElementById('settings-btn').addEventListener('click', () => {
      this.openModal(this.settingsModal);
      this.sound.playTap();
    });

    document.getElementById('switch-phone-btn').addEventListener('click', () => {
      this.closeModal(this.settingsModal);
      this.phoneInput.value = this.phoneNumber || '';
      this.openModal(this.phoneModal);
    });

    // Modal close handlers
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = e.currentTarget.getAttribute('data-close');
        const modal = document.getElementById(modalId);
        if (modal) {
          this.closeModal(modal);
          this.sound.playTap();
        }
      });
    });

    document.querySelectorAll('.game-modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal(modal);
      });
    });

    // Game action buttons
    this.clearSlotsBtn.addEventListener('click', () => {
      this.clearAllSlots();
      this.sound.playUnslot();
    });

    this.checkAnswerBtn.addEventListener('click', () => {
      this.verifyAnswer();
    });

    this.shuffleWordsBtn.addEventListener('click', () => {
      this.shuffleAvailableWords();
      this.sound.playTap();
    });

    this.hintClueBtn.addEventListener('click', () => this.useClueHint());
    this.hintEliminateBtn.addEventListener('click', () => this.useEliminateHint());
    this.skipPuzzleBtn.addEventListener('click', () => {
      this.fetchNextPuzzle();
      this.sound.playTap();
    });

    // Timer modal controls
    document.querySelectorAll('.timer-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.timer-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const timeVal = parseInt(btn.getAttribute('data-time'), 10);
        if (timeVal === 0) {
          this.customTimerSlider.value = 0;
          this.sliderTimerVal.textContent = 'Training Ground (Untimed)';
        } else {
          this.customTimerSlider.value = timeVal;
          this.sliderTimerVal.textContent = `${timeVal} seconds`;
        }
        this.sound.playTap();
      });
    });

    this.customTimerSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.sliderTimerVal.textContent = `${val} seconds`;
      document.querySelectorAll('.timer-preset-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.getAttribute('data-time'), 10) === val);
      });
    });

    this.saveTimerBtn.addEventListener('click', () => {
      this.applyModifiedTimerSettings();
      this.closeModal(this.timerModal);
      this.sound.playWhistle(true);
    });

    // Victory modal buttons
    document.getElementById('victory-next-btn').addEventListener('click', () => {
      this.closeModal(this.victoryModal);
      this.fetchNextPuzzle();
    });
    document.getElementById('victory-profile-btn').addEventListener('click', () => {
      this.closeModal(this.victoryModal);
      this.openModal(this.phoneModal);
    });

    // Time Up retry
    document.getElementById('timeup-retry-btn').addEventListener('click', () => {
      this.closeModal(this.timeupModal);
      this.clearAllSlots();
      this.startTimer();
    });
    document.getElementById('timeup-adjust-timer-btn').addEventListener('click', () => {
      this.closeModal(this.timeupModal);
      this.openModal(this.timerModal);
    });

    // Physical Keyboard Support (A-Z to slot, Backspace to undo, Enter to complete)
    window.addEventListener('keydown', (e) => {
      if (document.querySelector('.game-modal.active')) return;
      const key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key)) {
        // Find matching letter in available bank
        const bankItem = this.letterBank.find(l => l.char === key && !l.placed);
        if (bankItem) {
          this.slotLetter(bankItem.char, bankItem.id);
        }
      } else if (e.key === 'Backspace') {
        this.unslotActiveOrLast();
      } else if (e.key === 'Enter') {
        this.verifyAnswer();
      }
    });
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  openModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
  }

  closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
  }

  shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

// Kickoff
window.addEventListener('DOMContentLoaded', () => {
  window.game = new SoccerWordGapGame();
});
