// Builds the masked word for a play. Seeded, so the same (word, seed) always gives the same mask,
// but each play gets a fresh seed so a word is not hidden the same way twice.
// difficulty 1..4 -> more gaps and more distractor tiles at higher levels.

function hash(str: string): number {
  let h = 2166136261
  for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function rng(seed: number) {
  let s = seed || 1
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296
}

export interface Mask {
  /** Word with gaps as "_" and words separated by one space, e.g. "TIT_NIC". */
  pattern: string
  /** Hidden letters in gap order. Server-side only. */
  answer: string[]
  /** Hidden letters plus distractors, shuffled. Sent to the player. */
  tiles: string[]
}

export function createMask(rawWord: string, difficulty = 2, seed = 1): Mask {
  const word = rawWord.trim().toUpperCase().replace(/\s+/g, ' ')
  const chars = word.split('')
  const idx: number[] = []
  chars.forEach((c, i) => { if (c >= 'A' && c <= 'Z') idx.push(i) })
  const len = idx.length
  const rand = rng(hash(`${word}:${seed}`))

  let gaps = len <= 3 ? 1 : len <= 8 ? 2 : len <= 12 ? 3 : 4
  gaps += difficulty >= 4 ? 1 : 0
  gaps -= difficulty <= 1 ? 1 : 0
  gaps = Math.max(1, Math.min(gaps, len - 1, Math.ceil(len / 2)))

  // Spread gaps over the letters: one per slice, random position in the slice.
  const chosen = new Set<number>()
  for (let g = 0; g < gaps; g++) {
    const lo = Math.floor((g * len) / gaps)
    const hi = Math.max(lo + 1, Math.floor(((g + 1) * len) / gaps))
    let i = lo + Math.floor(rand() * (hi - lo))
    // Keep the first letter visible on the easiest level.
    if (difficulty <= 1 && i === 0) i = Math.min(len - 1, 1)
    chosen.add(idx[i])
  }
  for (let k = 1; chosen.size < gaps && k < len; k++) chosen.add(idx[k])

  const pattern: string[] = []
  const answer: string[] = []
  chars.forEach((c, i) => {
    if (chosen.has(i)) { pattern.push('_'); answer.push(c) } else pattern.push(c)
  })

  // Distractors: prefer letters that are not in the word at all.
  const inWord = new Set(chars)
  const missSet = new Set(answer)
  const pool = 'ETAOINSRHLDCUMFPGWYBVKXJQZ'.split('')
  const want = difficulty >= 3 ? 5 : 4
  const extra: string[] = []
  const absent = pool.filter(c => !inWord.has(c))
  while (extra.length < want && absent.length) extra.push(absent.splice(Math.floor(rand() * Math.min(absent.length, 9)), 1)[0])
  const present = pool.filter(c => inWord.has(c) && !missSet.has(c) && !extra.includes(c))
  while (extra.length < want && present.length) extra.push(present.shift()!)

  // Fisher-Yates with the same seeded generator.
  const tiles = [...answer, ...extra]
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return { pattern: pattern.join(''), answer, tiles }
}

/** Compact key used to detect the same word across categories ("THE MATRIX" == "THEMATRIX"). */
export const wordKey = (w: string): string => String(w).toUpperCase().replace(/[^A-Z]/g, '')
