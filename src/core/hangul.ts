/**
 * Unicode code-point boundaries for Hangul.
 * (한글 관련 Unicode 코드포인트 경계값.)
 */
const HangulCodePoint = {
  SyllableBase: 0xac00,
  SyllableEnd: 0xd7a3,
  CompatJamoBase: 0x3130,
  CompatJamoEnd: 0x318f,
} as const

/**
 * Returns `true` if the string contains any Hangul compatibility jamo
 * (U+3130–U+318F) — the standalone consonants/vowels users type for
 * choseong search (e.g. `ㅅ`, `ㄱ`). A fast pre-check for whether a query
 * needs choseong-variant matching.
 *
 * 문자열에 한글 호환 자모(U+3130–U+318F)가 포함되어 있으면 `true`. 사용자가
 * 초성 검색용으로 입력하는 단독 자음/모음(예: `ㅅ`, `ㄱ`). 쿼리에 초성
 * 변형 매칭이 필요한지 빠르게 사전 판단.
 */
export function containsCompatJamo(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const cp = s.charCodeAt(i)
    if (cp >= HangulCodePoint.CompatJamoBase && cp <= HangulCodePoint.CompatJamoEnd) {
      return true
    }
  }
  return false
}

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
