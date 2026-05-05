/**
 * Decoders for the compact wire format of `data.generated.ts`. Two
 * encodings are used to shrink the bundled payload:
 *
 * 1. **Front-coded keywords** — a sorted string array stored as
 *    `[sharedPrefixLen, suffix]` tuples. Each entry reuses the leading
 *    bytes of its predecessor.
 * 2. **Delta + varint postings** — sorted ID arrays stored as base64-packed
 *    LEB128 unsigned varints over consecutive deltas, prefixed by the list
 *    length (also a varint).
 *
 * Together these cut the wire (gzipped) payload by ~10% and the raw
 * payload by ~20%, with negligible decode cost amortized over the lifetime
 * of the cached index.
 *
 * `data.generated.ts`의 컴팩트 wire 포맷을 디코드. 번들 payload 절감을
 * 위해 두 가지 인코딩 사용:
 *
 * 1. **Front-coded keywords** — 정렬된 문자열 배열을
 *    `[공유prefix길이, 나머지]` 튜플로 저장. 각 항목은 이전 항목의 앞부분을
 *    재사용.
 * 2. **Delta + varint postings** — 정렬된 ID 배열을 연속 차이값에 대한
 *    base64-packed LEB128 unsigned varint로 저장. 리스트 길이가 앞에
 *    varint로 prefix.
 *
 * 두 인코딩 합쳐서 wire(gzip) payload를 ~10%, raw payload를 ~20% 절감.
 * 디코드 비용은 캐시된 인덱스 수명 전체에 amortize되어 무시 가능.
 */

/**
 * Reconstructs a sorted string array from its front-coded form.
 *
 * Front-coded 형식에서 정렬된 문자열 배열을 복원.
 */
export function decodeFrontCoded(encoded: Array<[number, string]>): string[] {
  const out: string[] = []
  let prev = ''

  for (let i = 0; i < encoded.length; i++) {
    const [shared, suffix] = encoded[i]
    const s = prev.slice(0, shared) + suffix
    out.push(s)
    prev = s
  }

  return out
}

/**
 * Reconstructs `count` sorted ID arrays from a base64-packed delta+varint stream.
 *
 * base64-packed delta+varint 스트림으로부터 `count`개의 정렬된 ID 배열을 복원.
 */
export function decodePostings(b64: string, count: number): number[][] {
  const bytes = base64ToBytes(b64)
  const result: number[][] = []
  let pos = 0

  for (let i = 0; i < count; i++) {
    let len = 0
    let shift = 0
    while (true) {
      const b = bytes[pos++]
      len |= (b & 0x7f) << shift
      if ((b & 0x80) === 0) break
      shift += 7
    }

    const list: number[] = []
    let prev = 0

    for (let j = 0; j < len; j++) {
      let delta = 0
      shift = 0
      while (true) {
        const b = bytes[pos++]
        delta |= (b & 0x7f) << shift
        if ((b & 0x80) === 0) break
        shift += 7
      }
      prev += delta
      list.push(prev)
    }

    result.push(list)
  }

  return result
}

/**
 * Cross-runtime base64 → byte array. `atob` is part of the WHATWG spec
 * and is globally available in browsers and Node ≥ 16.
 *
 * 크로스 런타임 base64 → 바이트 배열. `atob`은 WHATWG 표준으로 브라우저와
 * Node ≥ 16에서 전역 사용 가능.
 */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)

  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i)
  }

  return bytes
}
