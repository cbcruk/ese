import { buildIndex, expandChoseongVariants, type SearchIndex } from './builder.js'
import { containsCompatJamo, matchesHangulWord } from './hangul.js'
import { levenshteinCapped } from './levenshtein.js'
import { tokenizeQuery } from './query-tokens.js'

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
   * Relevance score in `[0.0, 1.15]`. Exact match = 1.0, prefix = 0.8,
   * fuzzy distance 1 = 0.6, distance 2 = 0.4. Plus up to 0.05 from
   * name-match tie-breaking, and +0.10 when the query exactly matches a
   * concept term and this emoji is one of that concept's curated emojis.
   *
   * `[0.0, 1.15]` 범위의 관련도 점수. Exact = 1.0, prefix = 0.8,
   * fuzzy dist 1 = 0.6, dist 2 = 0.4. 추가로 이름 매치 tie-breaking으로
   * 최대 +0.05, 그리고 쿼리가 개념어와 정확히 일치하고 이 이모지가 해당
   * 개념의 큐레이션 이모지일 때 +0.10.
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
 * matching the query receive a small boost for tie-breaking, as do Korean
 * display names matched in full or by choseong (see
 * {@link KO_NAME_BOOST}). Remaining ties follow the concept's curated order,
 * then go to the more frequently used emoji per Unicode's emoji frequency
 * ranking. When the query
 * exactly matches a concept term (e.g. `celebration`, `축하`), that concept's
 * curated emojis receive a larger {@link CONCEPT_BOOST} so they lead the
 * results instead of tying with emojis that merely share the keyword.
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
 * 작은 boost 추가 — 한국어 대표명이 그대로 또는 초성으로 매치되는 경우도
 * 동일({@link KO_NAME_BOOST} 참고). 남은 동점은 개념어의 큐레이션 순서를
 * 따르고, 그다음 Unicode 이모지 사용 빈도 순위상 더 많이 쓰이는 이모지가
 * 앞에 옴.
 *
 * Levenshtein 거리는 UTF-16 code unit 단위 (BMP 영역 코드포인트는 Unicode
 * 문자 단위와 동일 — 한글 음절을 포함한 모든 이모지 키워드가 BMP에 속함).
 */
/**
 * Ranking boost added to a concept's curated emojis when the query exactly
 * matches that concept term. Larger than the name-match tie-breaker (max
 * +0.05) so a curated concept emoji reliably outranks an emoji that merely
 * shares the keyword — e.g. `celebration` puts 🎉🎊🥳 above 🎂🎁, which
 * carry `celebration` only as an incidental keyword.
 *
 * 쿼리가 개념어와 정확히 일치할 때 해당 개념의 큐레이션 이모지에 더하는 랭킹
 * 가산점. 이름 매치 tie-breaker(최대 +0.05)보다 커서, 큐레이션된 개념 이모지가
 * 키워드만 우연히 공유하는 이모지보다 확실히 상위에 옴 — 예: `celebration`은
 * 🎉🎊🥳를, `celebration`을 부수적 키워드로만 가진 🎂🎁 위에 올림.
 */
const CONCEPT_BOOST = 0.1

/**
 * Tie-breaking boost for an emoji whose Korean display name matches the query
 * in full or by choseong (`강아지`, `강ㅇㅈ`, `ㄱㅇㅈ` → 🐶). Mirrors the
 * English exact-name boost: many emojis share a Korean keyword (🐶🐕🐩 all
 * carry `강아지`), and this keeps the emoji the word primarily names on top.
 *
 * 한국어 대표명이 쿼리와 그대로 또는 초성으로 매치되는 이모지의 tie-breaking
 * 가산점(`강아지`, `강ㅇㅈ`, `ㄱㅇㅈ` → 🐶). 영어 이름 정확 일치 boost와 대응 —
 * 여러 이모지가 같은 한국어 키워드를 공유(🐶🐕🐩 모두 `강아지`)하므로, 그
 * 단어가 주로 가리키는 이모지를 맨 위에 유지.
 */
