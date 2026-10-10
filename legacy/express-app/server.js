// Express Server for Pitch Legends Soccer Word Puzzle Game
// Dual SQLite / PostgreSQL Support + Phone Session & 30-Day Non-Repeat Logic
const express = require('express');
const path = require('path');
const { getDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Never serve the database, server code, seed files or backups as static files.
const BLOCKED = /^\/(node_modules|legacy|\.git)(\/|$)|\.(db|sqlite|sqlite3)$|^\/entertainment_words\.json$|^\/(server|db|seed|seed_data|seed_entertainment|dedupe_puzzles|entertainment_words|entertainment_seed_data|tournaments_seed_data|generate_10k_puzzles|mask_helper|package|package-lock)(\.js|\.json)$/i;
app.use((req, res, next) => (BLOCKED.test(req.path) ? res.status(404).end() : next()));
app.use(express.static(path.join(__dirname)));

// Clean phone number helper
function normalizePhone(phone) {
  if (!phone) return null;
  // Keep leading +, digits only
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  return cleaned.length >= 7 ? cleaned : null;
}

// ---- Session lifecycle -------------------------------------------------------------------------
// A session is one run (up to four correct in a row). It ends on a win or a miss, and always expires
// 24 hours after it started, even if the player never comes back. Expiry is applied the next time the
// number is seen (session or answer), and the abandoned run is written to play_history.
const SESSION_MS = 24 * 60 * 60 * 1000;
async function resetSession(db, phone, nowIso) {
  await db.run('UPDATE users SET streak = 1, session_points = 0, session_words = 0, session_started_at = ? WHERE phone_number = ?', [nowIso, phone]);
}
async function logHistory(db, phone, u, outcome, endedIso, streak, points, words) {
  await db.run('INSERT INTO play_history (phone_number, started_at, ended_at, outcome, streak, points, words) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [phone, u.session_started_at || null, endedIso, outcome, streak, points, words]);
}
// Returns { user, expired }. Starts a session if none, expires a stale one.
async function ensureSession(db, phone) {
  let user = await db.get('SELECT * FROM users WHERE phone_number = ?', [phone]);
  if (!user) return { user: null, expired: false };
  const now = new Date(), nowIso = now.toISOString();
  const started = user.session_started_at ? new Date(user.session_started_at) : null;
  let expired = false;
  if (!started || isNaN(started)) {
    await resetSession(db, phone, nowIso);
    user = await db.get('SELECT * FROM users WHERE phone_number = ?', [phone]);
  } else if (now - started >= SESSION_MS) {
    const words = user.session_words || 0;
    if (words > 0) await logHistory(db, phone, user, 'expired', new Date(started.getTime() + SESSION_MS).toISOString(), Math.max(0, (user.streak || 1) - 1), user.session_points || 0, words);
    await resetSession(db, phone, nowIso);
    user = await db.get('SELECT * FROM users WHERE phone_number = ?', [phone]);
    expired = words > 0;
  }
  return { user, expired };
}
const expiresAt = u => new Date(new Date(u.session_started_at).getTime() + SESSION_MS).toISOString();

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

    const sess = await ensureSession(db, phone);
    user = sess.user;

    const totalRow = await db.get('SELECT COUNT(DISTINCT word) as total_count FROM puzzles');
    const totalPuzzles = parseInt(totalRow.total_count || totalRow.TOTAL_COUNT || 0, 10);
    const answeredIn30Days = await db.countRecentWords(phone);

    res.json({
      success: true,
      phone_number: user.phone_number,
      score: user.score || 0,
      streak: user.streak || 1,
      wins: user.wins || 0,
      session_points: user.session_points || 0,
      session_words: user.session_words || 0,
      session_expires_at: expiresAt(user),
      session_expired: sess.expired,
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
    const difficulty = parseInt(req.query.difficulty, 10) || null;
    const puzzle = await db.getNextPuzzleForPhone(phone, { category, difficulty });

    if (!puzzle) {
      return res.status(404).json({
        error: 'No puzzles available right now.',
message: "You've played every word we have. Each one comes back 30 days after you last played it."
      });
    }

    // Split missing letters and distractors into arrays for easy frontend consumption
    const missingArr = puzzle.missing_letters.split(',').map(s => s.trim().toUpperCase());
    const distractArr = puzzle.distractors.split(',').map(s => s.trim().toUpperCase());

    res.json({
      id: puzzle.id,
      word: puzzle.word,
      masked_pattern: puzzle.masked_pattern,
      missing_letters: missingArr,
      distractors: distractArr,
      difficulty: puzzle.difficulty,
    });
  } catch (err) {
    console.error('Next puzzle error:', err);
    res.status(500).json({ error: 'Failed to retrieve puzzle', details: err.message });
  }
});

// 3. Record Answer Endpoint: Saves timestamp in user_answers and updates score
app.post('/api/puzzle/answer', async (req, res) => {
  try {
    const { phone_number: rawPhone, puzzle_id, is_correct, time_spent, hints_used, reason } = req.body;
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

    const sess = await ensureSession(db, phone);
    const user = sess.user;
    const oldScore = (user && user.score) || 0;
    const oldStreak = (user && user.streak) || 1;
    let newScore = oldScore;
    let newStreak = oldStreak;
    let wins = (user && user.wins) || 0;
    let sessionPoints = (user && user.session_points) || 0;
    const words = ((user && user.session_words) || 0) + 1;

    let won = false, points = 0;
    if (is_correct) {
      const pz = await db.get('SELECT difficulty FROM puzzles WHERE id = ?', [puzzle_id]);
      const diffMult = 1 + (((pz && pz.difficulty) || 2) - 1) * 0.25;
      const basePoints = 250;
      const speedBonus = Math.max(0, Math.round((45 - (time_spent || 10)) * 6));
      const streakMultiplier = Math.min(3, 1 + (newStreak - 1) * 0.2);
      const hintFactor = hints_used ? 0.6 : 1;
      points = Math.round((basePoints + speedBonus) * streakMultiplier * hintFactor * diffMult);
      newScore += points;
      sessionPoints += points;
      newStreak += 1;
      // Four correct in a row (streak 1 -> 5) wins the run.
      if (newStreak >= 5) { won = true; wins += 1; }
    }

    // The session ends on a win or a miss: report its totals, save them to history, start fresh.
    let summary = null;
    if (won || !is_correct) {
      const outcome = won ? 'won' : ({ skipped: 'skipped', timeout: 'timeout' }[reason] || 'missed');
      const streakTotal = won ? 4 : Math.max(0, oldStreak - 1);
      summary = { outcome, streak: streakTotal, points: sessionPoints, words };
      await logHistory(db, phone, user || {}, outcome, new Date().toISOString(), streakTotal, sessionPoints, words);
      await db.run('UPDATE users SET score = ?, wins = ?, last_active_at = CURRENT_TIMESTAMP WHERE phone_number = ?', [newScore, wins, phone]);
      await resetSession(db, phone, new Date().toISOString());
      newStreak = 1; sessionPoints = 0;
    } else {
      await db.run(
        'UPDATE users SET score = ?, streak = ?, wins = ?, session_points = ?, session_words = ?, last_active_at = CURRENT_TIMESTAMP WHERE phone_number = ?',
        [newScore, newStreak, wins, sessionPoints, words, phone]
      );
    }

    res.json({
      success: true,
      new_score: newScore,
      new_streak: newStreak,
      won,
      wins,
      points_awarded: points,
      session_points: sessionPoints,
      session_ended: !!summary,
      session_summary: summary,
      session_expired: sess.expired
    });
  } catch (err) {
    console.error('Answer record error:', err);
    res.status(500).json({ error: 'Failed to record answer', details: err.message });
  }
});

// Play history for a phone number: finished sessions, newest first, plus totals.
app.get('/api/history', async (req, res) => {
  try {
    const phone = normalizePhone(req.query.phone_number);
    if (!phone) return res.status(400).json({ error: 'phone_number query parameter is required.' });
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const db = await getDatabase();
    const sessions = await db.query(
      'SELECT started_at, ended_at, outcome, streak, points, words FROM play_history WHERE phone_number = ? ORDER BY id DESC LIMIT ' + limit, [phone]);
    const t = await db.get(
      `SELECT COUNT(*) AS sessions, COALESCE(SUM(CASE WHEN outcome = 'won' THEN 1 ELSE 0 END), 0) AS wins,
              COALESCE(MAX(points), 0) AS best_points, COALESCE(MAX(streak), 0) AS best_streak, COALESCE(SUM(words), 0) AS words
       FROM play_history WHERE phone_number = ?`, [phone]);
    const n = k => parseInt((t && (t[k] ?? t[k.toUpperCase()])) || 0, 10);
    res.json({ sessions, totals: { sessions: n('sessions'), wins: n('wins'), best_points: n('best_points'), best_streak: n('best_streak'), words: n('words') } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load history', details: err.message });
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
  try { await require('./dedupe_puzzles').ensureDeduped(); } catch (e) { console.error('Dedupe failed:', e.message); }
  try { await require('./seed_entertainment').ensureEntertainment(); } catch (e) { console.error('Entertainment seed failed:', e.message); }
  app.listen(PORT, () => {
    console.log(`Pitch Legends Server running on http://localhost:${PORT} [DB: ${db.type}]`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
