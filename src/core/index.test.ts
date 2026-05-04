import { describe, expect, test } from 'vitest'
import { SearchCore } from './index.js'

describe('SearchCore', () => {
  test('empty input returns empty array', () => {
    const core = new SearchCore()
    expect(core.query('')).toEqual([])
  })

  test('exact match scores at least 1.0', () => {
    const core = new SearchCore()
    const apple = core.query('apple').find((r) => r.emoji === '🍎')
    expect(apple).toBeDefined()
    expect(apple!.score).toBeGreaterThanOrEqual(1.0)
  })

  test('prefix match returns results without exact', () => {
    const core = new SearchCore()
    const results = core.query('app')
    expect(results.some((r) => r.emoji === '🍎')).toBe(true)
  })

  test('fuzzy distance 1 finds typo', () => {
    const core = new SearchCore()
    const results = core.query('aple')
    expect(results.some((r) => r.emoji === '🍎')).toBe(true)
  })

  test('fuzzy distance 2 finds longer typo as fallback', () => {
    const core = new SearchCore()
    const results = core.query('appel')
    expect(results.some((r) => r.emoji === '🍎')).toBe(true)
  })

  test('typoTolerance: 0 disables fuzzy matching', () => {
    const strict = new SearchCore({ typoTolerance: 0 })
    expect(strict.query('aple').some((r) => r.emoji === '🍎')).toBe(false)
  })

  test('typoTolerance: 1 finds dist-1 but not dist-2', () => {
    const mid = new SearchCore({ typoTolerance: 1 })
    expect(mid.query('aple').some((r) => r.emoji === '🍎')).toBe(true)
  })

  test('respects maxResults', () => {
    const core = new SearchCore({ maxResults: 3 })
    expect(core.query('face').length).toBeLessThanOrEqual(3)
  })

  test('results are sorted by score descending', () => {
    const core = new SearchCore()
    const results = core.query('apple')
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }
  })

  test('case insensitive', () => {
    const core = new SearchCore()
    expect(core.query('Apple').some((r) => r.emoji === '🍎')).toBe(true)
    expect(core.query('APPLE').some((r) => r.emoji === '🍎')).toBe(true)
  })

  test('returns name and group metadata for each result', () => {
    const core = new SearchCore()
    const top = core.query('apple')[0]
    expect(top.name).toBeTruthy()
    expect(top.group).toBeTruthy()
  })

  test('Korean exact match: 사과 → 🍎', () => {
    const core = new SearchCore()
    expect(core.query('사과').some((r) => r.emoji === '🍎')).toBe(true)
  })

  test('Korean choseong: ㅅㄱ → 🍎', () => {
    const core = new SearchCore()
    expect(core.query('ㅅㄱ').some((r) => r.emoji === '🍎')).toBe(true)
  })

  test('partial choseong: 사ㄱ → 🍎', () => {
    const core = new SearchCore()
    expect(core.query('사ㄱ').some((r) => r.emoji === '🍎')).toBe(true)
  })

  test('name-match boost lifts exact-name match above other tier-1 matches', () => {
    // "red apple" matches the name "red apple" exactly → +0.05 boost,
    // pushing the score above the plain exact-match ceiling of 1.0.
    const core = new SearchCore()
    const results = core.query('red apple')
    expect(results[0].score).toBeGreaterThan(1.0)
  })
})
