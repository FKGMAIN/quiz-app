// Additive seeding of entertainment words from entertainment_words.json ([word, category, tier]).
// Safe to run repeatedly: only inserts words missing from the table (any category), never deletes.
const fs = require('fs');
const path = require('path');
const { getDatabase } = require('./db');
const { createMaskedWord, difficultyFor } = require('./mask_helper');

const key = w => String(w).toUpperCase().replace(/[^A-Z]/g, '');

async function ensureEntertainment() {
  const file = path.join(__dirname, 'entertainment_words.json');
  if (!fs.existsSync(file)) return 0;
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const db = await getDatabase();
  const have = new Set((await db.query('SELECT word FROM puzzles')).map(r => key(r.word)));
  let added = 0;
  await db.begin();
  try {
    for (const [raw, category, tier] of rows) {
      const word = raw.trim().toUpperCase();
      if (!/^[A-Z ]{4,60}$/.test(word) || have.has(key(word))) continue;
      const d = difficultyFor(word, tier);
      const m = createMaskedWord(word, d);
      await db.run(
        `INSERT INTO puzzles (word, category, clue, masked_pattern, missing_letters, distractors, year, team, difficulty, domain)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'entertainment')`,
        [word, category, '', m.masked_pattern, m.missing_letters, m.distractors, null, null, d]
      );
      have.add(key(word));
      added++;
    }
    await db.commit();
  } catch (e) { await db.rollback(); throw e; }
  if (added) console.log(`Entertainment seed: added ${added} words`);
  return added;
}

if (require.main === module) {
  ensureEntertainment().then(n => { console.log(`Done. ${n} new words.`); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
}
module.exports = { ensureEntertainment };
