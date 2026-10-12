// Public, self-contained page for a shared session: /s/<session id>. Works without the app loading,
// and carries Open Graph tags so a link pasted into WhatsApp or X shows the result.

const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export function renderSharePage(r: NonNullable<Awaited<ReturnType<typeof sessionRecap>>>, origin: string): string {
  const fmt = (n: number) => n.toLocaleString('en-US')
  const title = `Pitch Legends: ${r.streaks_won} ${r.streaks_won === 1 ? 'streak' : 'streaks'}, ${fmt(r.points)} pts`
  const desc = r.share_text.split('\n').slice(2).join('  ') || r.outcome_text
  const rows = r.streaks.map((st) => `
      <div class="row">
        <span class="lbl">${st.compulsory ? 'Final' : `Streak ${st.no}`}<small>x${esc(st.multiplier)}</small></span>
        <span class="cells">${st.cells.map((c) => `<i class="${c}"></i>`).join('')}</span>
      </div>`).join('')
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Pitch Legends">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(`${origin}/s/${r.id}`)}"><meta name="twitter:card" content="summary">
<meta name="robots" content="noindex">
<style>
:root{--bg:#0e1a14;--surface:#16271f;--line:rgba(242,245,238,.16);--ink:#f2f5ee;--muted:#9db0a3;--accent:#c8f169;--accentInk:#10200a;--ok:#79e3a6;--hint:#e8b64c;--bad:#ff8573;color-scheme:dark}
@media (prefers-color-scheme:light){:root{--bg:#f4f2ea;--surface:#fff;--line:rgba(20,32,26,.18);--ink:#14201a;--muted:#53604f;--accent:#b9e24b;--accentInk:#14201a;--ok:#17803f;--hint:#b7791f;--bad:#c8321c;color-scheme:light}}
*{box-sizing:border-box;margin:0}body{min-height:100vh;display:flex;justify-content:center;background:var(--bg);color:var(--ink);font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{width:100%;max-width:440px;padding:32px 20px;display:flex;flex-direction:column;gap:18px}
.eyebrow{font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
h1{font-size:34px;line-height:1.05;font-weight:800}.sub{color:var(--muted);font-weight:600}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{padding:14px 8px;border-radius:16px;background:var(--surface);border:1px solid var(--line);text-align:center}
.card b{display:block;font-size:24px;font-weight:800}.card span{font-size:12px;font-weight:600;color:var(--muted)}
.grid{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:16px;background:var(--surface);border:1px solid var(--line)}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px}.lbl{font-weight:700}.lbl small{margin-left:6px;color:var(--muted);font-weight:600}
.cells{display:flex;gap:6px}.cells i{width:26px;height:26px;border-radius:7px;background:var(--ok)}.cells i.hint{background:var(--hint)}.cells i.miss{background:var(--bad)}
.legend{font-size:13px;color:var(--muted)}
a.cta{display:block;text-align:center;padding:16px;border-radius:16px;background:var(--accent);color:var(--accentInk);font-weight:700;text-decoration:none}
</style></head>
<body><main>
  <div><div class="eyebrow">${esc(r.player)} · ${esc(r.day)}</div><h1>${esc(r.outcome_text)}</h1></div>
  <div class="stats">
    <div class="card"><b>${fmt(r.points)}</b><span>points</span></div>
    <div class="card"><b>${r.streaks_won}</b><span>${r.streaks_won === 1 ? 'streak' : 'streaks'}</span></div>
    <div class="card"><b>${r.rank ? `#${r.rank}` : '—'}</b><span>${r.rank ? `of ${r.players} today` : 'on the board'}</span></div>
  </div>
  ${rows ? `<div class="grid">${rows}</div><div class="legend">Green: solved. Yellow: solved with a hint. Red: missed. The words stay secret.</div>` : ''}
  <a class="cta" href="/">Play Pitch Legends</a>
</main></body></html>`
}
