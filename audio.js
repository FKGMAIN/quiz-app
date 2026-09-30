// Fast, zero-dependency Web Audio API Sound Synthesizer for Soccer Puzzle Game
class SoundController {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.hapticsEnabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Referee whistle sound (trill modulation)
  playWhistle(isShort = false) {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const duration = isShort ? 0.25 : 0.55;

    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const mainGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2600, t);

    // Whistle trill vibration
    lfo.type = 'sawtooth';
    lfo.frequency.setValueAtTime(32, t);
    lfoGain.gain.setValueAtTime(140, t);

    lfo.connect(osc.frequency);

    mainGain.gain.setValueAtTime(0, t);
    mainGain.gain.linearRampToValueAtTime(0.28, t + 0.04);
    mainGain.gain.setValueAtTime(0.28, t + duration - 0.08);
    mainGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(mainGain);
    mainGain.connect(this.ctx.destination);

    lfo.start(t);
    osc.start(t);
    lfo.stop(t + duration);
    osc.stop(t + duration);

    this.vibrate([30, 20, 40]);
  }

  // Tactical tap on card or word tile
  playTap() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.05);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.05);
    this.vibrate(15);
  }

  // Ball kick / Slotting sound
  playSlot() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Deep ball kick impact
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.12);
    this.vibrate(28);
  }

  playUnslot() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.07);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.07);
    this.vibrate(18);
  }

  // GOAAAL! / Scenario Completed Correctly
  playCorrect(streak = 1) {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Upbeat stadium fanfare
    const baseFreq = 440 * Math.min(1 + (streak - 1) * 0.08, 1.7);
    const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2];

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = t + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.38);
    });

    this.vibrate([40, 30, 80]);
  }

  // Foul / Incorrect Scenario Submission
  playWrong() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';

    osc1.frequency.setValueAtTime(130, t);
    osc1.frequency.linearRampToValueAtTime(95, t + 0.25);

    osc2.frequency.setValueAtTime(138, t);
    osc2.frequency.linearRampToValueAtTime(102, t + 0.25);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.25);
    osc2.stop(t + 0.25);

    this.vibrate([80, 50, 80]);
  }

  // Stoppage time / Urgent countdown tick
  playTick(isUrgent = false) {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isUrgent ? 950 : 640, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.035);

    gain.gain.setValueAtTime(isUrgent ? 0.22 : 0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.035);
    if (isUrgent) this.vibrate(15);
  }

  // Championship Trophy Fanfare
  playFanfare() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const chords = [
      { notes: [523.25, 659.25, 783.99], time: 0, duration: 0.18 },
      { notes: [587.33, 739.99, 880.00], time: 0.2, duration: 0.18 },
      { notes: [659.25, 830.61, 987.77], time: 0.4, duration: 0.22 },
      { notes: [783.99, 987.77, 1046.50, 1318.51], time: 0.65, duration: 0.7 }
    ];

    chords.forEach(chord => {
      chord.notes.forEach(note => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const st = t + chord.time;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note, st);

        gain.gain.setValueAtTime(0, st);
        gain.gain.linearRampToValueAtTime(0.2 / chord.notes.length * 2.5, st + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, st + chord.duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(st);
        osc.stop(st + chord.duration);
      });
    });

    this.vibrate([60, 40, 100, 50, 150]);
  }

  playTimeBonus() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(1040, t + 0.18);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  vibrate(pattern) {
    if (this.hapticsEnabled && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    return this.soundEnabled;
  }

  toggleHaptics() {
    this.hapticsEnabled = !this.hapticsEnabled;
    return this.hapticsEnabled;
  }
}

window.soundCtrl = new SoundController();
