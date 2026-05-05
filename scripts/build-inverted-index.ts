import type { EmojiTable } from './build-emoji-table.ts'
import type { RawInputs } from './load-inputs.ts'

export interface InvertedIndex {
  keywords: string[]
  postings: number[][]
}

/**
 * Builds the keyword → emoji-IDs inverted index.
 *
 * Sources combined:
 * - emojilib keywords (English, lowercased)
 * - emoji name as a whole + each whitespace-split word (lowercased)
 * - Korean keywords (originals only — choseong variants are expanded at
 *   runtime via SearchCore to keep the bundled index lean)
 *
 * Keywords are sorted lexicographically and postings (emoji ID lists)
 * are sorted+deduped. Sorted keywords enable binary-search prefix scans
 * at runtime.
 *
 * 키워드 → 이모지 ID 역색인(inverted index)을 생성.
 *
 * 결합되는 소스:
 * - emojilib 키워드 (영어, 소문자 변환)
 * - 이모지 이름 전체 + 공백으로 split한 각 단어 (소문자 변환)
 * - 한국어 키워드 (원본만 — 초성 변형은 번들 인덱스 크기 절감을 위해
 *   런타임에 SearchCore에서 확장)
 *
 * 키워드는 lexicographic 정렬, postings(이모지 ID 리스트)는 정렬 + dedup.
 * 정렬된 키워드 덕에 런타임에서 binary-search 기반 prefix 스캔이 가능.
 */
export function buildInvertedIndex(inputs: RawInputs, table: EmojiTable): InvertedIndex {
  const keywordToIds = new Map<string, Set<number>>()

  const addKeyword = (kw: string, id: number): void => {
    let set = keywordToIds.get(kw)

    if (!set) {
      set = new Set()
      keywordToIds.set(kw, set)
    }

    set.add(id)
  }

  // English sources: emojilib keywords (lowercased) + emoji name (whole +
  // each whitespace-split word, lowercased).
  //
  // 영어 소스: emojilib 키워드(소문자) + 이모지 이름(전체 + 공백으로
  // split한 각 단어, 소문자).
  for (const [emoji, keywords] of Object.entries(inputs.emojilib)) {
    const id = table.emojiIdMap.get(emoji)!

    for (const kw of keywords) addKeyword(kw.toLowerCase(), id)

    const m = inputs.meta[emoji]

    if (m) {
      const nameLower = m.name.toLowerCase()

      addKeyword(nameLower, id)

      for (const word of nameLower.split(/\s+/)) {
        if (word) addKeyword(word, id)
      }
    }
  }

  // Korean sources: first-party Korean keywords. Choseong variants
  // (e.g. "사과" → "ㅅㄱ", "사ㄱ") are NOT pre-expanded — SearchCore expands
  // them at runtime via a deferred microtask, keeping the bundled payload
  // ~10% smaller.
  //
  // 한국어 소스: 1차 한국어 키워드. 초성 변형(예: "사과" → "ㅅㄱ", "사ㄱ")은
  // 사전 확장하지 않음 — SearchCore가 런타임에 deferred microtask로 확장,
  // 번들 payload를 ~10% 줄임.
  for (const [emoji, keywords] of Object.entries(inputs.koKeywords)) {
    const id = table.emojiIdMap.get(emoji)

    if (id === undefined) continue

    for (const kw of keywords) {
      addKeyword(kw, id)
    }
  }

  // Finalize: sort keywords lexicographically (for binary-search prefix
  // scans at runtime), sort+dedupe each posting list.
  //
  // 마무리: 키워드를 lexicographic 정렬(런타임에서 binary-search prefix
  // 스캔용), 각 posting list도 정렬 + dedup.
  const keywords = [...keywordToIds.keys()].sort()
  const postings = keywords.map((kw) => [...keywordToIds.get(kw)!].sort((a, b) => a - b))

  return { keywords, postings }
}
