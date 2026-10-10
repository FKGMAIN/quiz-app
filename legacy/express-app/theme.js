// Light / dark / auto theme. "auto" follows the device and stores nothing.
(function () {
  const KEY = 'soccer_theme';
  const root = document.documentElement;
  const meta = document.getElementById('meta-theme-color');
  const COLORS = { dark: '#0e1a14', light: '#f4f2ea' };
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;

  const saved = () => { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch (e) { return null; } };
  const system = () => (mq && mq.matches ? 'light' : 'dark');

  function paint() {
    const choice = saved() || 'auto';
    const theme = saved() || system();
    root.setAttribute('data-theme', theme);
    if (meta) meta.setAttribute('content', COLORS[theme]);
    document.querySelectorAll('[data-theme-choice]').forEach(b => b.classList.toggle('active', b.dataset.themeChoice === choice));
  }

  function choose(choice) {
    try { choice === 'auto' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, choice); } catch (e) {}
    paint();
  }

  window.addEventListener('DOMContentLoaded', () => {
    paint();
    document.querySelectorAll('[data-theme-choice]').forEach(b => b.addEventListener('click', () => choose(b.dataset.themeChoice)));
    if (mq) mq.addEventListener('change', () => { if (!saved()) paint(); });
  });
})();
