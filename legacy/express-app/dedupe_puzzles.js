// Idempotent clean-up: removes repeated words (same letters, any category), keeping the lowest id,
// and re-points players' history at the kept id so 30-day cooldowns still hold.
// Also assigns difficulty to football words. Run at startup or with `npm run dedupe`.
const { getDatabase } = require('./db');
const { difficultyFor } = require('./mask_helper');
const key = w => String(w).toUpperCase().replace(/[^A-Z]/g, '');

async function ensureDeduped() {
  const db = await getDatabase();
  const rows = await db.query('SELECT id, word FROM puzzles ORDER BY id');
  const keep = new Map(), dups = [];
  for (const r of rows) {
    const k = key(r.word);
    if (keep.has(k)) dups.push([r.id, keep.get(k)]); else keep.set(k, r.id);
  }
  if (dups.length) {
    await db.begin();
    try {
      for (const [dupId, keepId] of dups) {
        await db.run('UPDATE user_answers SET puzzle_id = ? WHERE puzzle_id = ?', [keepId, dupId]);
        await db.run('UPDATE user_served SET puzzle_id = ? WHERE puzzle_id = ?', [keepId, dupId]);
      }
      for (let i = 0; i < dups.length; i += 500) {
        const ids = dups.slice(i, i + 500).map(d => d[0]);
        await db.run(`DELETE FROM puzzles WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
      }
      await db.commit();
    } catch (e) { await db.rollback(); throw e; }
    console.log(`Dedupe: removed ${dups.length} repeated puzzles, ${keep.size} distinct words remain`);
  }
  // Football difficulty (one-off: only rows still on the default marker).
  const fb = await db.query("SELECT id, word FROM puzzles WHERE domain = 'football' AND difficulty IS NOT NULL AND difficulty <> 0 AND tuned = 0");
  if (fb.length) {
    await db.begin();
    try {
      for (const r of fb) await db.run('UPDATE puzzles SET difficulty = ?, tuned = 1 WHERE id = ?', [difficultyFor(r.word, 2), r.id]);
      await db.commit();
    } catch (e) { await db.rollback(); throw e; }
  }
  return dups.length;
}

if (require.main === module) {
  ensureDeduped().then(n => { console.log(`Done. ${n} removed.`); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
}
module.exports = { ensureDeduped };
