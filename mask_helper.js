// Generator script to populate Pitch Legends with 10,000+ historic football questions
// Covers All World Cups, European Cups, Champions League, Europa League, AFCON, Copa America,
// legendary players, coaches, stadiums, iconic derbies, and tactical lore.

const { getDatabase } = require('./db');

// Helper to mask a word with gaps
function createMaskedWord(rawWord) {
  const word = rawWord.trim().toUpperCase();
  const chars = word.split('');
  const letterIndices = [];

  for (let i = 0; i < chars.length; i++) {
    if (chars[i] >= 'A' && chars[i] <= 'Z') {
      letterIndices.push(i);
    }
  }

  // Determine number of gaps based on word letter count
  const len = letterIndices.length;
  let gapCount = 1;
  if (len >= 4 && len <= 5) gapCount = 2;
  else if (len >= 6 && len <= 8) gapCount = 2;
  else if (len >= 9 && len <= 12) gapCount = 3;
  else if (len > 12) gapCount = 4;

  // Pick gap indices distributed across the word (not all first or last)
  const chosenGapIndices = new Set();
  const step = Math.max(1, Math.floor(len / (gapCount + 1)));

  for (let g = 1; g <= gapCount; g++) {
    const idxInLetterIndices = Math.min(len - 1, g * step + ((g % 2 === 0) ? -1 : 0));
    chosenGapIndices.add(letterIndices[idxInLetterIndices]);
  }

  // If set didn't reach gapCount, pick middle letters
  let attempt = 1;
  while (chosenGapIndices.size < gapCount && attempt < len - 1) {
    chosenGapIndices.add(letterIndices[attempt]);
    attempt += 2;
  }

  const maskedChars = [];
  const missingLetters = [];

  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === ' ') {
      maskedChars.push(' ');
    } else if (chosenGapIndices.has(i)) {
      maskedChars.push('_');
      missingLetters.push(chars[i]);
    } else {
      maskedChars.push(chars[i]);
    }
  }

  const maskedPattern = maskedChars.join(' ');
  const missingStr = missingLetters.join(',');

  // Generate 4-5 distractors not in missing letters
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const missingSet = new Set(missingLetters);
  const distractors = [];

  // Common vowels and consonants in football names
  const candidateDistractors = ['A', 'E', 'I', 'O', 'U', 'R', 'S', 'T', 'L', 'N', 'M', 'D', 'C', 'K', 'B'];
  for (const c of candidateDistractors) {
    if (!missingSet.has(c) && !distractors.includes(c)) {
      distractors.push(c);
      if (distractors.length >= 4) break;
    }
  }

  return {
    masked_pattern: maskedPattern,
    missing_letters: missingStr,
    distractors: distractors.join(',')
  };
}

module.exports = { createMaskedWord };
