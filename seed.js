// Database population script for Soccer Word Gap Puzzles
const { getDatabase } = require('./db');
const { SEED_WORDS } = require('./seed_data');

async function seedDatabase() {
  const db = await getDatabase();
  console.log(`Using database type: ${db.type}`);

  // Check current count
  const countRow = await db.get('SELECT COUNT(*) as count FROM puzzles');
  const count = parseInt(countRow.count || countRow.COUNT || 0, 10);
  console.log(`Current puzzles in database: ${count}`);

  if (count >= SEED_WORDS.length) {
    console.log('Database already populated with words.');
    return;
  }

  // Clear existing if needed or insert new words
  await db.exec('DELETE FROM puzzles;');

  console.log(`Seeding ${SEED_WORDS.length} historic football word puzzles...`);

  for (const item of SEED_WORDS) {
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
        item.year,
        item.team,
        item.difficulty || 2
      ]
    );
  }

  const finalCount = await db.get('SELECT COUNT(*) as count FROM puzzles');
  console.log(`Successfully populated database! Total puzzles: ${finalCount.count}`);
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
