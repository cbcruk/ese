import { SearchCore, type SearchResult } from './core/index.js'

export type { SearchResult }

/**
 * Options for constructing an {@link EmojiSearch} instance.
 *
 * {@link EmojiSearch} 인스턴스 생성 옵션.
 */
export interface EmojiSearchOptions {
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

interface UsageRecord {
  count: number
  lastUsed: number
}

/**
 * Maximum recency boost, applied to an emoji used moments ago and decaying
 * linearly to `0` over {@link RECENCY_WINDOW_MS}.
 *
 * 최근 사용 boost 최댓값. 방금 사용한 이모지에 적용되고
 * {@link RECENCY_WINDOW_MS} 동안 선형으로 `0`까지 감쇠.
 *
 * ---
 *
 * Personalization boost values ({@link RECENCY_BOOST}, {@link FREQUENCY_BOOST})
 * are additive to the search score (0.0–1.05). Max combined boost is 0.25 —
 * enough to promote a familiar emoji within the same tier but not enough to
 * override a better match from a higher tier.
 *
 * 개인화 boost 값들({@link RECENCY_BOOST}, {@link FREQUENCY_BOOST})은 검색
 * 점수(0.0–1.05)에 더해짐. 최대 합산 boost는 0.25 — 같은 티어 안에서 친숙한
 * 이모지를 위로 올릴 수는 있지만, 더 상위 티어 매치를 뒤집을 정도는 아님.
 */
const RECENCY_BOOST = 0.15

/**
 * Maximum frequency boost, scaling linearly with usage count up to
 * {@link FREQUENCY_CAP}.
 *
 * 사용 빈도 boost 최댓값. 사용 횟수에 비례해 선형 증가, {@link FREQUENCY_CAP}
 * 에서 saturate.
 */
const FREQUENCY_BOOST = 0.1

/**
 * Usage count at which {@link FREQUENCY_BOOST} saturates. Further uses
 * beyond this do not increase the boost.
 *
 * {@link FREQUENCY_BOOST}가 saturate되는 사용 횟수. 이 이상 써도 boost는
 * 더 안 늘어남.
 */
const FREQUENCY_CAP = 10

/**
 * Time window over which the recency boost decays to zero. 30 minutes —
 * matches a typical interactive session length.
 *
 * 최근 사용 boost가 0으로 감쇠하는 시간 창. 30분 — 일반적인 인터랙티브
 * 세션 길이와 비슷.
 */
const RECENCY_WINDOW_MS = 30 * 60 * 1000

/**
 * Emoji search engine with personalization.
 *
 * Wraps the {@link SearchCore} multi-tier search with in-memory recency +
 * frequency boosting. Usage data is held in memory only — persist it
 * yourself via {@link recordUsage} callbacks if you want it across sessions.
 *
 * 개인화 기능이 포함된 이모지 검색 엔진.
 *
 * {@link SearchCore}의 다층 검색에 메모리 기반 recency + frequency boost를
 * 덧씌움. 사용 데이터는 메모리에만 보관 — 세션 간 유지하려면 호출자가
 * {@link recordUsage} 콜백으로 직접 영속화해야 함.
 *
 * @example
 * ```ts
 * const search = new EmojiSearch({ maxResults: 10 });
 * const results = search.query("apple");
 * search.recordUsage(results[0].emoji);
 * ```
 */
export class EmojiSearch {
  private core: SearchCore
  private usage: Map<string, UsageRecord> = new Map()

  /**
   * Loads the index and creates a new search instance.
   *
   * 인덱스를 로드해 새 검색 인스턴스 생성.
   *
   * @param options - Search tuning. See {@link EmojiSearchOptions}.
   *                  (검색 튜닝 옵션. {@link EmojiSearchOptions} 참고)
   */
  constructor(options: EmojiSearchOptions = {}) {
    this.core = new SearchCore({
      maxResults: options.maxResults,
      typoTolerance: options.typoTolerance,
    })
  }

  /**
   * Runs a search query against the index, then re-ranks the results using
   * personalization data recorded via {@link recordUsage}.
   *
   * Personalization is skipped entirely when no usage has been recorded,
   * so the first call after construction returns the raw engine output.
   *
   * 인덱스에 대해 검색을 실행한 뒤, {@link recordUsage}로 기록된 개인화
   * 데이터를 사용해 결과를 재랭킹.
   *
   * 사용 데이터가 없으면 개인화 단계 자체를 건너뛰어, 생성 직후 첫 호출은
   * 엔진 원본 출력을 그대로 반환.
   *
   * @param input - User input. Empty string returns an empty array.
   *                (사용자 입력. 빈 문자열은 빈 배열 반환)
   * @returns Results sorted by `score` descending.
   *          (`score` 내림차순으로 정렬된 결과)
   */
  query(input: string): SearchResult[] {
    const results = this.core.query(input)

    if (this.usage.size === 0) {
      return results
    }

    const now = Date.now()
    const boosted = results.map((r) => {
      const record = this.usage.get(r.emoji)

      if (!record) return r

      let boost = 0
      const elapsed = now - record.lastUsed
      if (elapsed < RECENCY_WINDOW_MS) {
        boost += RECENCY_BOOST * (1 - elapsed / RECENCY_WINDOW_MS)
      }
      boost += (FREQUENCY_BOOST * Math.min(record.count, FREQUENCY_CAP)) / FREQUENCY_CAP

      return {
        ...r,
        score: r.score + boost,
      }
    })

    boosted.sort((a, b) => b.score - a.score)

    return boosted
  }

  /**
   * Records that the user picked an emoji, feeding the personalization
   * model. Call this whenever the user actually inserts/copies an emoji
   * — not merely on hover or preview.
   *
   * 사용자가 이모지를 선택했음을 기록해 개인화 모델에 반영. 사용자가 실제로
   * 이모지를 삽입/복사하는 시점에 호출 — hover나 preview 단계에서는 호출
   * 금지.
   *
   * @param emoji - The emoji glyph, matching the `emoji` field of {@link SearchResult}.
   *                (이모지 glyph. {@link SearchResult}의 `emoji` 필드와 동일)
   */
  recordUsage(emoji: string): void {
    const existing = this.usage.get(emoji)

    if (existing) {
      existing.count++
      existing.lastUsed = Date.now()
    } else {
      this.usage.set(emoji, {
        count: 1,
        lastUsed: Date.now(),
      })
    }
  }

  /**
   * Clears all in-memory personalization data. Subsequent queries return
   * raw engine scores until new usage is recorded.
   *
   * 메모리에 쌓인 개인화 데이터를 모두 초기화. 새로 사용이 기록되기 전까지
   * 이후 쿼리는 엔진 원본 점수를 반환.
   */
  clearUsage(): void {
    this.usage.clear()
  }
}
