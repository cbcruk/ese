let rowA = new Uint16Array(64)
let rowB = new Uint16Array(64)

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

  // Fuzzy matching calls this once per keyword (~18K times per query), so the
  // two DP rows are module-level buffers grown on demand instead of fresh
  // allocations — this halves the scan time.
  //
  // fuzzy 매칭은 쿼리마다 키워드 수만큼(~18K회) 이 함수를 호출하므로, DP 행
  // 두 개를 매번 새로 할당하지 않고 필요할 때만 키우는 모듈 레벨 버퍼로 재사용
  // — 스캔 시간이 절반으로 줄어듦.
  if (lenB + 1 > rowA.length) {
    rowA = new Uint16Array(lenB + 1)
    rowB = new Uint16Array(lenB + 1)
  }

  let prev = rowA
  let curr = rowB

  for (let j = 0; j <= lenB; j++) prev[j] = j

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i

    let rowMin = i

    const aCode = a.charCodeAt(i - 1)

    for (let j = 1; j <= lenB; j++) {
      const sub = prev[j - 1] + (aCode === b.charCodeAt(j - 1) ? 0 : 1)
      const ins = curr[j - 1] + 1
      const del = prev[j] + 1
      const v = sub < ins ? (sub < del ? sub : del) : ins < del ? ins : del

      curr[j] = v

      if (v < rowMin) rowMin = v
    }

    if (rowMin > max) return null

    const swap = prev
    prev = curr
    curr = swap
  }

  const dist = prev[lenB]

  return dist <= max ? dist : null
}
