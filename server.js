// Express Server for Pitch Legends Soccer Word Puzzle Game
// Dual SQLite / PostgreSQL Support + Phone Session & 30-Day Non-Repeat Logic
const express = require('express');
const path = require('path');
const { getDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Clean phone number helper
function normalizePhone(phone) {
  if (!phone) return null;
  // Keep leading +, digits only
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  return cleaned.length >= 7 ? cleaned : null;
}

// 1. Session Endpoint: Initialize or Fetch Player Profile by Phone Number
app.post('/api/session', async (req, res) => {
  try {
    const rawPhone = req.body.phone_number;
    const phone = normalizePhone(rawPhone);

    if (!phone) {
      return res.status(400).json({ error: 'Valid phone number is required (at least 7 digits).' });
    }

    const db = await getDatabase();

    // Check if user exists
    let user = await db.get('SELECT * FROM users WHERE phone_number = ?', [phone]);

    if (!user) {
      await db.run(
        'INSERT INTO users (phone_number, score, streak) VALUES (?, 0, 1)',
        [phone]
      );
      user = { phone_number: phone, score: 0, streak: 1 };
    } else {
      // Update last active
      await db.run('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE phone_number = ?', [phone]);
    }

    // Get count of puzzles answered in the last 30 days
    let answeredRow;
    if (db.type === 'postgres') {
      answeredRow = await db.get(`
        SELECT COUNT(DISTINCT puzzle_id) as answered_count
        FROM user_answers
        WHERE phone_number = $1
        AND answered_at > NOW() - INTERVAL '30 days';
      `, [phone]);
    } else {
      answeredRow = await db.get(`
        SELECT COUNT(DISTINCT puzzle_id) as answered_count
        FROM user_answers
        WHERE phone_number = ?
        AND answered_at > datetime('now', '-30 days');
      `, [phone]);
    }

    const totalRow = await db.get('SELECT COUNT(*) as total_count FROM puzzles');
    const totalPuzzles = parseInt(totalRow.total_count || totalRow.TOTAL_COUNT || 0, 10);
    const answeredIn30Days = parseInt(answeredRow.answered_count || 0, 10);

    res.json({
      success: true,
      phone_number: user.phone_number,
      score: user.score || 0,
      streak: user.streak || 1,
      total_puzzles: totalPuzzles,
      answered_in_30_days: answeredIn30Days,
      remaining_available: Math.max(0, totalPuzzles - answeredIn30Days),
      db_type: db.type
    });
  } catch (err) {
    console.error('Session error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// 2. Next Puzzle Endpoint: Excludes questions answered in past 30 days
app.get('/api/puzzle/next', async (req, res) => {
  try {
    const rawPhone = req.query.phone_number;
    const category = req.query.category || null;
    const phone = normalizePhone(rawPhone);

    if (!phone) {
      return res.status(400).json({ error: 'phone_number query parameter is required.' });
    }

    const db = await getDatabase();
    const puzzle = await db.getNextPuzzleForPhone(phone, category);

    if (!puzzle) {
      return res.status(404).json({
        error: 'No puzzles available right now.',
        message: 'You have answered all available historic questions within the last 30 days! Check back soon or practice in custom mode.'
      });
    }

    // Split missing letters and distractors into arrays for easy frontend consumption
    const missingArr = puzzle.missing_letters.split(',').map(s => s.trim().toUpperCase());
    const distractArr = puzzle.distractors.split(',').map(s => s.trim().toUpperCase());

    res.json({
      id: puzzle.id,
      word: puzzle.word,
      category: puzzle.category,
      clue: puzzle.clue,
      masked_pattern: puzzle.masked_pattern,
      missing_letters: missingArr,
      distractors: distractArr,
      year: puzzle.year,
      team: puzzle.team,
      difficulty: puzzle.difficulty,
      recycled_after_30_days: !!puzzle._recycledAfter30Days
    });
  } catch (err) {
    console.error('Next puzzle error:', err);
    res.status(500).json({ error: 'Failed to retrieve puzzle', details: err.message });
  }
});

// 3. Record Answer Endpoint: Saves timestamp in user_answers and updates score
app.post('/api/puzzle/answer', async (req, res) => {
  try {
    const { phone_number: rawPhone, puzzle_id, is_correct, time_spent } = req.body;
    const phone = normalizePhone(rawPhone);

    if (!phone || !puzzle_id) {
      return res.status(400).json({ error: 'phone_number and puzzle_id are required.' });
    }

    const db = await getDatabase();

    // Insert answer history record with timestamp
    await db.run(
      'INSERT INTO user_answers (phone_number, puzzle_id, is_correct) VALUES (?, ?, ?)',
      [phone, puzzle_id, is_correct ? 1 : 0]
    );

    // Update user stats
    const user = await db.get('SELECT * FROM users WHERE phone_number = ?', [phone]);
    let newScore = (user && user.score) || 0;
    let newStreak = (user && user.streak) || 1;

    if (is_correct) {
      const basePoints = 250;
      const speedBonus = Math.max(0, Math.round((45 - (time_spent || 10)) * 6));
      const streakMultiplier = Math.min(3, 1 + (newStreak - 1) * 0.2);
      const points = Math.round((basePoints + speedBonus) * streakMultiplier);

      newScore += points;
      newStreak += 1;
    } else {
      newStreak = 1;
    }

    await db.run(
      'UPDATE users SET score = ?, streak = ?, last_active_at = CURRENT_TIMESTAMP WHERE phone_number = ?',
      [newScore, newStreak, phone]
    );

    res.json({
      success: true,
      new_score: newScore,
      new_streak: newStreak
    });
  } catch (err) {
    console.error('Answer record error:', err);
    res.status(500).json({ error: 'Failed to record answer', details: err.message });
  }
});

// 4. Categories list endpoint
app.get('/api/categories', async (req, res) => {
  try {
    const db = await getDatabase();
    const rows = await db.query(`
      SELECT category, COUNT(*) as count 
      FROM puzzles 
      GROUP BY category 
      ORDER BY count DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Initialize DB and launch server
async function start() {
  const db = await getDatabase();
  app.listen(PORT, () => {
    console.log(`Pitch Legends Server running on http://localhost:${PORT} [DB: ${db.type}]`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
