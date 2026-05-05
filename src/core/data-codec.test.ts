import { describe, expect, test } from 'vitest'
import { encodeFrontCoded, encodePostings } from '../../scripts/data-codec.ts'
import { decodeFrontCoded, decodePostings } from './data-codec.ts'

describe('front-coding roundtrip', () => {
  test('empty array', () => {
    expect(decodeFrontCoded(encodeFrontCoded([]))).toEqual([])
  })

  test('single string (no prefix sharing)', () => {
    expect(decodeFrontCoded(encodeFrontCoded(['apple']))).toEqual(['apple'])
  })

  test('sorted strings with shared prefixes', () => {
    const input = ['apple', 'apple core', 'apple pie', 'apples', 'apricot']
    expect(decodeFrontCoded(encodeFrontCoded(input))).toEqual(input)
  })

  test('strings with no prefix overlap', () => {
    const input = ['apple', 'banana', 'cherry']
    expect(decodeFrontCoded(encodeFrontCoded(input))).toEqual(input)
  })

  test('Korean strings (multi-byte UTF-16)', () => {
    const input = ['사과', '사람', '사랑', '사슴']
    expect(decodeFrontCoded(encodeFrontCoded(input))).toEqual(input)
  })

  test('encodes shared prefix length, not byte length', () => {
    // "사과" and "사람" share 1 UTF-16 code unit ("사").
    const encoded = encodeFrontCoded(['사과', '사람'])
    expect(encoded[0]).toEqual([0, '사과'])
    expect(encoded[1]).toEqual([1, '람'])
  })

  test('handles empty strings in the array', () => {
    const input = ['', 'a', 'ab']
    expect(decodeFrontCoded(encodeFrontCoded(input))).toEqual(input)
  })
})

describe('delta+varint postings roundtrip', () => {
  test('empty postings', () => {
    expect(decodePostings(encodePostings([]), 0)).toEqual([])
  })

  test('empty posting list', () => {
    expect(decodePostings(encodePostings([[]]), 1)).toEqual([[]])
  })

  test('single ID', () => {
    expect(decodePostings(encodePostings([[42]]), 1)).toEqual([[42]])
  })

  test('multiple sorted IDs in one list', () => {
    const input = [[1, 5, 27, 100, 1913]]
    expect(decodePostings(encodePostings(input), 1)).toEqual(input)
  })

  test('multiple lists', () => {
    const input = [[0], [1, 2, 3], [], [500, 1000]]
    expect(decodePostings(encodePostings(input), input.length)).toEqual(input)
  })

  test('IDs requiring multi-byte varints (>= 128)', () => {
    const input = [[127, 128, 16383, 16384, 2097151]]
    expect(decodePostings(encodePostings(input), 1)).toEqual(input)
  })

  test('large delta between consecutive IDs', () => {
    const input = [[0, 1913]]
    expect(decodePostings(encodePostings(input), 1)).toEqual(input)
  })
})
