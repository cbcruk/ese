import { describe, expect, test } from 'vitest'
import { tokenizeQuery } from './query-tokens.ts'

describe('tokenizeQuery', () => {
  test('splits on whitespace', () => {
    expect(tokenizeQuery('치킨  땡긴다')).toEqual(['치킨', '땡긴다'])
  })

  test('drops stopwords', () => {
    expect(tokenizeQuery('so hot')).toEqual(['hot'])
    expect(tokenizeQuery('너무 덥다')).toEqual(['덥다'])
  })

  test('keeps all words when every word is a stopword', () => {
    expect(tokenizeQuery('so very')).toEqual(['so', 'very'])
  })

  test('returns a single word as-is', () => {
    expect(tokenizeQuery('apple')).toEqual(['apple'])
  })
})
