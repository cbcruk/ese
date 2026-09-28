import type { QualityCase, QualityMetrics } from './quality.types.ts'

/**
 * Returns the 1-based rank of the first relevant emoji in `results`.
 *
 * `results`에서 첫 번째 정답 이모지의 1-based 랭크를 반환.
 *
 * @returns The rank, or `0` when no relevant emoji is present.
 */
export function rankOf(results: readonly string[], relevant: readonly string[]): number {
  const index = results.findIndex((emoji) => relevant.includes(emoji))
  return index + 1
}

/**
 * Computes {@link QualityMetrics} from the ranks of a suite's cases.
 *
 * 스위트 케이스들의 랭크로 {@link QualityMetrics}를 계산.
 *
 * @param ranks Ranks from {@link rankOf}, where `0` means not found.
 */
export function computeMetrics(ranks: readonly number[]): QualityMetrics {
  const n = ranks.length
  if (n === 0) return { hitAt1: 0, hitAt5: 0, recall: 0, mrr: 0 }

  const share = (predicate: (rank: number) => boolean): number => ranks.filter(predicate).length / n

  return {
    hitAt1: share((r) => r === 1),
    hitAt5: share((r) => r >= 1 && r <= 5),
    recall: share((r) => r >= 1),
    mrr: ranks.reduce((sum, r) => sum + (r > 0 ? 1 / r : 0), 0) / n,
  }
}

/**
 * Ranks every case with `search` and returns the ranks in case order.
 *
 * `search`로 모든 케이스의 랭크를 구해 케이스 순서대로 반환.
 */
export function rankCases(
  cases: readonly QualityCase[],
  search: (query: string) => string[],
): number[] {
  return cases.map((c) => rankOf(search(c.query), c.relevant))
}

/**
 * Rounds each metric to 4 decimals so the baseline file stays readable and
 * stable across floating-point noise.
 *
 * baseline 파일이 읽기 쉽고 부동소수점 오차에 흔들리지 않도록 각 지표를 소수
 * 4자리로 반올림.
 */
export function roundMetrics(metrics: QualityMetrics): QualityMetrics {
  const round = (x: number): number => Math.round(x * 10_000) / 10_000
  return {
    hitAt1: round(metrics.hitAt1),
    hitAt5: round(metrics.hitAt5),
    recall: round(metrics.recall),
    mrr: round(metrics.mrr),
  }
}
