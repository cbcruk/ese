import { describe, test, expect, beforeAll, beforeEach } from 'vitest'
import { EmojiSearch } from '../src/index.js'

describe('EmojiSearch', () => {
  let search: EmojiSearch

  beforeAll(() => {
    search = new EmojiSearch()
  })

  test('exact match: apple → includes apple emojis', () => {
    const results = search.query('apple')
    expect(results.length).toBeGreaterThan(0)
    const emojis = results.map((r) => r.emoji)
    expect(emojis).toContain('🍎')
    expect(emojis).toContain('🍏')
    expect(results[0].score).toBeGreaterThanOrEqual(1.0)
  })

  test('prefix match: app → includes 🍎', () => {
    const results = search.query('app')
    expect(results.some((r) => r.emoji === '🍎')).toBe(true)
  })

  test('fuzzy match: aple → includes 🍎', () => {
    const results = search.query('aple')
    expect(results.some((r) => r.emoji === '🍎')).toBe(true)
  })

  test('fuzzy match: teers → includes 😢', () => {
    const results = search.query('teers')
    expect(results.some((r) => r.emoji === '😢')).toBe(true)
  })

  test('returns multiple results for common keywords', () => {
    const results = search.query('smile')
    expect(results.length).toBeGreaterThan(1)
  })

  test('returns name and group metadata', () => {
    const results = search.query('apple')
    expect(results[0].name).toBeTruthy()
    expect(results[0].group).toBeTruthy()
  })

  test('empty query returns empty array', () => {
    const results = search.query('')
    expect(results).toEqual([])
  })

  test('respects maxResults option', () => {
    const search5 = new EmojiSearch({ maxResults: 5 })
    const results = search5.query('face')
    expect(results.length).toBeLessThanOrEqual(5)
  })

  test('case insensitive', () => {
    const results = search.query('Apple')
    expect(results.some((r) => r.emoji === '🍎')).toBe(true)
  })
})

describe('Korean search', () => {
  let search: EmojiSearch

  beforeAll(() => {
    search = new EmojiSearch()
  })

  test('Korean exact match: 사과 → 🍎', () => {
    const results = search.query('사과')
    expect(results.some((r) => r.emoji === '🍎')).toBe(true)
  })

  test('Korean choseong: ㅅㄱ → 🍎', () => {
    const results = search.query('ㅅㄱ')
    expect(results.some((r) => r.emoji === '🍎')).toBe(true)
  })

  test('Korean partial choseong: 사ㄱ → 🍎', () => {
    const results = search.query('사ㄱ')
    expect(results.some((r) => r.emoji === '🍎')).toBe(true)
  })

  test('Korean keyword: 강아지 → 🐶', () => {
    const results = search.query('강아지')
    expect(results.some((r) => r.emoji === '🐶')).toBe(true)
  })

  test('Korean choseong: ㄱㅇㅈ → 🐶', () => {
    const results = search.query('ㄱㅇㅈ')
    expect(results.some((r) => r.emoji === '🐶')).toBe(true)
  })

  test('Korean keyword: 축구 → ⚽', () => {
    const results = search.query('축구')
    expect(results.some((r) => r.emoji === '⚽')).toBe(true)
  })

  test('Korean keyword: 커피 → ☕', () => {
    const results = search.query('커피')
    expect(results.some((r) => r.emoji === '☕')).toBe(true)
  })

  test('Korean choseong: ㅋㅍ → ☕', () => {
    const results = search.query('ㅋㅍ')
    expect(results.some((r) => r.emoji === '☕')).toBe(true)
  })

  test('Korean keyword: 사랑 → ❤️', () => {
    const results = search.query('사랑')
    expect(results.some((r) => r.emoji === '❤️')).toBe(true)
  })

  test('Korean keyword: 웃음 returns multiple results', () => {
    const results = search.query('웃음')
    expect(results.length).toBeGreaterThan(1)
  })
})

describe('Personalization', () => {
  let search: EmojiSearch

  beforeEach(() => {
    search = new EmojiSearch()
  })

  test('recordUsage boosts emoji in results', () => {
    const before = search.query('apple')
    const targetEmoji = before.find((r) => r.emoji === '🍎')!
    const scoreBefore = targetEmoji.score

    search.recordUsage('🍎')
    const after = search.query('apple')
    const scoreAfter = after.find((r) => r.emoji === '🍎')!.score

    expect(scoreAfter).toBeGreaterThan(scoreBefore)
  })

  test('frequently used emoji gets higher boost', () => {
    search.recordUsage('🍎')
    const after1 = search.query('apple').find((r) => r.emoji === '🍎')!.score

    for (let i = 0; i < 5; i++) search.recordUsage('🍎')
    const after6 = search.query('apple').find((r) => r.emoji === '🍎')!.score

    expect(after6).toBeGreaterThan(after1)
  })

  test('clearUsage resets personalization', () => {
    search.recordUsage('🍎')
    search.clearUsage()

    const before = new EmojiSearch().query('apple')
    const after = search.query('apple')

    const scoreBefore = before.find((r) => r.emoji === '🍎')!.score
    const scoreAfter = after.find((r) => r.emoji === '🍎')!.score
    expect(scoreAfter).toBe(scoreBefore)
  })
})

describe('typoTolerance option', () => {
  test('typoTolerance: 0 disables fuzzy matching', () => {
    const strict = new EmojiSearch({ typoTolerance: 0 })
    const results = strict.query('aple')
    expect(results.some((r) => r.emoji === '🍎')).toBe(false)
  })

  test('typoTolerance: 1 allows distance 1 but not 2', () => {
    const mid = new EmojiSearch({ typoTolerance: 1 })
    const results1 = mid.query('aple')
    expect(results1.some((r) => r.emoji === '🍎')).toBe(true)
  })

  test('typoTolerance: 2 allows distance 2', () => {
    const full = new EmojiSearch({ typoTolerance: 2 })
    const results = full.query('appel')
    expect(results.some((r) => r.emoji === '🍎')).toBe(true)
  })
})
