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

/**
 * Longest pattern {@link createLevenshteinMatcher} handles with bit-parallel
 * matching — one bit per pattern character in a 32-bit integer.
 *
 * {@link createLevenshteinMatcher}가 비트 병렬로 처리하는 최대 패턴 길이 —
 * 32비트 정수에 패턴 문자당 1비트.
 */
const MAX_BIT_PARALLEL_LENGTH = 32

/**
 * Compiles a pattern into a function returning its capped Levenshtein
 * distance to a text, for scanning many texts against one pattern.
 *
 * Uses Myers' bit-parallel algorithm, which advances a whole DP column per
 * text character with a handful of bitwise operations instead of filling it
 * cell by cell. Patterns longer than {@link MAX_BIT_PARALLEL_LENGTH} fall
 * back to {@link levenshteinCapped}. Results are identical either way.
 *
 * 하나의 패턴을 여러 텍스트와 비교할 때 쓰도록, 패턴을 텍스트까지의 capped
 * Levenshtein 거리를 반환하는 함수로 컴파일.
 *
 * Myers 비트 병렬 알고리즘 사용 — DP 열을 셀 단위로 채우는 대신 텍스트
 * 문자마다 비트 연산 몇 번으로 열 전체를 진행. {@link MAX_BIT_PARALLEL_LENGTH}
 * 보다 긴 패턴은 {@link levenshteinCapped}로 fallback. 결과는 어느 쪽이든 동일.
 *
 * @example
 * ```ts
 * import { createLevenshteinMatcher } from './levenshtein.js'
 *
 * const distanceTo = createLevenshteinMatcher('aple')
 * distanceTo('apple', 2) // 1
 * distanceTo('banana', 2) // null
 * ```
 */
export function createLevenshteinMatcher(
  pattern: string,
): (text: string, max: number) => number | null {
  const m = pattern.length

  if (m === 0 || m > MAX_BIT_PARALLEL_LENGTH) {
    return (text, max) => levenshteinCapped(pattern, text, max)
  }

  const peq = new Map<number, number>()

  for (let i = 0; i < m; i++) {
    const code = pattern.charCodeAt(i)
    peq.set(code, (peq.get(code) ?? 0) | (1 << i))
  }

  const lastBit = 1 << (m - 1)

  return (text, max) => {
    const n = text.length

    if (Math.abs(m - n) > max) return null

    let pv = -1
    let mv = 0
    let distance = m

    for (let j = 0; j < n; j++) {
      const eq = peq.get(text.charCodeAt(j)) ?? 0
      const xv = eq | mv
      const xh = (((eq & pv) + pv) ^ pv) | eq
      let ph = mv | ~(xh | pv)
      let mh = pv & xh

      if (ph & lastBit) distance++
      else if (mh & lastBit) distance--

      ph = (ph << 1) | 1
      mh <<= 1
      pv = mh | ~(xv | ph)
      mv = ph & xv
    }

    return distance <= max ? distance : null
  }
}
