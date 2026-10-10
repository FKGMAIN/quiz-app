// Builds the masked word for a puzzle. Deterministic per word, so re-seeding never changes a mask.
// difficulty 1..4 -> more gaps and fewer "easy" gaps at higher levels.
function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = seed || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

function createMaskedWord(rawWord, difficulty = 2) {
  const word = rawWord.trim().toUpperCase().replace(/\s+/g, ' ');
  const chars = word.split('');
  const idx = [];
  chars.forEach((c, i) => { if (c >= 'A' && c <= 'Z') idx.push(i); });
  const len = idx.length;
  const rand = rng(hash(word));

  let gaps = len <= 3 ? 1 : len <= 8 ? 2 : len <= 12 ? 3 : 4;
  gaps += difficulty >= 4 ? 1 : 0;
  gaps -= difficulty <= 1 ? 1 : 0;
  gaps = Math.max(1, Math.min(gaps, len - 1, Math.ceil(len / 2)));

  // Spread gaps over the letters: one per slice, random position in the slice.
  const chosen = new Set();
  for (let g = 0; g < gaps; g++) {
    const lo = Math.floor((g * len) / gaps), hi = Math.max(lo + 1, Math.floor(((g + 1) * len) / gaps));
    let i = lo + Math.floor(rand() * (hi - lo));
    // Don't hide the very first letter on the easiest level.
    if (difficulty <= 1 && i === 0) i = Math.min(len - 1, 1);
    chosen.add(idx[i]);
  }
  for (let k = 1; chosen.size < gaps && k < len; k++) chosen.add(idx[k]);

  const masked = [], missing = [];
  chars.forEach((c, i) => {
    if (c === ' ') masked.push(' ');
    else if (chosen.has(i)) { masked.push('_'); missing.push(c); }
    else masked.push(c);
  });

  // Distractors: prefer letters that are not in the word at all.
  const inWord = new Set(chars), missSet = new Set(missing);
  const pool = 'ETAOINSRHLDCUMFPGWYBVKXJQZ'.split('');
  const want = difficulty >= 3 ? 5 : 4;
  const out = [];
  const absent = pool.filter(c => !inWord.has(c));
  while (out.length < want && absent.length) out.push(absent.splice(Math.floor(rand() * Math.min(absent.length, 9)), 1)[0]);
  const present = pool.filter(c => inWord.has(c) && !missSet.has(c) && !out.includes(c));
  while (out.length < want && present.length) out.push(present.shift());

  return { masked_pattern: masked.join(' '), missing_letters: missing.join(','), distractors: out.join(',') };
}

// Difficulty 1..4 from a base tier (1 easy, 2 medium, 3 hard) and the word length.
function difficultyFor(word, tier = 2) {
  const n = word.replace(/ /g, '').length;
  return Math.max(1, Math.min(4, tier + (n >= 12 ? 1 : 0) - (n <= 5 ? 1 : 0)));
}

module.exports = { createMaskedWord, difficultyFor };
