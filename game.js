// ==========================================================================
// Pitch Legends: Historic Football Gap Puzzle - Core Game Engine
// ==========================================================================

class SoccerPuzzleGame {
  constructor() {
    this.puzzles = window.PUZZLE_DATA || [];
    this.blitzExtra = window.BLITZ_EXTRA_POOL || [];
    this.sound = window.soundCtrl;
    this.particles = null;

    // Game state
    this.currentRealmIndex = 0;
    this.currentPuzzleIndex = 0;
    this.score = 0;
    this.streak = 1;
    this.highestStreak = 1;
    this.solvedCount = 0;
    this.isBlitzMode = false;

    // Modifiable Match Timer configuration
    this.maxTimer = 45; // Default 45s (half time), player can modify anytime
    this.remainingTimer = 45;
    this.timerInterval = null;
    this.isZenMode = false;
    this.speedBonusEnabled = true;
    this.urgencyTickEnabled = true;
    this.timerUrgentThreshold = 10; // seconds

    // Active scenario puzzle session
    this.activePuzzle = null;
    this.slottedWords = [];
    this.activeSlotIdx = 0;
    this.availableWords = [];
    this.usedHints = { clue: false, letter: false, eliminate: false };

    // Tournament eras
    this.tournaments = [
      { id: 'wc', name: 'World Cup Epics', icon: '🏆' },
      { id: 'ucl', name: 'Champions League Miracles', icon: '⭐' },
      { id: 'legends', name: 'Legends & Underdog Fairytales', icon: '🛡️' }
    ];

    this.initElements();
    this.loadPreferences();
    this.bindEvents();
    this.initParticles();
    this.startPuzzle();
  }

