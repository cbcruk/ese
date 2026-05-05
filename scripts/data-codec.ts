/**
 * Build-time encoders matching the runtime decoders in
 * `src/core/data-codec.ts`. See that file for the format spec.
 *
 * `src/core/data-codec.ts`의 런타임 디코더와 짝을 이루는 빌드 타임 인코더.
 * 포맷 명세는 해당 파일 참조.
 */

/**
 * Front-codes a sorted string array. Each entry stores the length of the
 * shared prefix with the previous entry plus its remaining suffix.
 *
 * 정렬된 문자열 배열을 front-code. 각 항목은 이전 항목과 공유하는 prefix
 * 길이 + 나머지 suffix를 저장.
 */
export function encodeFrontCoded(sorted: string[]): Array<[number, string]> {
  const out: Array<[number, string]> = []
  let prev = ''

  for (const s of sorted) {
    let shared = 0
    const max = Math.min(prev.length, s.length)

    while (shared < max && prev.charCodeAt(shared) === s.charCodeAt(shared)) shared++

    out.push([shared, s.slice(shared)])
    prev = s
  }

  return out
}

/**
 * Encodes sorted ID lists as a base64 string of LEB128 unsigned varints
 * over consecutive deltas, each list prefixed by its length (also a varint).
 *
 * 정렬된 ID 리스트를 연속 차이값에 대한 LEB128 unsigned varint 시퀀스로
 * 인코드해 base64 문자열로 반환. 각 리스트는 길이(역시 varint)로 prefix.
 */
export function encodePostings(postings: number[][]): string {
  const bytes: number[] = []

  for (const list of postings) {
    pushVarint(bytes, list.length)
    let prev = 0
    for (const id of list) {
      pushVarint(bytes, id - prev)
      prev = id
    }
  }

  return Buffer.from(bytes).toString('base64')
}

function pushVarint(out: number[], n: number): void {
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80)
    n >>>= 7
  }
  out.push(n & 0x7f)
}
