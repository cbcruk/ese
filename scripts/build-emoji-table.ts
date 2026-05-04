import type { RawInputs } from './load-inputs.ts'

export type EmojiTuple = [emoji: string, name: string, groupId: number]

export interface EmojiTable {
  emojis: EmojiTuple[]
  emojiIdMap: Map<string, number>
  groups: string[]
}

/**
 * Assigns a stable numeric ID to each emoji and packs it with its name +
 * group ID into a tuple. Group strings are deduplicated into a separate
 * table — most groups are reused thousands of times across emojis.
 *
 * Emojis are sorted lexicographically before ID assignment so the output
 * is deterministic regardless of input ordering.
 *
 * 각 이모지에 안정적인 숫자 ID를 부여하고 이름 + groupId와 함께 튜플로
 * 패킹. 그룹 문자열은 별도 테이블로 dedup — 대부분의 그룹은 수많은 이모지에
 * 걸쳐 재사용됨.
 *
 * ID 할당 전 이모지 키를 lexicographic 정렬하므로, 입력 순서에 무관하게
 * 결정적(deterministic) 출력 보장.
 */
export function buildEmojiTable(
  emojilib: RawInputs['emojilib'],
  meta: RawInputs['meta'],
): EmojiTable {
  const sortedKeys = Object.keys(emojilib).sort()
  const emojis: EmojiTuple[] = []
  const emojiIdMap = new Map<string, number>()
  const groups: string[] = []
  const groupIdMap = new Map<string, number>()

  for (const emoji of sortedKeys) {
    const m = meta[emoji]
    const groupName = m?.group ?? ''

    let groupId = groupIdMap.get(groupName)
    if (groupId === undefined) {
      groupId = groups.length

      groups.push(groupName)
      groupIdMap.set(groupName, groupId)
    }

    emojiIdMap.set(emoji, emojis.length)
    emojis.push([emoji, m?.name ?? '', groupId])
  }

  return {
    emojis,
    emojiIdMap,
    groups,
  }
}
