import { bench, describe } from 'vitest'
import { EmojiSearch } from '../src/index.js'

const search = new EmojiSearch({ maxResults: 20 })

describe('English search', () => {
  bench('exact match', () => {
    search.query('apple')
  })

  bench('prefix match', () => {
    search.query('app')
  })

  bench('fuzzy (distance 1)', () => {
    search.query('aple')
  })

  bench('fuzzy (distance 2)', () => {
    search.query('appel')
  })

  bench('common keyword (face)', () => {
    search.query('face')
  })

  bench('short query (2 chars)', () => {
    search.query('do')
  })
})

describe('Korean search', () => {
  bench('exact match (사과)', () => {
    search.query('사과')
  })

  bench('choseong (ㅅㄱ)', () => {
    search.query('ㅅㄱ')
  })

  bench('3-char keyword (강아지)', () => {
    search.query('강아지')
  })

  bench('choseong 3-char (ㄱㅇㅈ)', () => {
    search.query('ㄱㅇㅈ')
  })
})

describe('Multi-word search', () => {
  bench('two words (good luck)', () => {
    search.query('good luck')
  })

  bench('two words (치킨 땡긴다)', () => {
    search.query('치킨 땡긴다')
  })

  bench('stopword dropped (so hot)', () => {
    search.query('so hot')
  })
})
