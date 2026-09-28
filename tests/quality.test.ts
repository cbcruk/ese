import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import emojiData from 'unicode-emoji-json/data-by-emoji.json'
import { describe, test, expect } from 'vitest'
import { EmojiSearch } from '../src/index.js'
import { QUALITY_SUITES } from './quality/quality.cases.ts'
import type { QualityBaseline, QualityMetrics } from './quality/quality.types.ts'
import { computeMetrics, rankCases, roundMetrics } from './quality/quality.utils.ts'

const BASELINE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'quality/quality.baseline.json',
)
const UPDATE_BASELINE = process.env.UPDATE_QUALITY_BASELINE === '1'

const search = new EmojiSearch()
const queryEmojis = (query: string): string[] => search.query(query).map((r) => r.emoji)

const ranksBySuite = new Map(QUALITY_SUITES.map((s) => [s.name, rankCases(s.cases, queryEmojis)]))
const current: QualityBaseline = Object.fromEntries(
  QUALITY_SUITES.map((s) => [s.name, roundMetrics(computeMetrics(ranksBySuite.get(s.name)!))]),
)

describe('quality labels', () => {
  test('every labeled emoji exists in the dataset', () => {
    const known = new Set(Object.keys(emojiData))
    const unknown = QUALITY_SUITES.flatMap((s) =>
      s.cases.flatMap((c) =>
        c.relevant.filter((e) => !known.has(e)).map((e) => `${c.query} → ${e}`),
      ),
    )
    expect(unknown).toEqual([])
  })
})

for (const suite of QUALITY_SUITES.filter((s) => s.mustPass)) {
  describe(suite.name, () => {
    const ranks = ranksBySuite.get(suite.name)!
    suite.cases.forEach((c, i) => {
      test(`"${c.query}" → ${c.relevant.join(' ')}`, () => {
        expect(ranks[i]).toBeGreaterThan(0)
      })
    })
  })
}

describe('ranking metrics', () => {
  if (UPDATE_BASELINE) {
    test('update baseline', () => {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`)
    })
    return
  }

  const baseline: QualityBaseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
    : {}

  test('report', () => {
    console.table(current)
    const misses = QUALITY_SUITES.filter((s) => !s.mustPass).flatMap((s) =>
      s.cases.filter((_, i) => ranksBySuite.get(s.name)![i] === 0).map((c) => c.query),
    )
    console.log(`Intent misses (${misses.length}): ${misses.join(', ')}`)
  })

  for (const suite of QUALITY_SUITES) {
    test(`${suite.name} does not regress from baseline`, () => {
      const expected = baseline[suite.name]
      expect(expected, `missing baseline; run pnpm quality:update`).toBeDefined()
      for (const key of Object.keys(expected) as (keyof QualityMetrics)[]) {
        expect(current[suite.name][key], key).toBeGreaterThanOrEqual(expected[key])
      }
    })
  }
})
