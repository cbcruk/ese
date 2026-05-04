import { describe, expect, test } from 'vitest'
import { buildEmojiTable } from './build-emoji-table.ts'

describe('buildEmojiTable', () => {
  test('empty input produces empty table', () => {
    const table = buildEmojiTable({}, {})
    expect(table.emojis).toEqual([])
    expect(table.emojiIdMap.size).toBe(0)
    expect(table.groups).toEqual([])
  })

  test('assigns sequential IDs starting at 0', () => {
    const emojilib = { '🍎': ['apple'], '🍏': ['green'] }
    const meta = {
      '🍎': { name: 'red apple', group: 'Food' },
      '🍏': { name: 'green apple', group: 'Food' },
    }
    const table = buildEmojiTable(emojilib, meta)
    expect(table.emojiIdMap.get('🍎')).toBe(0)
    expect(table.emojiIdMap.get('🍏')).toBe(1)
  })

  test('emojis are sorted lexicographically (deterministic output)', () => {
    const shuffled = { '🍏': ['green'], '🍎': ['apple'] }
    const sorted = { '🍎': ['apple'], '🍏': ['green'] }
    const meta = {}

    const a = buildEmojiTable(shuffled, meta)
    const b = buildEmojiTable(sorted, meta)
    expect(a.emojis).toEqual(b.emojis)
  })

  test('deduplicates group strings into a separate table', () => {
    const emojilib = { '🍎': [], '🍏': [], '🐶': [] }
    const meta = {
      '🍎': { name: 'red apple', group: 'Food' },
      '🍏': { name: 'green apple', group: 'Food' },
      '🐶': { name: 'dog', group: 'Animals' },
    }
    const table = buildEmojiTable(emojilib, meta)

    expect(table.groups).toEqual(['Food', 'Animals'])
    // Both apples reference the same group ID
    const appleA = table.emojis.find(([e]) => e === '🍎')!
    const appleB = table.emojis.find(([e]) => e === '🍏')!
    expect(appleA[2]).toBe(appleB[2])
  })

  test('missing meta entry falls back to empty name and empty group (id 0)', () => {
    const emojilib = { '🍎': ['apple'] }
    const meta = {}
    const table = buildEmojiTable(emojilib, meta)

    expect(table.emojis[0]).toEqual(['🍎', '', 0])
    expect(table.groups).toEqual([''])
  })

  test('group ID order reflects first-encountered group', () => {
    const emojilib = { '🍎': [], '🐶': [] }
    const meta = {
      '🍎': { name: 'apple', group: 'Food' },
      '🐶': { name: 'dog', group: 'Animals' },
    }
    // 🍎 sorts before 🐶 lexicographically (in our sort, codepoints)
    // so Food gets id 0, Animals id 1
    const table = buildEmojiTable(emojilib, meta)
    expect(table.groups[0]).toBe('Food')
    expect(table.groups[1]).toBe('Animals')
  })
})
