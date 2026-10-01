import type { EmojiTable } from './build-emoji-table.ts'
import type { RawInputs } from './load-inputs.ts'

/**
 * Lists emoji IDs from most to least frequently used, for breaking score ties
 * at runtime.
 *
 * 사용 빈도가 높은 순서대로 이모지 ID를 나열 — 런타임 동점 처리에 사용.
 *
 * `frequency` is Unicode's ranked emoji frequency list, grouped by halving
 * frequency and ordered by frequency within each group, so flattening it gives
 * a total ranking. Emojis missing from the table are skipped; emojis absent
 * from the ranking (newer emojis, gender and skin-tone variants) are left out
 * and rank after every listed emoji.
 *
 * @returns Emoji IDs, most frequent first.
 */
export function buildPopularityOrder(
  frequency: RawInputs['frequency'],
  table: EmojiTable,
): number[] {
  const ids: number[] = []
  const seen = new Set<number>()

  for (const emoji of frequency.flat()) {
    const id = table.emojiIdMap.get(emoji)
    if (id === undefined || seen.has(id)) continue

    seen.add(id)
    ids.push(id)
  }

  return ids
}
