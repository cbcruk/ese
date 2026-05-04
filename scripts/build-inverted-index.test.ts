import { describe, expect, test } from 'vitest'
import { buildEmojiTable } from './build-emoji-table.ts'
import { buildInvertedIndex } from './build-inverted-index.ts'
import type { RawInputs } from './load-inputs.ts'

function makeInputs(partial: Partial<RawInputs>): RawInputs {
  return {
    emojilib: {},
    meta: {},
    koKeywords: {},
    ...partial,
  }
}

describe('buildInvertedIndex', () => {
  test('lowercases English keywords', () => {
    const inputs = makeInputs({
      emojilib: { '🍎': ['Apple', 'RED'] },
    })
    const table = buildEmojiTable(inputs.emojilib, inputs.meta)
    const index = buildInvertedIndex(inputs, table)

    expect(index.keywords).toContain('apple')
    expect(index.keywords).toContain('red')
    expect(index.keywords).not.toContain('Apple')
  })

  test('indexes the full emoji name and each whitespace-split word', () => {
    const inputs = makeInputs({
      emojilib: { '🍎': [] },
      meta: { '🍎': { name: 'red apple', group: 'Food' } },
    })
    const table = buildEmojiTable(inputs.emojilib, inputs.meta)
    const index = buildInvertedIndex(inputs, table)

    expect(index.keywords).toContain('red apple') // whole name
    expect(index.keywords).toContain('red') // split word
    expect(index.keywords).toContain('apple') // split word
  })

  test('keywords are sorted lexicographically', () => {
    const inputs = makeInputs({
      emojilib: { '🍎': ['banana', 'apple', 'cherry'] },
    })
    const table = buildEmojiTable(inputs.emojilib, inputs.meta)
    const index = buildInvertedIndex(inputs, table)

    const sorted = [...index.keywords].sort()
    expect(index.keywords).toEqual(sorted)
  })

  test('postings are sorted ascending by emoji ID', () => {
    const inputs = makeInputs({
      emojilib: { '🍎': ['fruit'], '🍌': ['fruit'], '🍒': ['fruit'] },
    })
    const table = buildEmojiTable(inputs.emojilib, inputs.meta)
    const index = buildInvertedIndex(inputs, table)

    const fruitIdx = index.keywords.indexOf('fruit')
    const ids = index.postings[fruitIdx]
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
  })

  test('postings deduplicate emoji IDs across multiple sources', () => {
    const inputs = makeInputs({
      // "apple" appears in both keywords list and split from name
      emojilib: { '🍎': ['apple'] },
      meta: { '🍎': { name: 'apple', group: 'Food' } },
    })
    const table = buildEmojiTable(inputs.emojilib, inputs.meta)
    const index = buildInvertedIndex(inputs, table)

    const appleIdx = index.keywords.indexOf('apple')
    expect(index.postings[appleIdx]).toEqual([0])
  })

  test('Korean keywords are indexed alongside their choseong variants', () => {
    const inputs = makeInputs({
      emojilib: { '🍎': [] },
      koKeywords: { '🍎': ['사과'] },
    })
    const table = buildEmojiTable(inputs.emojilib, inputs.meta)
    const index = buildInvertedIndex(inputs, table)

    expect(index.keywords).toContain('사과')
    expect(index.keywords).toContain('ㅅㄱ')
    expect(index.keywords).toContain('사ㄱ')
  })

  test('Korean keywords for emojis missing in emojilib are silently skipped', () => {
    const inputs = makeInputs({
      emojilib: {}, // 🍎 not in emojilib so no ID is assigned
      koKeywords: { '🍎': ['사과'] },
    })
    const table = buildEmojiTable(inputs.emojilib, inputs.meta)
    const index = buildInvertedIndex(inputs, table)

    expect(index.keywords).not.toContain('사과')
  })

  test('keywords array length equals postings array length', () => {
    const inputs = makeInputs({
      emojilib: { '🍎': ['apple', 'red'], '🍌': ['banana', 'yellow'] },
    })
    const table = buildEmojiTable(inputs.emojilib, inputs.meta)
    const index = buildInvertedIndex(inputs, table)

    expect(index.keywords.length).toBe(index.postings.length)
  })
})
