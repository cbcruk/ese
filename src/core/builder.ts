import { emojis as RAW_EMOJIS, groups, keywords, postings } from './data.generated.js'

export interface EmojiEntry {
  emoji: string
  name: string
  group: string
}

export interface SearchIndex {
  emojis: EmojiEntry[]
  /**
   * Keywords sorted lexicographically — enables binary-search prefix scans.
   *
   * lexicographic 정렬된 키워드 배열 — binary-search 기반 prefix 스캔 가능.
   */
  keywords: string[]
  /**
   * Parallel to `keywords`: emoji IDs that match each keyword.
   *
   * `keywords`와 동일한 인덱스로 매칭 — 각 키워드에 대응하는 이모지 ID들.
   */
  postings: number[][]
  /**
   * Direct keyword → postings index lookup for exact match.
   *
   * Exact match를 위한 키워드 → postings 인덱스 직접 조회.
   */
  exactLookup: Map<string, number>
}

let cached: SearchIndex | null = null

/**
 * Builds the runtime search index from the precomputed payload. Cached
 * after first construction — repeated callers (e.g. multiple
 * `EmojiSearch` instances) share one index.
 *
 * 사전 계산된 payload로부터 런타임 검색 인덱스를 구성. 첫 호출 후 캐싱 —
 * 반복 호출자(예: 여러 `EmojiSearch` 인스턴스)는 동일한 인덱스를 공유.
 */
export function buildIndex(): SearchIndex {
  if (cached) return cached

  const emojiEntries: EmojiEntry[] = RAW_EMOJIS.map(([emoji, name, groupId]) => ({
    emoji,
    name,
    group: groups[groupId],
  }))

  const exactLookup = new Map<string, number>()

  for (let i = 0; i < keywords.length; i++) {
    exactLookup.set(keywords[i], i)
  }

  cached = {
    emojis: emojiEntries,
    keywords,
    postings,
    exactLookup,
  }

  return cached
}