  initElements() {
    // HUD
    this.hudRealmIcon = document.getElementById('hud-realm-icon');
    this.hudRealmName = document.getElementById('hud-realm-name');
    this.hudPuzzleStep = document.getElementById('hud-puzzle-step');
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
    this.puzzleTitle = document.getElementById('puzzle-title');
    this.matchTeamsBar = document.getElementById('match-teams-bar');
    this.puzzleDifficulty = document.getElementById('puzzle-difficulty');
    this.sentenceContainer = document.getElementById('sentence-container');
    this.puzzleBoard = document.getElementById('puzzle-board');

    // Word Bank & Actions
    this.wordBankGrid = document.getElementById('word-bank-grid');
    this.checkAnswerBtn = document.getElementById('check-answer-btn');
    this.clearSlotsBtn = document.getElementById('clear-slots-btn');
    this.shuffleWordsBtn = document.getElementById('shuffle-words-btn');

    // Hints
    this.hintClueBtn = document.getElementById('hint-clue-btn');
    this.hintClueText = document.getElementById('hint-clue-text');
    this.hintLetterBtn = document.getElementById('hint-letter-btn');
    this.hintEliminateBtn = document.getElementById('hint-eliminate-btn');

    // Modals
    this.timerModal = document.getElementById('timer-modal');
    this.realmModal = document.getElementById('realm-modal');
    this.victoryModal = document.getElementById('victory-modal');
    this.timeupModal = document.getElementById('timeup-modal');
    this.customModal = document.getElementById('custom-modal');
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
      const savedScore = localStorage.getItem('soccer_score');
      if (savedScore) this.score = parseInt(savedScore, 10);
      this.hudScore.textContent = this.score;

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
      localStorage.setItem('soccer_score', this.score);
      localStorage.setItem('soccer_speed_bonus', this.speedBonusEnabled);
    } catch (e) {}
  }

  initParticles() {
    try {
      this.particles = new ParticleEngine('fx-canvas');
    } catch (e) {
      console.warn('Canvas particle init:', e);
    }
  }

  // ==========================================================================
  // EVENT BINDINGS
  // ==========================================================================
  bindEvents() {
    // Desktop View mode buttons
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

    // Timer HUD button opens Match Timer Configuration Modal
    this.hudTimerBtn.addEventListener('click', () => {
      this.openModal(this.timerModal);
      this.sound.playTap();
    });

    // Whistle sound button
    const whistleBtn = document.getElementById('whistle-sound-btn');
    if (whistleBtn) {
      whistleBtn.addEventListener('click', () => {
        this.sound.playWhistle(false);
      });
    }

    // Sound toggle in HUD
    const soundBtn = document.getElementById('sound-btn');
    soundBtn.addEventListener('click', () => {
      const state = this.sound.toggleSound();
      soundBtn.textContent = state ? '🔊' : '🔇';
      this.sound.playTap();
    });

    // Custom soccer scenario creator trigger
    document.getElementById('custom-puzzle-btn').addEventListener('click', () => {
      this.openModal(this.customModal);
      this.sound.playTap();
    });

    // Settings trigger
    document.getElementById('settings-btn').addEventListener('click', () => {
      this.openModal(this.settingsModal);
      this.sound.playTap();
    });

    // Tournament Era selector trigger
    document.getElementById('realm-pill-btn').addEventListener('click', () => {
      this.renderTournamentModalList();
      this.openModal(this.realmModal);
      this.sound.playTap();
    });

    // Modal close buttons (via data-close)
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

    // Close modals on clicking backdrop
    document.querySelectorAll('.game-modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal);
        }
      });
    });

    // Action buttons
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

    // Hint buttons
    this.hintClueBtn.addEventListener('click', () => this.useClueHint());
    this.hintLetterBtn.addEventListener('click', () => this.useLetterHint());
    this.hintEliminateBtn.addEventListener('click', () => this.useEliminateHint());

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
      this.advanceToNextPuzzle();
    });
    document.getElementById('victory-replay-btn').addEventListener('click', () => {
      this.closeModal(this.victoryModal);
      this.startPuzzle();
    });

    // Time Up modal buttons
    document.getElementById('timeup-retry-btn').addEventListener('click', () => {
      this.closeModal(this.timeupModal);
      this.startPuzzle();
    });
    document.getElementById('timeup-adjust-timer-btn').addEventListener('click', () => {
      this.closeModal(this.timeupModal);
      this.openModal(this.timerModal);
    });

    // Custom puzzle creation submit
    document.getElementById('custom-create-btn').addEventListener('click', () => {
      this.handleCustomPuzzleCreation();
    });

    // Blitz mode card click
    document.getElementById('mode-blitz-card').addEventListener('click', () => {
      this.isBlitzMode = true;
      this.closeModal(this.realmModal);
      this.startPuzzle();
      this.sound.playWhistle(true);
    });

    // Settings modal toggles
    document.getElementById('toggle-sound').addEventListener('change', (e) => {
      this.sound.soundEnabled = e.target.checked;
      document.getElementById('sound-btn').textContent = e.target.checked ? '🔊' : '🔇';
    });
    document.getElementById('toggle-haptics').addEventListener('change', (e) => {
      this.sound.hapticsEnabled = e.target.checked;
    });
    document.getElementById('toggle-particles').addEventListener('change', (e) => {
      if (this.particles) this.particles.isRunning = e.target.checked;
      if (e.target.checked && this.particles) this.particles.start();
    });
    document.getElementById('reset-progress-btn').addEventListener('click', () => {
      if (confirm('Reset your football points, streaks, and progress?')) {
        this.score = 0;
        this.streak = 1;
        this.currentRealmIndex = 0;
        this.currentPuzzleIndex = 0;
        this.savePreferences();
        this.hudScore.textContent = 0;
        this.closeModal(this.settingsModal);
        this.startPuzzle();
      }
    });

    // Keyboard Shortcuts (1-9 to slot words, Backspace to undo, Enter to shoot)
    window.addEventListener('keydown', (e) => {
      if (document.querySelector('.game-modal.active')) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= this.availableWords.length) {
        const wordObj = this.availableWords[num - 1];
        if (wordObj && !wordObj.placed) {
          this.slotWord(wordObj.word, wordObj.id);
        }
      } else if (e.key === 'Backspace') {
        this.unslotActiveOrLast();
      } else if (e.key === 'Enter') {
        this.verifyAnswer();
      }
    });
  }

  // ==========================================================================
  // MODIFIABLE MATCH TIMER LOGIC
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
      ? 'Training Ground active! Relax, analyze the pitch at your own pace.'
      : `Match Clock set to ${this.maxTimer} seconds! Keep your eye on the ball!`;
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
    const solutionText = this.activePuzzle.missingWords.join(', ');
    document.getElementById('timeup-solution').textContent = solutionText;
    this.streak = 1;
    this.updateStreakDisplay();
    this.openModal(this.timeupModal);
  }

  // ==========================================================================
  // SCENARIO INITIALIZATION & RENDERING
  // ==========================================================================
  getActiveCategoryPuzzles() {
    if (this.isBlitzMode) {
      return [...this.puzzles, ...this.blitzExtra];
    }
    const currentTournament = this.tournaments[this.currentRealmIndex];
    return this.puzzles.filter(p => p.realm === currentTournament.name);
  }

  startPuzzle() {
    this.stopTimer();

    const categoryPuzzles = this.getActiveCategoryPuzzles();
    if (this.currentPuzzleIndex >= categoryPuzzles.length) {
      this.currentPuzzleIndex = 0;
    }

    if (this.isBlitzMode) {
      const randomIdx = Math.floor(Math.random() * categoryPuzzles.length);
      this.activePuzzle = categoryPuzzles[randomIdx];
      this.hudRealmIcon.textContent = '⚡';
      this.hudRealmName.textContent = 'Shootout Blitz';
      this.hudPuzzleStep.textContent = `Score: ${this.score}`;
    } else {
      this.activePuzzle = categoryPuzzles[this.currentPuzzleIndex];
      const tournament = this.tournaments[this.currentRealmIndex];
      this.hudRealmIcon.textContent = tournament.icon;
      this.hudRealmName.textContent = tournament.name;
      this.hudPuzzleStep.textContent = `${this.currentPuzzleIndex + 1}/${categoryPuzzles.length}`;
    }

    // Scenario meta
    if (this.scenarioYear) this.scenarioYear.textContent = this.activePuzzle.year || 'HISTORIC';
    this.puzzleTitle.textContent = this.activePuzzle.title;
    if (this.matchTeamsBar) this.matchTeamsBar.textContent = `⚽ ${this.activePuzzle.teams || this.activePuzzle.realm}`;
    this.puzzleDifficulty.textContent = '⭐'.repeat(this.activePuzzle.missingWords.length + 1);

    // Reset hints
    this.usedHints = { clue: false, letter: false, eliminate: false };
    this.hintClueBtn.classList.remove('used');
    this.hintLetterBtn.classList.remove('used');
    this.hintEliminateBtn.classList.remove('used');
    this.hintClueText.textContent = 'Tactical Clue';

    // Reset slots
    this.slottedWords = new Array(this.activePuzzle.missingWords.length).fill(null);
    this.activeSlotIdx = 0;

    // Build word pool (missing words + distractors, shuffled)
    const combinedWords = [...this.activePuzzle.missingWords, ...(this.activePuzzle.distractors || [])];
    this.availableWords = this.shuffleArray(combinedWords).map((word, idx) => ({
      id: `w-${idx}-${word}`,
      word: word.toUpperCase(),
      placed: false
    }));

    this.renderSentence();
    this.renderWordBank();
    this.mascotSpeech.textContent = `Scenario #${this.currentPuzzleIndex + 1}: Fill the gaps to complete this legendary football moment!`;

    // Start modifiable timer
    this.startTimer();
  }

  renderSentence() {
    this.sentenceContainer.innerHTML = '';
    const text = this.activePuzzle.text;
    const parts = text.split(/(\{\{\d+\}\})/g);

    parts.forEach(part => {
      const match = part.match(/\{\{(\d+)\}\}/);
      if (match) {
        const slotIdx = parseInt(match[1], 10);
        const slotEl = document.createElement('button');
        slotEl.className = 'word-slot';
        slotEl.setAttribute('data-slot-idx', slotIdx);
        slotEl.id = `slot-${slotIdx}`;

        const slottedWord = this.slottedWords[slotIdx];
        if (slottedWord) {
          slotEl.classList.add('filled');
          slotEl.innerHTML = `<span>${slottedWord}</span><span class="slot-remove-icon">✕</span>`;
          slotEl.addEventListener('click', () => {
            this.unslotWord(slotIdx);
          });
        } else {
          slotEl.classList.add('empty');
          if (slotIdx === this.activeSlotIdx) {
            slotEl.classList.add('active');
          }
          const expectedWord = this.activePuzzle.missingWords[slotIdx];
          slotEl.innerHTML = `<span class="word-slot-placeholder">[ GAP #${slotIdx + 1} (${expectedWord.length}) ]</span>`;
          slotEl.addEventListener('click', () => {
            this.setActiveSlot(slotIdx);
          });
        }

        this.sentenceContainer.appendChild(slotEl);
      } else if (part.trim().length > 0 || part === ' ') {
        const span = document.createElement('span');
        span.textContent = part;
        this.sentenceContainer.appendChild(span);
      }
    });

    this.updateCheckButtonState();
  }

  renderWordBank() {
    this.wordBankGrid.innerHTML = '';
    this.availableWords.forEach((wordObj) => {
      const chip = document.createElement('button');
      chip.className = 'runic-word-chip';
      if (wordObj.placed) chip.classList.add('placed');
      chip.id = wordObj.id;
      chip.innerHTML = `<span>${wordObj.word}</span>`;

      chip.addEventListener('click', () => {
        if (!wordObj.placed) {
          this.slotWord(wordObj.word, wordObj.id);
        }
      });

      this.wordBankGrid.appendChild(chip);
    });
  }

  setActiveSlot(idx) {
    this.activeSlotIdx = idx;
    document.querySelectorAll('.word-slot.empty').forEach(slot => {
      const slotIdx = parseInt(slot.getAttribute('data-slot-idx'), 10);
      slot.classList.toggle('active', slotIdx === idx);
    });
    this.sound.playTap();
  }

  slotWord(word, wordId) {
    let targetSlot = this.activeSlotIdx;
    if (this.slottedWords[targetSlot] !== null) {
      targetSlot = this.slottedWords.findIndex(w => w === null);
    }
    if (targetSlot === -1) {
      targetSlot = this.activeSlotIdx;
      const oldWord = this.slottedWords[targetSlot];
      const oldObj = this.availableWords.find(w => w.word === oldWord && w.placed);
      if (oldObj) oldObj.placed = false;
    }

    this.slottedWords[targetSlot] = word;
    const wordObj = this.availableWords.find(w => w.id === wordId);
    if (wordObj) wordObj.placed = true;

    const nextEmpty = this.slottedWords.findIndex(w => w === null);
    this.activeSlotIdx = nextEmpty !== -1 ? nextEmpty : targetSlot;

    this.sound.playSlot();
    this.renderSentence();
    this.renderWordBank();

    if (this.slottedWords.every(w => w !== null)) {
      setTimeout(() => {
        this.verifyAnswer();
      }, 200);
    }
  }

  unslotWord(slotIdx) {
    const word = this.slottedWords[slotIdx];
    if (!word) return;

    this.slottedWords[slotIdx] = null;
    this.activeSlotIdx = slotIdx;

    const wordObj = this.availableWords.find(w => w.word === word && w.placed);
    if (wordObj) wordObj.placed = false;

    this.sound.playUnslot();
    this.renderSentence();
    this.renderWordBank();
  }

  unslotActiveOrLast() {
    let slotToClear = this.activeSlotIdx;
    if (this.slottedWords[slotToClear] === null) {
      for (let i = this.slottedWords.length - 1; i >= 0; i--) {
        if (this.slottedWords[i] !== null) {
          slotToClear = i;
          break;
        }
      }
    }
    if (this.slottedWords[slotToClear] !== null) {
      this.unslotWord(slotToClear);
    }
  }

  clearAllSlots() {
    this.slottedWords.fill(null);
    this.availableWords.forEach(w => w.placed = false);
    this.activeSlotIdx = 0;
    this.renderSentence();
    this.renderWordBank();
  }

  shuffleAvailableWords() {
    this.availableWords = this.shuffleArray(this.availableWords);
    this.renderWordBank();
  }

  updateCheckButtonState() {
    const hasAnyFilled = this.slottedWords.some(w => w !== null);
    this.checkAnswerBtn.disabled = !hasAnyFilled;
  }

  // ==========================================================================
  // ANSWER VERIFICATION & CELEBRATION
  // ==========================================================================
  verifyAnswer() {
    const isComplete = this.slottedWords.every(w => w !== null);
    if (!isComplete) {
      this.mascotSpeech.textContent = 'Referee whistle! Fill in all scenario gaps before submitting!';
      this.sound.playWrong();
      this.puzzleBoard.classList.add('shake');
      setTimeout(() => this.puzzleBoard.classList.remove('shake'), 400);
      return;
    }

    const expected = this.activePuzzle.missingWords.map(w => w.toUpperCase());
    const isCorrect = this.slottedWords.every((w, idx) => w === expected[idx]);

    if (isCorrect) {
      this.handleCorrectAnswer();
    } else {
      this.handleWrongAnswer();
    }
  }

  handleCorrectAnswer() {
    this.stopTimer();

    document.querySelectorAll('.word-slot').forEach(slot => {
      slot.classList.add('correct-pulse');
    });

    this.sound.playCorrect(this.streak);
    this.streak++;
    if (this.streak > this.highestStreak) this.highestStreak = this.streak;
    this.updateStreakDisplay();

    // Fireworks & Confetti
    if (this.particles) {
      const rect = this.puzzleBoard.getBoundingClientRect();
      const phoneRect = document.getElementById('phone-frame').getBoundingClientRect();
      const x = rect.left - phoneRect.left + rect.width / 2;
      const y = rect.top - phoneRect.top + rect.height / 2;
      this.particles.burstStars(x, y, 40);
      this.particles.launchConfetti();
    }

    const baseScore = 300;
    const timeScore = this.isZenMode ? 50 : Math.round(this.remainingTimer * 8);
    const streakBonus = Math.round(baseScore * (this.streak * 0.2));
    const roundTotal = baseScore + timeScore + streakBonus;

    this.score += roundTotal;
    this.solvedCount++;
    this.hudScore.textContent = this.score;
    this.savePreferences();

    if (this.speedBonusEnabled && !this.isZenMode) {
      this.addTimeBonus(5);
    }

    document.getElementById('v-base-score').textContent = `+${baseScore}`;
    document.getElementById('v-time-score').textContent = `+${timeScore}`;
    document.getElementById('v-streak-score').textContent = `x${this.streak}`;
    document.getElementById('v-total-score').textContent = `+${roundTotal}`;

    const comments = [
      'WHAT A FINISH! Top corner precision on this historic moment!',
      'GOLAZO! Superb football IQ, you read the game like a tactical genius!',
      'BALLON D\'OR FORM! The crowd is on their feet!',
      'UNSTOPPABLE! What a clinical piece of football history knowledge!'
    ];
    this.mascotSpeech.textContent = comments[Math.floor(Math.random() * comments.length)];

    setTimeout(() => {
      this.sound.playFanfare();
      this.openModal(this.victoryModal);
    }, 650);
  }

  handleWrongAnswer() {
    this.sound.playWrong();
    this.streak = 1;
    this.updateStreakDisplay();

    this.puzzleBoard.classList.add('shake');
    setTimeout(() => this.puzzleBoard.classList.remove('shake'), 400);

    this.mascotSpeech.textContent = 'VAR Review: Off target! Check the players or terms and have another shot.';
  }

  advanceToNextPuzzle() {
    this.currentPuzzleIndex++;
    this.startPuzzle();
  }

  updateStreakDisplay() {
    this.hudStreak.textContent = `x${this.streak}`;
    if (this.streak >= 3) {
      this.hudStreakWrap.style.transform = 'scale(1.15)';
    } else {
      this.hudStreakWrap.style.transform = '';
    }
  }

  // ==========================================================================
  // HINTS SYSTEM
  // ==========================================================================
  useClueHint() {
    if (this.usedHints.clue) return;
    this.usedHints.clue = true;
    this.hintClueBtn.classList.add('used');
    this.hintClueText.textContent = 'Clue Given';
    this.mascotSpeech.textContent = `📋 Tactical Clue: ${this.activePuzzle.hint || 'Think of the teams and decisive match players!'}`;
    this.sound.playSlot();
  }

  useLetterHint() {
    if (this.usedHints.letter) return;
    this.usedHints.letter = true;
    this.hintLetterBtn.classList.add('used');

    const firstLetters = this.activePuzzle.firstLetters || this.activePuzzle.missingWords.map(w => w[0]);
    this.mascotSpeech.textContent = `🔤 Initials: ${firstLetters.map((l, i) => `Gap #${i + 1} starts with '${l}'`).join(', ')}`;
    this.sound.playSlot();
  }

  useEliminateHint() {
    if (this.usedHints.eliminate) return;
    this.usedHints.eliminate = true;
    this.hintEliminateBtn.classList.add('used');

    const missing = this.activePuzzle.missingWords.map(w => w.toUpperCase());
    const distractors = this.availableWords.filter(w => !missing.includes(w.word) && !w.placed);

    if (distractors.length > 0) {
      distractors.slice(0, 2).forEach(d => {
        d.placed = true;
      });
      this.renderWordBank();
      this.mascotSpeech.textContent = '🟥 Substituted 2 incorrect players out of the dugout!';
      this.sound.playUnslot();
    }
  }

  // ==========================================================================
  // TOURNAMENT MODAL & CUSTOM PUZZLE CREATOR
  // ==========================================================================
  renderTournamentModalList() {
    const list = document.getElementById('realm-cards-list');
    list.innerHTML = '';

    this.tournaments.forEach((t, idx) => {
      const card = document.createElement('div');
      card.className = 'realm-card';
      if (!this.isBlitzMode && this.currentRealmIndex === idx) card.classList.add('active');

      const matches = this.puzzles.filter(p => p.realm === t.name);
      card.innerHTML = `
        <div class="realm-card-left">
          <div class="realm-card-icon">${t.icon}</div>
          <div>
            <div class="realm-card-title">${t.name}</div>
            <div class="realm-card-count">${matches.length} Historic Scenarios</div>
          </div>
        </div>
        <span style="font-size: 14px; color: var(--gold-400);">▶</span>
      `;

      card.addEventListener('click', () => {
        this.isBlitzMode = false;
        this.currentRealmIndex = idx;
        this.currentPuzzleIndex = 0;
        this.closeModal(this.realmModal);
        this.startPuzzle();
        this.sound.playWhistle(true);
      });

      list.appendChild(card);
    });
  }

  handleCustomPuzzleCreation() {
    const textInput = document.getElementById('custom-text-input').value.trim();
    const distractorsInput = document.getElementById('custom-distractors-input').value.trim();
    const hintInput = document.getElementById('custom-hint-input').value.trim();

    if (!textInput) {
      alert('Please enter a soccer scenario.');
      return;
    }

    const missingWords = [];
    const parsedText = textInput.replace(/\[(.*?)\]/g, (match, word) => {
      const idx = missingWords.length;
      missingWords.push(word.trim().toUpperCase());
      return `{{${idx}}}`;
    });

    if (missingWords.length === 0) {
      alert('Please enclose at least one missing word in brackets, like [RONALDO] or [VOLLEY]!');
      return;
    }

    const distractors = distractorsInput 
      ? distractorsInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : ['MESSI', 'HEADER', 'CHAMPION', 'GOAL'];

    const customPuzzle = {
      id: `custom-${Date.now()}`,
      realm: 'Custom Pitch',
      realmIcon: '✍️',
      title: 'Custom Historic Scenario',
      teams: 'Friendly Exhibition',
      year: 'CUSTOM',
      text: parsedText,
      missingWords: missingWords,
      distractors: distractors,
      hint: hintInput || 'A user-crafted football scenario.',
      firstLetters: missingWords.map(w => w[0])
    };

    this.activePuzzle = customPuzzle;
    this.closeModal(this.customModal);
    this.hudRealmIcon.textContent = '✍️';
    this.hudRealmName.textContent = 'Custom Scenario';
    this.hudPuzzleStep.textContent = 'Custom';

    this.slottedWords = new Array(missingWords.length).fill(null);
    this.activeSlotIdx = 0;
    const combined = [...missingWords, ...distractors];
    this.availableWords = this.shuffleArray(combined).map((w, i) => ({
      id: `cw-${i}-${w}`,
      word: w,
      placed: false
    }));

    if (this.scenarioYear) this.scenarioYear.textContent = 'CUSTOM';
    this.puzzleTitle.textContent = customPuzzle.title;
    if (this.matchTeamsBar) this.matchTeamsBar.textContent = '⚽ Custom Historic Match';
    this.puzzleDifficulty.textContent = '⭐⭐⭐';
    this.renderSentence();
    this.renderWordBank();
    this.startTimer();
    this.sound.playWhistle(true);
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

// Kickoff game on page load
window.addEventListener('DOMContentLoaded', () => {
  window.game = new SoccerPuzzleGame();
});
