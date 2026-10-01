import { describe, expect, test } from 'vitest'
import { buildEmojiTable } from './build-emoji-table.ts'
import { buildPopularityOrder } from './build-popularity-order.ts'

describe('buildPopularityOrder', () => {
  const table = buildEmojiTable({ '🍎': [], '🍕': [], '😂': [] }, {})

  test('flattens frequency groups into IDs, most frequent first', () => {
    const order = buildPopularityOrder([['😂'], ['🍕', '🍎']], table)
    expect(order.map((id) => table.emojis[id][0])).toEqual(['😂', '🍕', '🍎'])
  })

  test('skips unknown and duplicate emojis, leaving unranked ones out', () => {
    const order = buildPopularityOrder([['🦄', '😂'], ['😂']], table)
    expect(order.map((id) => table.emojis[id][0])).toEqual(['😂'])
  })
})
