import { describe, test, expect } from 'vitest'
import { EmojiSearch } from '../src/index.js'

const search = new EmojiSearch({ maxResults: 50 })

interface TestCase {
  query: string
  expected: string
}

function runQualitySuite(name: string, cases: TestCase[]): void {
  describe(name, () => {
    for (const tc of cases) {
      test(`"${tc.query}" → ${tc.expected}`, () => {
        const results = search.query(tc.query)
        expect(results.some((r) => r.emoji === tc.expected)).toBe(true)
      })
    }
  })
}

runQualitySuite('Exact English', [
  { query: 'apple', expected: '🍎' },
  { query: 'fire', expected: '🔥' },
  { query: 'heart', expected: '❤️' },
  { query: 'dog', expected: '🐶' },
  { query: 'cat', expected: '🐱' },
  { query: 'rocket', expected: '🚀' },
  { query: 'pizza', expected: '🍕' },
  { query: 'beer', expected: '🍺' },
  { query: 'star', expected: '⭐' },
  { query: 'music', expected: '🎵' },
  { query: 'camera', expected: '📷' },
  { query: 'coffee', expected: '☕' },
  { query: 'rain', expected: '🌧️' },
  { query: 'snow', expected: '❄️' },
  { query: 'basketball', expected: '🏀' },
])

runQualitySuite('Typo (distance 1)', [
  { query: 'aple', expected: '🍎' },
  { query: 'fore', expected: '🔥' },
  { query: 'roket', expected: '🚀' },
  { query: 'piza', expected: '🍕' },
  { query: 'ber', expected: '🍺' },
  { query: 'cofee', expected: '☕' },
  { query: 'camra', expected: '📷' },
  { query: 'musi', expected: '🎵' },
  { query: 'rein', expected: '🌧️' },
  { query: 'snw', expected: '❄️' },
])

runQualitySuite('Typo (distance 2)', [
  { query: 'appel', expected: '🍎' },
  { query: 'rcket', expected: '🚀' },
  { query: 'pizz', expected: '🍕' },
  { query: 'coffe', expected: '☕' },
  { query: 'cmaera', expected: '📷' },
])

runQualitySuite('Korean exact', [
  { query: '사과', expected: '🍎' },
  { query: '강아지', expected: '🐶' },
  { query: '고양이', expected: '🐱' },
  { query: '커피', expected: '☕' },
  { query: '축구', expected: '⚽' },
  { query: '피자', expected: '🍕' },
  { query: '사랑', expected: '❤️' },
  { query: '불', expected: '🔥' },
  { query: '하트', expected: '❤️' },
  { query: '맥주', expected: '🍺' },
  { query: '치킨', expected: '🍗' },
  { query: '로켓', expected: '🚀' },
  { query: '별', expected: '⭐' },
  { query: '음악', expected: '🎵' },
  { query: '카메라', expected: '📷' },
])

runQualitySuite('Korean choseong', [
  { query: 'ㅅㄱ', expected: '🍎' },
  { query: 'ㄱㅇㅈ', expected: '🐶' },
  { query: 'ㄱㅇㅇ', expected: '🐱' },
  { query: 'ㅋㅍ', expected: '☕' },
  { query: 'ㅊㄱ', expected: '⚽' },
  { query: 'ㅍㅈ', expected: '🍕' },
  { query: 'ㅅㄹ', expected: '❤️' },
  { query: 'ㅎㅌ', expected: '❤️' },
  { query: 'ㅁㅈ', expected: '🍺' },
  { query: 'ㅊㅋ', expected: '🍗' },
])

runQualitySuite('Korean partial choseong', [
  { query: '사ㄱ', expected: '🍎' },
  { query: '강ㅇㅈ', expected: '🐶' },
  { query: '고ㅇㅇ', expected: '🐱' },
  { query: '커ㅍ', expected: '☕' },
  { query: '축ㄱ', expected: '⚽' },
])

runQualitySuite('Concept (English)', [
  { query: 'celebration', expected: '🎉' },
  { query: 'sleepy', expected: '😴' },
  { query: 'money', expected: '💰' },
  { query: 'deadline', expected: '⏰' },
  { query: 'workout', expected: '💪' },
  { query: 'spooky', expected: '👻' },
  { query: 'perfect', expected: '💯' },
  { query: 'birthday', expected: '🎂' },
  { query: 'goodnight', expected: '🌙' },
  { query: 'luck', expected: '🍀' },
])

runQualitySuite('Concept (Korean)', [
  { query: '축하', expected: '🎉' },
  { query: '졸림', expected: '😴' },
  { query: '돈', expected: '💰' },
  { query: '마감', expected: '⏰' },
  { query: '운동', expected: '💪' },
  { query: '생일', expected: '🎂' },
  { query: '행운', expected: '🍀' },
])

runQualitySuite('Concept (Korean choseong)', [
  { query: 'ㅊㅎ', expected: '🎉' }, // 축하
  { query: 'ㅅㅇ', expected: '🎂' }, // 생일
])
