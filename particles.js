// High-performance Canvas FX (Ambient Motes, Star Bursts, Confetti)
class ParticleEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.motes = [];
    this.sparks = [];
    this.confetti = [];
    this.isRunning = false;
    this.resize();

    window.addEventListener('resize', () => this.resize());
    this.initMotes();
    this.start();
  }

  resize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement || document.body;
    this.width = this.canvas.width = parent.clientWidth || window.innerWidth;
    this.height = this.canvas.height = parent.clientHeight || window.innerHeight;
  }

  initMotes() {
    this.motes = [];
    const count = Math.min(25, Math.floor(this.width / 18));
    for (let i = 0; i < count; i++) {
      this.motes.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: Math.random() * 2.5 + 1,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: -Math.random() * 0.5 - 0.2,
        opacity: Math.random() * 0.7 + 0.3,
        hue: Math.random() > 0.5 ? 45 : 190 // Gold and Cyan/Teal
      });
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const loop = () => {
      this.update();
      this.render();
      if (this.isRunning) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  burstStars(x, y, count = 28) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 6 + 3;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 5 + 3,
        life: 1,
        decay: Math.random() * 0.03 + 0.02,
        color: ['#fbbf24', '#f59e0b', '#38bdf8', '#a855f7', '#ffffff'][Math.floor(Math.random() * 5)],
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.2
      });
    }
  }

  launchConfetti() {
    const colors = ['#f43f5e', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#fbbf24'];
    const count = 100;
    for (let i = 0; i < count; i++) {
      this.confetti.push({
        x: this.width * (0.2 + Math.random() * 0.6),
        y: this.height + 10,
        vx: (Math.random() - 0.5) * 12,
        vy: -(Math.random() * 12 + 10),
        sizeX: Math.random() * 8 + 6,
        sizeY: Math.random() * 14 + 8,
        gravity: 0.35,
        drag: 0.98,
        life: 1,
        decay: Math.random() * 0.008 + 0.005,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2
      });
    }
  }

  update() {
    // Ambient Motes
    for (const m of this.motes) {
      m.x += m.speedX;
      m.y += m.speedY;
      if (m.y < -10) {
        m.y = this.height + 10;
        m.x = Math.random() * this.width;
      }
      if (m.x < -10) m.x = this.width + 10;
      if (m.x > this.width + 10) m.x = -10;
    }

    // Star Sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.15; // Gravity
      s.vx *= 0.96;
      s.rot += s.vrot;
      s.life -= s.decay;
      if (s.life <= 0) {
        this.sparks.splice(i, 1);
      }
    }

    // Confetti
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.x += c.vx;
      c.y += c.vy;
      c.vy += c.gravity;
      c.vx *= c.drag;
      c.rot += c.rotSpeed;
      c.life -= c.decay;
      if (c.y > this.height + 50 || c.life <= 0) {
        this.confetti.splice(i, 1);
      }
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw Motes
    for (const m of this.motes) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `hsla(${m.hue}, 90%, 65%, ${m.opacity * 0.5})`;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = `hsl(${m.hue}, 90%, 65%)`;
      this.ctx.fill();
      this.ctx.restore();
    }

    // Draw Sparks
    for (const s of this.sparks) {
      this.ctx.save();
      this.ctx.translate(s.x, s.y);
      this.ctx.rotate(s.rot);
      this.ctx.fillStyle = s.color;
      this.ctx.globalAlpha = Math.max(0, s.life);
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = s.color;

      // Draw 4-point star
      const size = s.size * s.life;
      this.ctx.beginPath();
      for (let j = 0; j < 4; j++) {
        this.ctx.lineTo(Math.cos((j * Math.PI) / 2) * size, Math.sin((j * Math.PI) / 2) * size);
        this.ctx.lineTo(Math.cos((j * Math.PI) / 2 + Math.PI / 4) * (size * 0.35), Math.sin((j * Math.PI) / 2 + Math.PI / 4) * (size * 0.35));
      }
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    }

    // Draw Confetti
    for (const c of this.confetti) {
      this.ctx.save();
      this.ctx.translate(c.x, c.y);
      this.ctx.rotate(c.rot);
      this.ctx.fillStyle = c.color;
      this.ctx.globalAlpha = Math.max(0, c.life);
      this.ctx.fillRect(-c.sizeX / 2, -c.sizeY / 2, c.sizeX, c.sizeY);
      this.ctx.restore();
    }
  }
}
