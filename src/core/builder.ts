import { emojis as RAW_EMOJIS, groups, keywords, postings } from './data.generated.js'
import { generateVariants } from './hangul.js'

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
  /**
   * `true` once {@link expandChoseongVariants} has merged Hangul choseong
   * variants into {@link keywords} / {@link postings} / {@link exactLookup}.
   * Prevents duplicate expansion across instances sharing the cached index.
   *
   * {@link expandChoseongVariants}가 한글 초성 변형을 인덱스에 병합한 이후
   * `true`. 캐시된 인덱스를 공유하는 인스턴스 간 중복 확장을 방지.
   */
  choseongExpanded: boolean
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
    choseongExpanded: false,
  }

  return cached
}

/**
 * Expands Hangul choseong variants into the index in place. The bundled
 * payload only contains original Korean keywords (e.g. `"사과"`) — variants
 * like `"ㅅㄱ"` and `"사ㄱ"` that let users search by partial choseong are
 * generated here.
 *
 * Why runtime: pre-expanding at build time inflated the bundled payload by
 * ~10% (1,907 extra keywords). Generating them on demand keeps the wire
 * payload lean and lets `SearchCore` schedule the work in a microtask so it
 * almost never blocks user interaction.
 *
 * Idempotent — guarded by {@link SearchIndex.choseongExpanded}. Mutates
 * `keywords`, `postings`, and `exactLookup` to a new, larger sorted set.
 *
 * 한글 초성 변형을 인덱스에 in-place 확장. 번들된 payload에는 한국어
 * 원본 키워드(예: `"사과"`)만 들어 있으며, 사용자가 초성 일부로 검색할 수
 * 있게 해주는 `"ㅅㄱ"`, `"사ㄱ"` 같은 변형은 여기서 생성.
 *
 * 런타임에서 처리하는 이유: 빌드 타임에 사전 확장하면 번들된 payload가
 * ~10%(키워드 1,907개) 부풀음. on-demand 생성으로 wire payload를 가볍게
 * 유지하면서, `SearchCore`가 microtask로 예약하므로 사용자 인터랙션을
 * 블록하는 일이 거의 없음.
 *
 * Idempotent — {@link SearchIndex.choseongExpanded}로 가드. `keywords`,
 * `postings`, `exactLookup`을 더 큰 정렬된 집합으로 교체.
 */
export function expandChoseongVariants(index: SearchIndex): void {
  if (index.choseongExpanded) return

  const variantToIds = new Map<string, Set<number>>()

  for (let i = 0; i < index.keywords.length; i++) {
    const variants = generateVariants(index.keywords[i])

    if (variants.length === 0) continue

    const ids = index.postings[i]

    for (const v of variants) {
      let set = variantToIds.get(v)

      if (!set) {
        set = new Set()
        variantToIds.set(v, set)
      }

      for (const id of ids) set.add(id)
    }
  }

  if (variantToIds.size === 0) {
    index.choseongExpanded = true
    return
  }

  const merged = new Map<string, Set<number>>()

  for (let i = 0; i < index.keywords.length; i++) {
    merged.set(index.keywords[i], new Set(index.postings[i]))
  }

  for (const [variant, ids] of variantToIds) {
    let set = merged.get(variant)

    if (!set) {
      set = new Set()
      merged.set(variant, set)
    }

    for (const id of ids) set.add(id)
  }

  const newKeywords = [...merged.keys()].sort()
  const newPostings = newKeywords.map((k) => [...merged.get(k)!].sort((a, b) => a - b))
  const newExactLookup = new Map<string, number>()

  for (let i = 0; i < newKeywords.length; i++) {
    newExactLookup.set(newKeywords[i], i)
  }

  index.keywords = newKeywords
  index.postings = newPostings
  index.exactLookup = newExactLookup
  index.choseongExpanded = true
}
