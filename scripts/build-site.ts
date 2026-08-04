import { cpSync, mkdirSync, rmSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

/**
 * Assembles the GitHub Pages site into `_site/`.
 *
 * The library is pure ESM with zero runtime dependencies, so no bundler is
 * needed — the demo page loads the compiled `dist/` directly as native
 * browser ES modules. This script just stages the static files: the demo
 * page plus the compiled library (which embeds the search index).
 *
 * Run `pnpm build` first so `dist/` exists (the `build:site` script does).
 *
 * GitHub Pages 사이트를 `_site/`로 조립.
 *
 * 라이브러리는 런타임 의존성이 0인 순수 ESM이라 번들러가 불필요 — 데모
 * 페이지가 컴파일된 `dist/`를 브라우저 네이티브 ES 모듈로 직접 로드. 이
 * 스크립트는 정적 파일(데모 페이지 + 인덱스가 임베드된 컴파일 라이브러리)만
 * 스테이징.
 *
 * `dist/`가 존재하도록 먼저 `pnpm build` 실행 필요(`build:site` 스크립트가 처리).
 */
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const out = resolve(root, '_site')

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync(resolve(root, 'demo'), out, { recursive: true })
cpSync(resolve(root, 'dist'), resolve(out, 'dist'), { recursive: true })

console.log(`Built site → ${out}`)
