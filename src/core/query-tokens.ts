/**
 * Common words that carry little meaning in an emoji search, e.g. the `so` in
 * `so hot` or the `너무` in `너무 덥다`. Matched after lowercasing.
 *
 * 이모지 검색에서 의미가 거의 없는 흔한 단어(예: `so hot`의 `so`, `너무 덥다`의
 * `너무`). 소문자화 후 비교.
 */
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'so',
  'very',
  'really',
  'too',
  'just',
  'i',
  "i'm",
  'im',
  'me',
  'my',
  'you',
  'your',
  'it',
  "it's",
  'its',
  'is',
  'am',
  'are',
  'was',
  'be',
  'to',
  'of',
  'and',
  'or',
  'for',
  'in',
  'on',
  'at',
  '너무',
  '진짜',
  '정말',
  '완전',
  '엄청',
  '좀',
  '많이',
  '그냥',
  '이제',
  '나',
  '너',
  '내',
  '우리',
  '싶다',
  '싶어',
  '중',
])

/**
 * Splits a lowercased query into the words worth matching on their own.
 *
 * 소문자화된 쿼리를 개별 매칭할 가치가 있는 단어들로 분리.
 *
 * Splits on whitespace and drops {@link STOPWORDS}. When every word is a
 * stopword, all words are kept so the query still matches something.
 *
 * @returns The content words, or a single-element array for a one-word query.
 */
export function tokenizeQuery(query: string): string[] {
  const words = query.split(/\s+/).filter(Boolean)
  const content = words.filter((w) => !STOPWORDS.has(w))

  return content.length > 0 ? content : words
}
