# PR: favicon / 브랜드 아이콘 캐시 무효화 / Organization JSON-LD

## 목적

구글 검색 결과 등에서 레거시 파비콘·로고가 노출되는 문제 완화를 위해, `/favicon.ico` 명시, PNG 아이콘 버전 접미사(`-v2`), 루트 `Organization` 구조화 데이터를 추가했다.

## 변경 요약

| 항목 | 내용 |
|------|------|
| `public/favicon.ico` | 신규 (32·16 PNG 기반 멀티 해상도 ICO) |
| `public/favicon-16-v2.png`, `favicon-32-v2.png`, `apple-touch-icon-v2.png` | 기존 PNG를 `-v2`로 복사 후 사용 (캐시 무효화) |
| `public/favicon-16.png` 등 레거시 | 제거 (코드에서 미참조) |
| `src/lib/brandAssets.ts` | 파비콘·애플 터치 경로를 `*-v2.png`로 변경 |
| `src/app/layout.tsx` | `metadata.icons`에 `/favicon.ico` 추가, `shortcut` → `/favicon.ico`, `Organization` JSON-LD 스크립트 추가 |
| `scripts/build-favicon-ico.mjs` | ICO 재생성용 |
| `npm run favicon:build` | 위 스크립트 실행 |
| `devDependencies` | `png-to-ico` (ICO 생성용) |

## 배포 후 확인

1. `https://thealltour.com/favicon.ico` — 새 아이콘
2. 페이지 소스: `rel="icon"`에 `favicon.ico` 포함, `organization-jsonld`에 `logo` 절대 URL
3. Search Console에서 홈 URL 색인 요청 (반영은 수일 소요 가능)
