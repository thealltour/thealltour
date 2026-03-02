# overview_json / ProductOverview 코드베이스 목록

## 1. DB Migration
| 파일 | 내용 |
|------|------|
| `supabase/products_overview_upgrade.sql` | overview_cover_url, overview_json 컬럼 추가 |
| `supabase/products_overview_jsonb_step2.sql` | overview_json jsonb 1컬럼 스키마 |

## 2. 타입 정의
| 파일 | 내용 |
|------|------|
| `src/types/product.ts` | `ProductOverview` 타입, `Product.overview_json?: ProductOverview \| null` |

## 3. API
| 파일 | 내용 |
|------|------|
| `src/app/api/admin/products/route.ts` | POST insert 시 `body.overview_json` → `insertPayload.overview_json` |
| `src/app/api/admin/products/[id]/route.ts` | PATCH update 시 `body.overview_json` → `updates.overview_json` |

## 4. AdminProductManager
| 위치 | 내용 |
|------|------|
| `productFormOpenSections` | `overview: false` |
| 탭 목록 | `{ id: "overview", title: "여행 오버뷰(상세 첫 화면)" }` |
| 탭 콘텐츠 | `{id === "overview" && (...)}` 자동 생성 안내 div |

## 5. 기타
| 파일 | 내용 |
|------|------|
| `src/lib/products.ts` | `normalizeProduct`에서 `overview_json` 읽기, `normalizeOverview` |
| `src/lib/admin/productPreview.ts` | `ProductFormPayload.overview_json?`, `productToDetailV2PropsPayload` |
| `src/components/products/ProductDetailV2.tsx` | `overviewJson`, `overviewFallbackUrl` props |
| `src/app/products/[id]/page.tsx` | `mapProductToOverview(product)` 전달 |
| `src/lib/overview/mapProductToOverview.ts` | Product → ProductOverview 자동 생성 |

## 정리 방향 (STEP 1) ✅ 완료
- **저장 제거**: API insert/update에서 overview_json 처리 제거
- **UI 제거**: Admin 여행 오버뷰 탭 완전 제거
- **표시**: 항상 `mapProductToOverview(product)` 사용 (자동 생성)

## 유지 항목 (자동 생성과 충돌 없음)
- `Product.overview_json`: DB 컬럼/타입 유지 (기존 데이터 호환, 읽기만)
- `src/lib/products.ts` normalizeOverview: DB row 파싱용 유지
