import type { EmojiTable } from './build-emoji-table.ts'
import type { RawInputs } from './load-inputs.ts'

export interface InvertedIndex {
  keywords: string[]
  postings: number[][]
  /**
   * Concept terms (lowercased, sorted lexicographically) that back the
   * concept-match ranking boost. Distinct from {@link keywords}: a concept
   * term is only listed here when it comes from `concepts.json`, so the
   * runtime can boost the *curated* emojis for a concept query without also
   * boosting emojis that merely happen to share the keyword.
   *
   * 개념 매치 랭킹 가산점의 근거가 되는 concept 개념어(소문자, lexicographic
   * 정렬). {@link keywords}와 별개 — `concepts.json`에서 온 개념어만 여기
   * 실리므로, 런타임이 개념 쿼리에 대해 *큐레이션된* 이모지만 부스트하고
   * 우연히 같은 키워드를 공유하는 이모지는 부스트하지 않을 수 있음.
   */
  conceptTerms: string[]
  /**
   * Parallel to {@link conceptTerms}: the curated emoji IDs each concept term
   * maps to (sorted ascending).
   *
   * {@link conceptTerms}와 동일 인덱스로 매칭 — 각 개념어가 매핑하는 큐레이션
   * 이모지 ID들(오름차순 정렬).
   */
  conceptPostings: number[][]
}

/**
 * Builds the keyword → emoji-IDs inverted index.
 *
 * Sources combined:
 * - emojilib keywords (English, lowercased)
 * - emoji name as a whole + each whitespace-split word (lowercased)
 * - Korean keywords (originals only — choseong variants are expanded at
 *   runtime via SearchCore to keep the bundled index lean)
 * - concept terms (English + Korean), inverted from concept → emojis so an
 *   abstract query like `"celebration"` / `"축하"` matches expressive emojis
 *
 * Keywords are sorted lexicographically and postings (emoji ID lists)
 * are sorted+deduped. Sorted keywords enable binary-search prefix scans
 * at runtime.
 *
 * Also emits a separate concept map ({@link InvertedIndex.conceptTerms} /
 * {@link InvertedIndex.conceptPostings}) that powers the concept-match
 * ranking boost at runtime.
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

  // Concept sources: first-party concept → emoji mappings, inverted here into
  // keyword → ids. Concept terms (English and Korean) become ordinary keywords,
  // so they flow through the same exact/prefix/fuzzy tiers — and Korean concept
  // terms pick up choseong variants at runtime for free. Lowercased so English
  // terms match the lowercased query (a no-op for Korean/emoji text).
  //
  // The same (term → curated ids) pairs are also collected into a separate
  // concept map so the runtime can apply a ranking boost to the curated emojis
  // for a concept query without boosting emojis that merely share the keyword.
  //
  // Concept 소스: 1차 concept → 이모지 매핑을 여기서 keyword → ids로 역변환.
  // Concept 개념어(영어·한국어)는 일반 키워드가 되어 동일한 exact/prefix/fuzzy
  // 티어를 그대로 통과 — 한국어 concept는 런타임 초성 변형까지 공짜로 획득.
  // 소문자화된 쿼리와 맞추기 위해 lowercase(한국어/이모지 텍스트엔 no-op).
  //
  // 동일한 (개념어 → 큐레이션 ids) 쌍을 별도 concept 맵에도 수집 — 런타임이
  // 개념 쿼리에 대해 키워드만 공유하는 이모지는 제외하고 큐레이션된 이모지에만
  // 랭킹 가산점을 적용할 수 있게 함.
  const conceptToIds = new Map<string, Set<number>>()

  for (const [concept, emojis] of Object.entries(inputs.concepts)) {
    const kw = concept.toLowerCase()

    for (const emoji of emojis) {
      const id = table.emojiIdMap.get(emoji)

      if (id === undefined) continue

      addKeyword(kw, id)

      let set = conceptToIds.get(kw)
      if (!set) {
        set = new Set()
        conceptToIds.set(kw, set)
      }
      set.add(id)
    }
  }

  // Finalize: sort keywords lexicographically (for binary-search prefix
  // scans at runtime), sort+dedupe each posting list. The concept map is
  // finalized the same way — sorted terms, sorted id lists.
  //
  // 마무리: 키워드를 lexicographic 정렬(런타임에서 binary-search prefix
  // 스캔용), 각 posting list도 정렬 + dedup. concept 맵도 동일하게 마무리 —
  // 개념어 정렬, id 리스트 정렬.
  const keywords = [...keywordToIds.keys()].sort()
  const postings = keywords.map((kw) => [...keywordToIds.get(kw)!].sort((a, b) => a - b))

  const conceptTerms = [...conceptToIds.keys()].sort()
  const conceptPostings = conceptTerms.map((t) => [...conceptToIds.get(t)!].sort((a, b) => a - b))

  return { keywords, postings, conceptTerms, conceptPostings }
}
