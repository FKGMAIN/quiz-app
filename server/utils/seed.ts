// Puzzle bank seeding. The bank lives in server/database/seed/puzzles.json as
// [word, category, domain, difficulty] rows. Seeding only adds words that are missing; it never
// deletes, so players' history is never orphaned. Edit the JSON and restart to add words.

export type SeedRow = [string, string, string, number]

export async function seedPuzzles(db: Db, rows: SeedRow[]): Promise<number> {
  const have = new Set((await db.query('SELECT word_key FROM puzzles')).map(r => r.word_key))
  const fresh: SeedRow[] = []
  for (const row of rows) {
    const [word, category, domain, difficulty] = row
    const w = String(word).trim().toUpperCase().replace(/\s+/g, ' ')
    const key = wordKey(w)
    if (!/^[A-Z ]{3,60}$/.test(w) || have.has(key)) continue
    have.add(key)
    fresh.push([w, category, domain === 'football' ? 'football' : 'entertainment', Math.max(1, Math.min(4, Number(difficulty) || 2))])
  }
  if (!fresh.length) return 0
  await db.tx(async tx => {
    for (const [word, category, domain, difficulty] of fresh) {
      await tx.run(
        'INSERT INTO puzzles (word, word_key, category, domain, difficulty) VALUES (?, ?, ?, ?, ?) ON CONFLICT (word_key) DO NOTHING',
        [word, wordKey(word), category, domain, difficulty]
      )
    }
  })
  console.log(`[db] seeded ${fresh.length} puzzles`)
  return fresh.length
}

export async function seedFromAssets(db: Db): Promise<void> {
  const raw: any = await useStorage('assets:seed').getItem('puzzles.json')
  if (!raw) return
  const rows: SeedRow[] = typeof raw === 'string' ? JSON.parse(raw) : raw
  await seedPuzzles(db, rows)
}
