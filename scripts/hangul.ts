// Build-time only. The runtime index has choseong variants pre-expanded,
// so src/ doesn't need this code.
//
// 빌드 타임 전용. 런타임 인덱스에는 초성 변형이 미리 펼쳐져 있으므로 src/
// 에는 이 코드가 필요 없음.

/**
 * Unicode code-point boundaries for Hangul.
 * (한글 관련 Unicode 코드포인트 경계값.)
 *
 * `as const` over `enum` so the script stays compatible with Node's
 * type-stripping execution (`node scripts/build-index.ts`).
 *
 * `enum`이 아닌 `as const` — Node의 type stripping 실행과 호환 유지.
 */
const HangulCodePoint = {
  SyllableBase: 0xac00,
  SyllableEnd: 0xd7a3,
  CompatJamoBase: 0x3130,
  CompatJamoEnd: 0x318f,
} as const

const JUNGSEONG_COUNT = 21
const JONGSEONG_COUNT = 28
const CHOSEONG = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
]

/**
 * Extracts the leading consonant (choseong) of a Hangul syllable.
 * Returns `null` for non-syllable code points (ASCII, jamo, emoji, etc.).
 *
 * 한글 음절에서 초성(첫 자음)을 추출. 음절이 아닌 코드포인트(ASCII, 자모,
 * 이모지 등)에는 `null` 반환.
 */
function getChoseong(ch: string): string | null {
  const codePoint = ch.codePointAt(0)!

  if (codePoint < HangulCodePoint.SyllableBase || codePoint > HangulCodePoint.SyllableEnd) {
    return null
  }

  const idx = Math.floor(
    (codePoint - HangulCodePoint.SyllableBase) / (JUNGSEONG_COUNT * JONGSEONG_COUNT),
  )

  return CHOSEONG[idx]
}

/**
 * Returns `true` if `codePoint` is a Hangul code point — either a pre-composed
 * syllable (U+AC00–U+D7A3) or a compatibility jamo (U+3130–U+318F).
 *
 * `codePoint`가 한글 코드포인트이면 `true`. 완성형 음절(U+AC00–U+D7A3) 또는
 * 호환 자모(U+3130–U+318F) 모두 포함.
 */
function isHangul(codePoint: number): boolean {
  return (
    (codePoint >= HangulCodePoint.SyllableBase && codePoint <= HangulCodePoint.SyllableEnd) ||
    (codePoint >= HangulCodePoint.CompatJamoBase && codePoint <= HangulCodePoint.CompatJamoEnd)
  )
}

/**
 * Produces progressive choseong variants of a Hangul word so that
 * incremental input narrows results as the user types.
 *
 * `"사과"` → `["ㅅㄱ", "사ㄱ"]` (the original word is not included; the
 * caller indexes that separately).
 *
 * Returns `[]` for non-Hangul input.
 *
 * 한글 단어의 점진적 초성 변형을 생성. 사용자가 한 글자씩 칠 때마다 결과가
 * 좁혀지도록 함.
 *
 * `"사과"` → `["ㅅㄱ", "사ㄱ"]` (원본 단어는 포함 안 함 — 호출자가 별도로
 * 인덱싱).
 *
 * 비-한글 입력에는 `[]` 반환.
 */
export function generateVariants(word: string): string[] {
  const chars = [...word]

  if (chars.length === 0 || !chars.some((c) => isHangul(c.codePointAt(0)!))) {
    return []
  }

  const variants: string[] = []
  const allChoseong = chars.map((c) => getChoseong(c) ?? c).join('')

  if (allChoseong !== word) variants.push(allChoseong)

  for (let split = 1; split < chars.length; split++) {
    const prefix = chars.slice(0, split).join('')
    const suffix = chars
      .slice(split)
      .map((c) => getChoseong(c) ?? c)
      .join('')
    const variant = prefix + suffix

    if (variant !== word && !variants.includes(variant)) {
      variants.push(variant)
    }
  }

  return variants
}
