import { buildIndex, expandChoseongVariants, type SearchIndex } from './builder.js'
import { containsCompatJamo } from './hangul.js'
import { levenshteinCapped } from './levenshtein.js'

/**
 * A single emoji match returned by {@link SearchCore.query}.
 * Sorted by `score` descending in the result array.
 *
 * {@link SearchCore.query}가 반환하는 단일 이모지 매치. 결과 배열 안에서
 * `score` 내림차순 정렬.
 */
export interface SearchResult {
  /**
   * The emoji glyph itself, e.g. `"🍎"`.
   * (이모지 글리프 자체. 예: `"🍎"`)
   */
  emoji: string
  /**
   * Human-readable display name, e.g. `"red apple"`.
   * (사람이 읽을 수 있는 표시명. 예: `"red apple"`)
   */
  name: string
  /**
   * Unicode group, e.g. `"Food & Drink"`.
   * (Unicode 그룹. 예: `"Food & Drink"`)
   */
  group: string
  /**
   * Relevance score in `[0.0, 1.05]`. Exact match = 1.0, prefix = 0.8,
   * fuzzy distance 1 = 0.6, distance 2 = 0.4. Plus up to 0.05 from
   * name-match tie-breaking.
   *
   * `[0.0, 1.05]` 범위의 관련도 점수. Exact = 1.0, prefix = 0.8,
   * fuzzy dist 1 = 0.6, dist 2 = 0.4. 추가로 이름 매치 tie-breaking으로
   * 최대 +0.05.
   */
  score: number
}

export interface SearchCoreOptions {
  /**
   * Maximum results returned per query. Defaults to `20`.
   *
   * 쿼리당 반환되는 최대 결과 수. 기본값 `20`.
   */
  maxResults?: number
  /**
   * Maximum Levenshtein distance for fuzzy matching. `0` disables fuzzy,
   * `1` allows one typo, `2` (default) adds a distance-2 fallback.
   *
   * Fuzzy 매칭에 허용할 최대 Levenshtein 거리. `0`이면 fuzzy 비활성, `1`은
   * 오타 1개 허용, `2`(기본값)는 distance-2 fallback까지 추가.
   */
  typoTolerance?: number
}

/**
 * Search engine core.
 *
 * Multi-tier scoring pipeline:
 *
 * | Tier | Match              | Score | Min query length |
 * |------|--------------------|-------|------------------|
 * | 1    | Exact              | 1.0   | 1                |
 * | 2    | Prefix             | 0.8   | 1                |
 * | 3    | Levenshtein dist 1 | 0.6   | 3 bytes          |
 * | 4    | Levenshtein dist 2 | 0.4   | 4 bytes          |
 *
 * Each tier writes into a shared score map using "first wins" semantics,
 * so an emoji matched by a higher tier keeps its better score. Names
 * matching the query receive a small boost for tie-breaking.
 *
 * Levenshtein distance is measured in UTF-16 code units (equivalent to
 * Unicode characters for all BMP code points, which covers all emoji
 * keywords including Korean Hangul syllables).
 *
 * 검색 엔진 코어.
 *
 * 다층 스코어링 파이프라인:
 *
 * | 티어 | 매칭               | 점수  | 최소 쿼리 길이 |
 * |------|--------------------|-------|----------------|
 * | 1    | Exact              | 1.0   | 1              |
 * | 2    | Prefix             | 0.8   | 1              |
 * | 3    | Levenshtein dist 1 | 0.6   | 3 bytes        |
 * | 4    | Levenshtein dist 2 | 0.4   | 4 bytes        |
 *
 * 각 티어는 "first wins" 방식으로 공유 score 맵에 기록 — 상위 티어가 매치한
 * 이모지는 더 좋은 점수를 유지. 이름이 쿼리와 매치되는 경우 tie-breaking용
 * 작은 boost 추가.
 *
 * Levenshtein 거리는 UTF-16 code unit 단위 (BMP 영역 코드포인트는 Unicode
 * 문자 단위와 동일 — 한글 음절을 포함한 모든 이모지 키워드가 BMP에 속함).
 */
