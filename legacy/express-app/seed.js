// Database population script for Soccer Word Gap Puzzles
// Seeds All World Cups, European Cups, Champions League, Europa League, & African Cups (AFCON)
const { getDatabase } = require('./db');
const { SEED_WORDS } = require('./seed_data');
const { TOURNAMENTS_WORDS } = require('./tournaments_seed_data');

async function seedDatabase() {
  const db = await getDatabase();
  console.log(`Using database type: ${db.type}`);

  // Combine both word lists, filtering duplicates by unique combination of (word + clue)
  const combined = [...SEED_WORDS];
  for (const item of TOURNAMENTS_WORDS) {
    if (!combined.some(existing => existing.word.toUpperCase() === item.word.toUpperCase() && existing.clue === item.clue)) {
      combined.push(item);
    }
  }

  console.log(`Total questions in combined tournament dataset: ${combined.length}`);

  // Clear existing if needed or insert new words
  await db.exec('DELETE FROM puzzles;');

  console.log(`Seeding ${combined.length} historic football word puzzles into ${db.type}...`);

  for (const item of combined) {
    await db.run(
      `INSERT INTO puzzles (word, category, clue, masked_pattern, missing_letters, distractors, year, team, difficulty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.word.toUpperCase(),
        item.category,
        item.clue,
        item.masked_pattern.toUpperCase(),
        item.missing_letters.toUpperCase(),
        item.distractors.toUpperCase(),
        item.year || 'HISTORIC',
        item.team || 'Football Legend',
        item.difficulty || 2
      ]
    );
  }

  const finalCount = await db.get('SELECT COUNT(*) as count FROM puzzles');
  console.log(`Successfully populated database! Total puzzles in database: ${finalCount.count || finalCount.COUNT}`);
}

if (require.main === module) {
  seedDatabase().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}

module.exports = { seedDatabase };
