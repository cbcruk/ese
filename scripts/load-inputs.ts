import { readFileSync } from 'fs'
import { resolve } from 'path'

interface EmojiMeta {
  name: string
  group: string
}

export interface RawInputs {
  emojilib: Record<string, string[]>
  meta: Record<string, EmojiMeta>
  koKeywords: Record<string, string[]>
  /**
   * First-party concept → emoji mappings. Unlike the other sources, this is
   * keyed by an abstract/emotional term (e.g. `"celebration"`, `"축하"`) and
   * maps to the emojis that express it, giving intent-based search on top of
   * the lexical keyword matching.
   *
   * 1차 concept → 이모지 매핑. 다른 소스와 달리 추상적/감정적 개념어(예:
   * `"celebration"`, `"축하"`)를 키로, 그 개념을 표현하는 이모지들로 매핑 —
   * 표층 키워드 매칭 위에 의도 기반 검색을 얹음.
   */
  concepts: Record<string, string[]>
  /**
   * Unicode's 2019 emoji frequency ranking: groups of emojis, each roughly
   * half as frequent as the previous one, ordered by frequency within a group.
   * Source: https://home.unicode.org/emoji/emoji-frequency/ (Unicode License).
   *
   * Unicode 2019 이모지 사용 빈도 순위. 사용 빈도가 앞 그룹의 약 절반인 그룹들로
   * 나뉘며, 그룹 안에서도 빈도순으로 정렬됨.
   */
  frequency: string[][]
}

/**
 * Reads the data sources the index is built from: English keyword
 * lists (`emojilib`), display metadata (`unicode-emoji-json`), the
 * first-party Korean keyword mappings, the first-party concept mappings, and
 * Unicode's emoji frequency ranking.
 *
 * 인덱스 빌드에 사용되는 데이터 소스를 로드: 영어 키워드(`emojilib`),
 * 표시용 메타(`unicode-emoji-json`), 1차 한국어 키워드 매핑, 1차 concept 매핑,
 * Unicode 이모지 사용 빈도 순위.
 *
 * @param root - Repository root, used to resolve relative paths.
 *               (저장소 루트, 상대 경로 해석에 사용)
 */
export function loadInputs(root: string): RawInputs {
  const readJson = <T>(rel: string): T => JSON.parse(readFileSync(resolve(root, rel), 'utf-8'))

  return {
    emojilib: readJson('node_modules/emojilib/dist/emoji-en-US.json'),
    meta: readJson('node_modules/unicode-emoji-json/data-by-emoji.json'),
    koKeywords: readJson('data/ko-keywords.json'),
    concepts: readJson('data/concepts.json'),
    frequency: readJson('data/emoji-frequency.json'),
  }
}