export class SearchCore {
  private index: SearchIndex
  private maxResults: number
  private typoTolerance: number
  private encoder = new TextEncoder()

  constructor(options: SearchCoreOptions = {}) {
    this.index = buildIndex()
    this.maxResults = options.maxResults ?? 20
    this.typoTolerance = options.typoTolerance ?? 2

    // Defer choseong-variant expansion to a microtask so the constructor
    // returns immediately. By the time the user fires their first query,
    // expansion has typically already completed; the inline guard in
    // `query` covers the rare case where a choseong query arrives first.
    //
    // 초성 변형 확장을 microtask로 지연 — 생성자는 즉시 반환. 사용자가 첫
    // 쿼리를 날릴 시점에는 확장이 보통 이미 완료. 초성 쿼리가 먼저 도착하는
    // 드문 경우는 `query` 내 inline 가드로 처리.
    if (!this.index.choseongExpanded) {
      queueMicrotask(() => expandChoseongVariants(this.index))
    }
  }

  query(input: string): SearchResult[] {
    if (!input) return []

    // Choseong queries (containing compat jamo like `ㅅ`, `ㄱ`) need the
    // expanded variant index. If the deferred microtask hasn't fired yet,
    // complete the work synchronously here. ASCII / Hangul-syllable queries
    // hit the original index directly and skip this entirely.
    //
    // 초성 쿼리(`ㅅ`, `ㄱ` 같은 호환 자모 포함)는 확장된 변형 인덱스가 필요.
    // deferred microtask가 아직 fire 안 됐으면 여기서 동기로 마무리.
    // ASCII / 한글 음절 쿼리는 원본 인덱스를 직접 사용하며 이 경로 건너뜀.
    if (!this.index.choseongExpanded && containsCompatJamo(input)) {
      expandChoseongVariants(this.index)
    }

    const query = input.toLowerCase()
    const queryByteLength = this.encoder.encode(query).length

    const scores = new Map<number, number>()

    this.exactMatch(query, scores)
    this.prefixMatch(query, scores)

    if (this.typoTolerance >= 1 && queryByteLength >= 3) {
      this.fuzzyMatch(query, 1, 0.6, scores)
    }

    if (this.typoTolerance >= 2 && queryByteLength >= 4 && scores.size < this.maxResults) {
      this.fuzzyMatch(query, 2, 0.4, scores)
    }

    const ranked: Array<[number, number]> = []
    for (const [id, score] of scores) {
      const name = this.index.emojis[id].name.toLowerCase()
      const boost = name === query ? 0.05 : name.includes(query) ? 0.02 : 0
      ranked.push([id, score + boost])
    }
    ranked.sort((a, b) => b[1] - a[1])
    ranked.length = Math.min(ranked.length, this.maxResults)

    return ranked.map(([id, score]) => {
      const e = this.index.emojis[id]
      return { emoji: e.emoji, name: e.name, group: e.group, score }
    })
  }

  private exactMatch(query: string, scores: Map<number, number>): void {
    const idx = this.index.exactLookup.get(query)

    if (idx === undefined) return

    for (const id of this.index.postings[idx]) {
      scores.set(id, 1.0)
    }
  }

  private prefixMatch(query: string, scores: Map<number, number>): void {
    const lo = lowerBound(this.index.keywords, query)

    for (let i = lo; i < this.index.keywords.length; i++) {
      const kw = this.index.keywords[i]

      if (!kw.startsWith(query)) break

      for (const id of this.index.postings[i]) {
        if (!scores.has(id)) scores.set(id, 0.8)
      }
    }
  }

  private fuzzyMatch(
    query: string,
    distance: number,
    score: number,
    scores: Map<number, number>,
  ): void {
    const keywords = this.index.keywords
    const postings = this.index.postings

    for (let i = 0; i < keywords.length; i++) {
      const d = levenshteinCapped(query, keywords[i], distance)

      if (d === null) continue

      for (const id of postings[i]) {
        if (!scores.has(id)) scores.set(id, score)
      }
    }
  }
}

function lowerBound(arr: string[], target: string): number {
  let lo = 0
  let hi = arr.length

  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid] < target) lo = mid + 1
    else hi = mid
  }

  return lo
}
