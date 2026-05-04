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
}

/**
 * Reads the three data sources the index is built from: English keyword
 * lists (`emojilib`), display metadata (`unicode-emoji-json`), and the
 * first-party Korean keyword mappings.
 *
 * 인덱스 빌드에 사용되는 3개 데이터 소스를 로드: 영어 키워드(`emojilib`),
 * 표시용 메타(`unicode-emoji-json`), 그리고 1차 한국어 키워드 매핑.
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
  }
}
