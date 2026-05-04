import { describe, expect, test } from 'vitest'
import { buildIndex } from './builder.js'

describe('buildIndex', () => {
  test('returns the same cached instance on subsequent calls', () => {
    const a = buildIndex()
    const b = buildIndex()
    expect(a).toBe(b)
  })

  test('emojis array is non-empty and well-formed', () => {
    const idx = buildIndex()
    expect(idx.emojis.length).toBeGreaterThan(0)

    const sample = idx.emojis[0]
    expect(typeof sample.emoji).toBe('string')
    expect(typeof sample.name).toBe('string')
    expect(typeof sample.group).toBe('string')
    expect(sample.emoji.length).toBeGreaterThan(0)
  })

  test('keywords are sorted lexicographically', () => {
    const { keywords } = buildIndex()
    const sorted = [...keywords].sort()
    expect(keywords).toEqual(sorted)
  })

  test('keywords and postings have parallel length', () => {
    const { keywords, postings } = buildIndex()
    expect(keywords.length).toBe(postings.length)
  })

  test('exactLookup maps each keyword to its postings index', () => {
    const { keywords, exactLookup } = buildIndex()
    expect(exactLookup.size).toBe(keywords.length)

    for (let i = 0; i < keywords.length; i++) {
      expect(exactLookup.get(keywords[i])).toBe(i)
    }
  })

  test('postings reference valid emoji IDs only', () => {
    const { emojis, postings } = buildIndex()
    const max = emojis.length

    for (const ids of postings) {
      for (const id of ids) {
        expect(id).toBeGreaterThanOrEqual(0)
        expect(id).toBeLessThan(max)
      }
    }
  })

  test('every posting list is sorted ascending', () => {
    const { postings } = buildIndex()
    for (const ids of postings) {
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i]).toBeGreaterThan(ids[i - 1])
      }
    }
  })
})
