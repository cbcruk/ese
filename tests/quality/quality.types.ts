/**
 * A labeled query and the emojis a user would accept as a correct answer.
 *
 * 레이블된 쿼리와, 사용자가 정답으로 받아들일 이모지 목록.
 */
export interface QualityCase {
  query: string
  /**
   * Acceptable emojis. The case's rank is the position of the first one
   * found in the results, so order does not matter.
   *
   * 정답으로 인정되는 이모지들. 결과에서 가장 먼저 등장하는 정답의 위치가
   * 랭크가 되므로 순서는 무관.
   */
  relevant: string[]
}

/**
 * A named group of {@link QualityCase}s evaluated together.
 *
 * 함께 평가되는 {@link QualityCase} 묶음.
 */
export interface QualitySuite {
  name: string
  cases: QualityCase[]
  /**
   * Whether every case must be found in the results. Pass-fail suites guard
   * existing behaviour; the rest are tracked only through metrics so they can
   * hold queries that fail today.
   *
   * 모든 케이스가 결과에 포함되어야 하는지 여부. pass-fail 스위트는 기존 동작을
   * 보호하고, 나머지는 지표로만 추적해 현재 실패하는 쿼리도 담을 수 있음.
   */
  mustPass: boolean
}

/**
 * Ranking metrics for one suite.
 *
 * 스위트 하나의 랭킹 지표.
 */
export interface QualityMetrics {
  /** Share of cases whose top result is relevant, in `[0, 1]`. */
  hitAt1: number
  /** Share of cases with a relevant emoji in the top 5, in `[0, 1]`. */
  hitAt5: number
  /** Share of cases with a relevant emoji anywhere in the results, in `[0, 1]`. */
  recall: number
  /** Mean reciprocal rank of the first relevant emoji, `0` when absent, in `[0, 1]`. */
  mrr: number
}

/**
 * Per-suite metrics, keyed by {@link QualitySuite.name}.
 *
 * {@link QualitySuite.name}을 키로 하는 스위트별 지표.
 */
export type QualityBaseline = Record<string, QualityMetrics>
