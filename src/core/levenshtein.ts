/**
 * Computes Levenshtein distance between two strings, capped at `max`.
 * Returns `null` if the distance exceeds `max` (early termination).
 *
 * Operates on UTF-16 code units to mirror the Rust FST's Levenshtein
 * automaton, which counts in Unicode characters (not bytes). For all
 * BMP characters — including Korean syllables (U+AC00–U+D7A3) and the
 * compatibility jamo block — UTF-16 code units equal Unicode characters.
 *
 * 두 문자열의 Levenshtein 거리를 계산하되 `max`로 cap. 거리가 `max`를
 * 초과하면 `null` 반환 (early termination).
 *
 * UTF-16 code unit 단위로 동작 — 원래 Rust FST의 Levenshtein automaton이
 * Unicode 문자(바이트 아님) 단위로 거리를 재는 것과 맞춤. BMP 영역 문자
 * (한글 음절 U+AC00–U+D7A3, 호환 자모 블록 포함)는 UTF-16 code unit과
 * Unicode 문자가 일치.
 *
 * @see docs/levenshtein.md — 알고리즘 설명, DP 점화식, 최적화 3가지
 */
export function levenshteinCapped(a: string, b: string, max: number): number | null {
  const lenA = a.length
  const lenB = b.length

  if (Math.abs(lenA - lenB) > max) return null
  if (lenA === 0) return lenB <= max ? lenB : null
  if (lenB === 0) return lenA <= max ? lenA : null

  // Typed arrays: predictable layout, auto zero-init, faster than `number[]`
  // for this hot path. Uint16 caps at 65535 — far above any plausible distance.
  //
  // 타입드 배열: 메모리 레이아웃이 예측 가능, 자동 0 초기화, hot path에서
  // `number[]`보다 빠름. Uint16 상한 65535 — 실제로 나올 수 있는 거리보다
  // 훨씬 큼.
  let prev = new Uint16Array(lenB + 1)
  let curr = new Uint16Array(lenB + 1)

  for (let j = 0; j <= lenB; j++) prev[j] = j

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i

    let rowMin = curr[0]

    const aCode = a.charCodeAt(i - 1)

    for (let j = 1; j <= lenB; j++) {
      const cost = aCode === b.charCodeAt(j - 1) ? 0 : 1
      const v = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)

      curr[j] = v

      if (v < rowMin) rowMin = v
    }

    if (rowMin > max) return null

    ;[prev, curr] = [curr, prev]
  }

  const dist = prev[lenB]

  return dist <= max ? dist : null
}
