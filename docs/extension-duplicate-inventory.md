# Browser extension inventory (duplicate extraction logic)

## Packages under `tools/`

| Folder | Role | Deployed via admin ZIP? |
|--------|------|-------------------------|
| `tools/thealltour_extension` | **통합 SSOT** — 하나투어 + 모두투어 수집 → 관리자 AI 임포트 | Yes (`thealltour-extension` slug in `src/lib/extensionBuilds.ts`) |
| `tools/modetour-extractor-extension` | 모두투어 전용 추출기 (레거시/병행) | Yes (`modetour` slug) |
| `tools/hanatour-extractor-extension` | 하나투어 전용 추출기 (레거시) | No (not in `EXTENSION_SLUGS`) |

## Overlap notes

- Calendar / itinerary / HTML context extract logic is concentrated in `thealltour_extension` (`htmlContextExtract.js`, `itineraryDomExtract.js`, `hanatourCalendar*.js`, …).
- `hanatour-extractor-extension` and `modetour-extractor-extension` still contain parallel DOM helpers under their own `src/lib` trees.
- **Do not delete or merge folders** until download pipelines and admin guides are updated. Prefer copying fixes into `thealltour_extension` first.

## Safe next steps

1. Keep fixing bugs in `thealltour_extension` as the primary product.
2. Diff twin helpers vs legacy extractors; document function-level duplicates before extracting a shared package.
3. Only after inventory + ZIP consumers are confirmed, deprecate unused extractor folders.
