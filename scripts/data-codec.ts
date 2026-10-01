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

/**
 * Encodes the original order of each list as one base-36 digit per element,
 * so lists can be stored sorted (for {@link encodePostings}) and restored.
 *
 * 각 리스트의 원래 순서를 원소당 base-36 숫자 하나로 인코딩 — 리스트를
 * 정렬된 상태로 저장({@link encodePostings}용)한 뒤 원래 순서로 복원 가능.
 *
 * @param lists Lists in their original order, each at most 36 long.
 * @returns For each list sorted ascending, the original position of each
 * element, concatenated across lists.
 */
export function encodeListOrder(lists: number[][]): string {
  let out = ''

  for (const list of lists) {
    if (list.length > 36) throw new Error(`List too long to encode order: ${list.length}`)

    const sorted = [...list].sort((a, b) => a - b)
    for (const id of sorted) out += list.indexOf(id).toString(36)
  }

  return out
}

function pushVarint(out: number[], n: number): void {
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80)
    n >>>= 7
  }
  out.push(n & 0x7f)
}