const KO_NAME_BOOST = 0.05

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
    const tokens = tokenizeQuery(query)
    const isMultiWord = tokens.length > 1 || tokens[0] !== query
    const { scores, conceptPosition } = this.scoreTerm(query, !isMultiWord)

    // Multi-word queries (`치킨 땡긴다`, `so hot`) rarely match a keyword as a
    // whole, so each content word is also scored on its own. An emoji's token
    // score is the mean over words, so matching more words ranks higher, and
    // it keeps whichever of its whole-query and token scores is better.
    //
    // 여러 단어 쿼리(`치킨 땡긴다`, `so hot`)는 통째로 키워드와 매치되는 경우가
    // 드물어, 의미 있는 단어마다 따로 채점. 이모지의 단어 점수는 단어별 점수의
    // 평균이라 더 많은 단어와 매치될수록 상위에 오며, 전체 쿼리 점수와 단어
    // 점수 중 더 나은 쪽을 유지.
    //
    // The whole multi-word query skips fuzzy matching, since each word is
    // matched fuzzily anyway. Instead it is also tried with spaces removed,
    // because Korean spacing varies (`커피 수혈` → `커피수혈`).
    //
    // 여러 단어 쿼리 전체에는 fuzzy 매칭을 생략 — 각 단어가 어차피 fuzzy로
    // 매칭되므로. 대신 한국어 띄어쓰기가 제각각이라 공백을 없앤 형태로도 매칭
    // (`커피 수혈` → `커피수혈`).
    if (isMultiWord) {
      const joined = this.scoreTerm(query.replace(/\s+/g, ''), false)

      for (const [id, score] of joined.scores) {
        if (score > (scores.get(id) ?? 0)) scores.set(id, score)
      }
      for (const [id, position] of joined.conceptPosition) {
        conceptPosition.set(id, Math.min(conceptPosition.get(id) ?? position, position))
      }

      const tokenSums = new Map<number, number>()

      for (const token of tokens) {
        const term = this.scoreTerm(token, true)

        for (const [id, score] of term.scores) {
          tokenSums.set(id, (tokenSums.get(id) ?? 0) + score)
        }
        for (const [id, position] of term.conceptPosition) {
          conceptPosition.set(id, Math.min(conceptPosition.get(id) ?? position, position))
        }
      }

      for (const [id, sum] of tokenSums) {
        const score = sum / tokens.length
        if (score > (scores.get(id) ?? 0)) scores.set(id, score)
      }
    }

    const { popularityRank } = this.index
    const curatedOrder = (id: number): number => conceptPosition.get(id) ?? Infinity
    const ranked = [...scores].sort(
      (a, b) =>
        b[1] - a[1] ||
        curatedOrder(a[0]) - curatedOrder(b[0]) ||
        popularityRank[a[0]] - popularityRank[b[0]],
    )
    ranked.length = Math.min(ranked.length, this.maxResults)

    return ranked.map(([id, score]) => {
      const e = this.index.emojis[id]
      return { emoji: e.emoji, name: e.name, group: e.group, score }
    })
  }

  /**
   * Scores every emoji matching a single term through the match tiers (fuzzy
   * tiers only when `fuzzy` is set) and ranking boosts, and returns the curated position of each emoji in the
   * concept the term exactly matches (empty when none).
   *
   * 단일 term에 매치되는 모든 이모지를 매칭 티어(`fuzzy`일 때만 fuzzy 티어
   * 포함)와 랭킹 가산점으로 채점하고,
   * term이 정확히 일치하는 개념어 내 각 이모지의 큐레이션 위치(없으면 빈 맵)를
   * 함께 반환.
   */
  private scoreTerm(
    term: string,
    fuzzy: boolean,
  ): {
    scores: Map<number, number>
    conceptPosition: Map<number, number>
  } {
    const termByteLength = this.encoder.encode(term).length
    const matches = new Map<number, number>()

    this.exactMatch(term, matches)
    this.prefixMatch(term, matches)

    if (fuzzy && this.typoTolerance >= 1 && termByteLength >= 3) {
      this.fuzzyMatch(term, 1, 0.6, matches)
    }

    if (fuzzy && this.typoTolerance >= 2 && termByteLength >= 4 && matches.size < this.maxResults) {
      this.fuzzyMatch(term, 2, 0.4, matches)
    }

    // Curated emojis for the concept term the query exactly matches (if any),
    // used to lift them above emojis that merely share the keyword.
    //
    // 쿼리가 정확히 일치하는 개념어의 큐레이션 이모지(있으면) — 키워드만
    // 공유하는 이모지 위로 올리는 데 사용.
    const conceptIds = this.index.conceptLookup.get(term)
    const conceptPosition = new Map(conceptIds?.map((id, i) => [id, i]))

    const scores = new Map<number, number>()
    for (const [id, score] of matches) {
      const entry = this.index.emojis[id]
      const name = entry.name.toLowerCase()
      let boost = name === term ? 0.05 : name.includes(term) ? 0.02 : 0
      if (matchesHangulWord(term, entry.koName)) boost += KO_NAME_BOOST
      if (conceptPosition.has(id)) boost += CONCEPT_BOOST
      scores.set(id, score + boost)
    }

    return { scores, conceptPosition }
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
