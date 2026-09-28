import { describe, test, expect } from 'vitest'
import { computeMetrics, rankOf, roundMetrics } from './quality.utils.ts'

describe('rankOf', () => {
  test('returns the 1-based rank of the first relevant emoji', () => {
    expect(rankOf(['🍏', '🍎', '🍐'], ['🍐', '🍎'])).toBe(2)
  })

  test('returns 0 when no relevant emoji is present', () => {
    expect(rankOf(['🍏'], ['🍎'])).toBe(0)
  })
})

describe('computeMetrics', () => {
  test('aggregates hit@k, recall and MRR', () => {
    expect(computeMetrics([1, 2, 6, 0])).toEqual({
      hitAt1: 0.25,
      hitAt5: 0.5,
      recall: 0.75,
      mrr: (1 + 1 / 2 + 1 / 6) / 4,
    })
  })

  test('returns zeros for an empty suite', () => {
    expect(computeMetrics([])).toEqual({ hitAt1: 0, hitAt5: 0, recall: 0, mrr: 0 })
  })
})

describe('roundMetrics', () => {
  test('rounds to 4 decimals', () => {
    expect(roundMetrics({ hitAt1: 1 / 3, hitAt5: 1, recall: 1, mrr: 2 / 3 })).toEqual({
      hitAt1: 0.3333,
      hitAt5: 1,
      recall: 1,
      mrr: 0.6667,
    })
  })
})
