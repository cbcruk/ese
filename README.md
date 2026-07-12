# ese

Fuzzy emoji search engine with Levenshtein matching and Korean choseong (초성) support.

오타 허용 (`aple` → 🍎) 및 한국어 초성 검색 (`ㅅㄱ` → 🍎)을 지원하는 이모지 검색 엔진.

## Features

- **Fuzzy matching** — `aple`, `appel`, `appl` 모두 🍎로 매칭 (Levenshtein 거리 ≤ 2)
- **Korean choseong** — `사과`, `사ㄱ`, `ㅅㄱ` 모두 🍎로 매칭. 점진적 입력에 대응
- **Concept search** — `축하`/`celebration` → 🎉, `졸림`/`sleepy` → 😴 처럼 감정·상황 개념어로 검색. 큐레이션된 매핑(한/영)이라 임베딩·네트워크 없이 오프라인 유지
- **Pre-built index** — ~2K emojis · ~9K keywords가 번들에 임베드 (한국어 초성 변형 ~2K개는 런타임에 확장). cold start ~3ms
- **Personalization** — recency + frequency 기반 자동 boost
- **Tiny** — ~85KB gzipped (코드 + 인덱스 데이터)
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
search.query('축하')   // 개념어 → 🎉 🎊 🥳
search.query('sleepy') // 개념어(영어) → 😴 💤 🥱

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

한국어 음절은 초성(첫 자음)으로 분해 가능합니다. 사용자가 단축 입력으로 초성만 치는 경우가 흔하므로, 인스턴스 생성 직후 microtask에서 점진적 초성 변형을 모두 인덱스에 펼쳐 둡니다 (번들 사이즈 절감).

| Input    | Matches | 설명                          |
|----------|---------|-------------------------------|
| `사과`   | 🍎      | 완성형 한국어 키워드          |
| `사ㄱ`   | 🍎      | 부분 초성 (사 + ㄱ)           |
| `ㅅㄱ`   | 🍎      | 전체 초성 (ㅅ + ㄱ)           |
| `ㄱㅇㅈ` | 🐶      | 강아지 → ㄱ + ㅇ + ㅈ         |
| `ㅋㅍ`   | ☕      | 커피 → ㅋ + ㅍ                |

런타임 비용은 ASCII 쿼리와 동일 — 변형 인덱스는 microtask에서 한 번 생성된 뒤 캐싱됩니다.

## Concept Search

표층(철자) 매칭만으로는 `축하`, `졸림`, `마감` 같은 **감정·상황 개념어**로 이모지를 찾기 어렵습니다. `data/concepts.json`은 개념어(한/영) → 이모지 매핑을 큐레이션해, 빌드 시 일반 키워드로 인덱스에 펼칩니다. 별도 런타임 로직 없이 기존 exact/prefix/fuzzy 티어를 그대로 통과하며, 한국어 개념어는 초성 확장(`축하` → `ㅊㅎ`)까지 자동으로 얻습니다.

| Input          | Matches   | 설명                       |
|----------------|-----------|----------------------------|
| `축하` / `celebration` | 🎉 🎊 🥳 | 축하 상황                  |
| `졸림` / `sleepy`      | 😴 💤 🥱 | 졸린 상태                  |
| `마감` / `deadline`    | ⏰ 😱 🔥 | 마감 압박                  |
| `대박` / `lit`         | 🔥 💯 🤯 | 감탄                       |
| `ㅊㅎ`                 | 🎉        | 개념어 초성 검색           |

임베딩·벡터 DB·네트워크 없이 **큐레이션 데이터 ~0.5KB(gzip)** 만 더해 개념 검색을 제공합니다. 개념어가 `emojilib`에 이미 존재하는 영어 키워드(예: `celebration`)와 겹치면 동일한 exact 티어(1.0)로 병합되므로, 큐레이션한 이모지가 우연히 겹친 매치보다 반드시 상위에 오지는 않습니다. `emojilib`에 없는 개념어(대부분의 한국어 및 추상어)는 최상위로 노출됩니다.

## Data Sources

- [`emojilib`](https://github.com/muan/emojilib) — 영어 키워드
- [`unicode-emoji-json`](https://github.com/muan/unicode-emoji-json) — 이모지 메타데이터 (이름, 그룹)
- `data/ko-keywords.json` — 1차 작성된 한국어 키워드 매핑 (~700개 이모지)
- `data/concepts.json` — 1차 작성된 개념어(한/영) → 이모지 매핑 (~127개 개념)

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
