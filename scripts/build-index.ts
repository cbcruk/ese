import { writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import { buildEmojiTable } from './build-emoji-table.ts'
import { buildInvertedIndex } from './build-inverted-index.ts'
import { loadInputs } from './load-inputs.ts'
import { serializeAsTsModule } from './serialize.ts'

/**
 * Entry point. Loads inputs, builds the index, and writes the generated
 * TS module to `src/core/data.generated.ts`.
 *
 * 진입점. 입력을 로드하고 인덱스를 빌드한 뒤 생성된 TS 모듈을
 * `src/core/data.generated.ts`에 기록.
 */
function main(): void {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const root = resolve(__dirname, '..')
  const outFile = resolve(root, 'src/core/data.generated.ts')

  const inputs = loadInputs(root)
  const table = buildEmojiTable(inputs.emojilib, inputs.meta)
  const index = buildInvertedIndex(inputs, table)
  const fileContents = serializeAsTsModule(table, index)
  writeFileSync(outFile, fileContents)
  const payloadKB = (fileContents.length / 1024).toFixed(1)

  console.log(
    `Generated ${outFile}: ${table.emojis.length} emojis, ${table.groups.length} groups, ` +
      `${index.keywords.length} keywords, ${payloadKB}KB`,
  )
}

main()
