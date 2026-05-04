import { describe, expect, test } from 'vitest'
import { levenshteinCapped } from './levenshtein.js'

describe('levenshteinCapped', () => {
  test('two empty strings have distance 0', () => {
    expect(levenshteinCapped('', '', 0)).toBe(0)
    expect(levenshteinCapped('', '', 5)).toBe(0)
  })

  test('one empty string returns the length of the other (within cap)', () => {
    expect(levenshteinCapped('abc', '', 3)).toBe(3)
    expect(levenshteinCapped('', 'abc', 3)).toBe(3)
  })

  test('one empty string exceeding cap returns null', () => {
    expect(levenshteinCapped('abc', '', 2)).toBeNull()
    expect(levenshteinCapped('', 'abcd', 2)).toBeNull()
  })

  test('equal strings have distance 0', () => {
    expect(levenshteinCapped('apple', 'apple', 0)).toBe(0)
    expect(levenshteinCapped('apple', 'apple', 5)).toBe(0)
  })

  test('single substitution', () => {
    expect(levenshteinCapped('apple', 'apply', 1)).toBe(1)
  })

  test('single insertion', () => {
    expect(levenshteinCapped('apple', 'apples', 1)).toBe(1)
  })

  test('single deletion', () => {
    expect(levenshteinCapped('apple', 'aple', 1)).toBe(1)
  })

  test('returns null when actual distance exceeds cap', () => {
    expect(levenshteinCapped('apple', 'banana', 2)).toBeNull()
  })

  test('length-difference filter rejects without computation', () => {
    expect(levenshteinCapped('a', 'abcdefg', 2)).toBeNull()
  })

  test('classic kitten vs sitting has distance 3', () => {
    expect(levenshteinCapped('kitten', 'sitting', 3)).toBe(3)
    expect(levenshteinCapped('kitten', 'sitting', 2)).toBeNull()
  })

  test('Korean BMP characters: 사과 vs 사람 distance 1', () => {
    expect(levenshteinCapped('사과', '사람', 1)).toBe(1)
  })

  test('Korean BMP: 강아지 vs 강아치 distance 1', () => {
    expect(levenshteinCapped('강아지', '강아치', 1)).toBe(1)
  })

  test('Korean choseong jamo: ㅅㄱ vs ㅅㄱ distance 0', () => {
    expect(levenshteinCapped('ㅅㄱ', 'ㅅㄱ', 0)).toBe(0)
  })

  test('boundary: distance equals cap exactly', () => {
    expect(levenshteinCapped('cat', 'dog', 3)).toBe(3)
    expect(levenshteinCapped('cat', 'dog', 2)).toBeNull()
  })
})
