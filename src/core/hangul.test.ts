import { describe, expect, test } from 'vitest'
import { containsCompatJamo, generateVariants, matchesHangulWord } from './hangul.ts'

describe('generateVariants', () => {
  test('empty string returns empty array', () => {
    expect(generateVariants('')).toEqual([])
  })

  test('pure ASCII input returns empty array (no Hangul to expand)', () => {
    expect(generateVariants('apple')).toEqual([])
  })

  test('emoji-only input returns empty array', () => {
    expect(generateVariants('🍎🍏')).toEqual([])
  })

  test('two-syllable Hangul produces choseong + suffix variants', () => {
    const variants = generateVariants('사과')
    expect(variants).toContain('ㅅㄱ')
    expect(variants).toContain('사ㄱ')
  })

  test('does not include the original word', () => {
    expect(generateVariants('사과')).not.toContain('사과')
  })

  test('three-syllable word produces all suffix-replaced variants', () => {
    const variants = generateVariants('강아지')
    expect(variants).toContain('ㄱㅇㅈ')
    expect(variants).toContain('강ㅇㅈ')
    expect(variants).toContain('강아ㅈ')
  })

  test('single syllable produces one choseong variant', () => {
    const variants = generateVariants('사')
    expect(variants).toEqual(['ㅅ'])
  })

  test('mixed Hangul + non-Hangul keeps non-Hangul characters as-is', () => {
    const variants = generateVariants('사a')
    // 'a' is non-syllable, so getChoseong falls back to 'a' itself
    expect(variants).toContain('ㅅa')
  })

  test('deduplicates variants when multiple splits produce same result', () => {
    const variants = generateVariants('사과')
    const unique = new Set(variants)
    expect(variants.length).toBe(unique.size)
  })
})

describe('containsCompatJamo', () => {
  test('empty string returns false', () => {
    expect(containsCompatJamo('')).toBe(false)
  })

  test('pure ASCII returns false', () => {
    expect(containsCompatJamo('apple')).toBe(false)
  })

  test('completed Hangul syllables alone return false', () => {
    // 사과 is composed of syllables (U+C0AC, U+ACFC), NOT compat jamo.
    expect(containsCompatJamo('사과')).toBe(false)
  })

  test('pure choseong returns true', () => {
    expect(containsCompatJamo('ㅅㄱ')).toBe(true)
  })

  test('mixed syllable + jamo returns true', () => {
    expect(containsCompatJamo('사ㄱ')).toBe(true)
  })

  test('single jamo returns true', () => {
    expect(containsCompatJamo('ㅅ')).toBe(true)
  })
})

describe('matchesHangulWord', () => {
  test('matches the word itself and its choseong forms', () => {
    expect(matchesHangulWord('사과', '사과')).toBe(true)
    expect(matchesHangulWord('사ㄱ', '사과')).toBe(true)
    expect(matchesHangulWord('ㅅㄱ', '사과')).toBe(true)
  })

  test('rejects other words, prefixes and empty names', () => {
    expect(matchesHangulWord('ㅅㅈ', '사과')).toBe(false)
    expect(matchesHangulWord('사', '사과')).toBe(false)
    expect(matchesHangulWord('', '')).toBe(false)
  })
})
