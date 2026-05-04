# ese

Fuzzy emoji search engine with Levenshtein matching and Korean choseong (초성) support.

오타 허용 (`aple` → 🍎) 및 한국어 초성 검색 (`ㅅㄱ` → 🍎)을 지원하는 이모지 검색 엔진.

## Features

- **Fuzzy matching** — `aple`, `appel`, `appl` 모두 🍎로 매칭 (Levenshtein 거리 ≤ 2)
- **Korean choseong** — `사과`, `사ㄱ`, `ㅅㄱ` 모두 🍎로 매칭. 점진적 입력에 대응
- **Pre-built index** — ~2K emojis · ~11K keywords가 번들에 임베드. cold start ~3ms
- **Personalization** — recency + frequency 기반 자동 boost
- **Tiny** — ~100KB gzipped (코드 + 인덱스 데이터)
- **Pure TypeScript** — native 의존성 없음, 브라우저 호환

## Install

```bash
pnpm add ese
# or
npm install ese
```

## Quick Start

```ts
import { EmojiSearch } from 'ese'

const search = new EmojiSearch()

search.query('apple')
// → [{ emoji: '🍎', name: 'red apple', group: 'Food & Drink', score: 1.0 }, ...]

search.query('aple')   // 오타 허용
search.query('사과')   // 한국어 키워드
search.query('ㅅㄱ')   // 초성 검색

// 사용자가 이모지를 선택했을 때 호출 → 다음 검색에서 해당 이모지 우선 노출
search.recordUsage('🍎')
```

## API

### `new EmojiSearch(options?)`

| Option | Type | Default | Description |
|---|---|---|---|
| `maxResults` | `number` | `20` | 쿼리당 반환되는 최대 결과 수 |
| `typoTolerance` | `0 \| 1 \| 2` | `2` | Fuzzy 허용 거리. `0`이면 fuzzy 비활성, `1`은 오타 1개, `2`는 distance-2 fallback까지 |

### `query(input: string): SearchResult[]`

`score` 내림차순으로 정렬된 매칭 결과 반환. 빈 입력은 빈 배열.

```ts
interface SearchResult {
  emoji: string   // "🍎"
  name: string    // "red apple"
  group: string   // "Food & Drink"
  score: number   // [0.0, 1.05] — exact 1.0, prefix 0.8, fuzzy 0.4–0.6
}
```

### `recordUsage(emoji: string): void`

사용자가 이모지를 실제로 선택(insert/copy)했을 때 호출. hover/preview에서는 호출하지 않음. 사용 데이터는 메모리에만 보관 — 세션 간 유지하려면 호출자가 직접 영속화.

### `clearUsage(): void`

메모리에 쌓인 개인화 데이터를 모두 초기화.

## Search Pipeline

다층 매칭 구조. 각 티어는 "first wins" 방식으로 점수를 부여하므로, 상위 티어로 매칭된 이모지는 더 좋은 점수를 유지.

| 티어 | 매칭                | 점수  | 최소 쿼리 길이 |
|------|--------------------|-------|----------------|
| 1    | Exact              | 1.0   | 1              |
| 2    | Prefix             | 0.8   | 1              |
| 3    | Levenshtein dist 1 | 0.6   | 3 bytes        |
| 4    | Levenshtein dist 2 | 0.4   | 4 bytes (fallback) |

- 이름 매치 tie-breaking boost: 정확 일치 시 `+0.05`, 부분 포함 시 `+0.02`
- 개인화 boost (recency + frequency): 최대 `+0.25`

## Korean Choseong

한국어 음절은 초성(첫 자음)으로 분해 가능합니다. 사용자가 단축 입력으로 초성만 치는 경우가 흔하므로, 빌드 타임에 점진적 초성 변형을 모두 인덱스에 펼쳐 둡니다.

| Input    | Matches | 설명                          |
|----------|---------|-------------------------------|
| `사과`   | 🍎      | 완성형 한국어 키워드          |
| `사ㄱ`   | 🍎      | 부분 초성 (사 + ㄱ)           |
| `ㅅㄱ`   | 🍎      | 전체 초성 (ㅅ + ㄱ)           |
| `ㄱㅇㅈ` | 🐶      | 강아지 → ㄱ + ㅇ + ㅈ         |
| `ㅋㅍ`   | ☕      | 커피 → ㅋ + ㅍ                |

런타임 비용은 ASCII 쿼리와 동일 — 변형은 모두 사전 계산되어 있습니다.

## Data Sources

- [`emojilib`](https://github.com/muan/emojilib) — 영어 키워드
- [`unicode-emoji-json`](https://github.com/muan/unicode-emoji-json) — 이모지 메타데이터 (이름, 그룹)
- `data/ko-keywords.json` — 1차 작성된 한국어 키워드 매핑 (~700개 이모지)

## Development

```bash
pnpm install
pnpm build           # build:index → tsc
pnpm test            # 149 tests
pnpm bench           # vitest benchmarks
pnpm lint            # oxlint
pnpm format          # oxfmt
```

## License

MIT
