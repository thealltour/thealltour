# 아고다 톤 + 프리미엄 네이비 컬러 토큰 교체

## 1. 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/globals.css` | :root / .dark 토큰 값 전면 교체, shadow 전체 box-shadow 값으로 변경, --shadow-color 추가 |
| `src/components/ui/Card.tsx` | shadow 변수를 전체 box-shadow로 사용하도록 수정 |
| `src/app/globals.css` (.surface-card) | box-shadow를 var(--shadow-soft-strong) 단일 값으로 변경 |
| `src/app/login/page.tsx` | shadow-[var(--shadow-soft-strong)] 적용 |
| `src/app/admin/notices/page.tsx` | 동일 |
| `src/components/ProductDetailContentLegacy.tsx` | shadow 토큰 전체 값 적용 |
| `src/components/ProductCard.tsx` | shadow 토큰 전체 값 적용 |
| `src/components/ProductDetailSticky.tsx` | shadow 토큰 적용 |
| `src/components/products/TravelOverviewV2.tsx` | shadow 토큰 적용 |
| `src/components/products/ThemeChartCard.tsx` | shadow + drop-shadow용 --shadow-color 적용 |
| `src/app/products/page.tsx` | 배경/빈 상태 영역 토큰화 (bg-[var(--surface)], ring-[var(--border)], text-[var(--text-muted)]) |
| `src/components/ProductCatalogSection.tsx` | 카테고리/테마 탭, 카드, 스티키 바, 그룹 제목 등 primary/border/surface/text 토큰 적용 |
| `src/components/products/ProductCardV2.tsx` | 배지·채움·제목·메타·가격·해시태그 칩 등 전부 토큰 기반으로 교체 |

---

## 2. 홈 / 카드리스트 / 모달 — 밝기·가독성·프리미엄 톤 차이 요약

### 홈 (app/page.tsx)

- **변경 없음**: 히어로·신뢰 섹션은 기존 네이비(#0F172A)·골드(#B8962E)·site-* 토큰 유지 (의도적 프리미엄 네이비 앵커).
- **영향**: 전역 `:root` 변경으로 페이지 배경이 `#fafafa`(오프화이트)로 바뀌었을 수 있는 부분은 없음(홈은 여전히 `bg-[#0F172A]`). 다른 라이트 페이지들은 더 밝고 부드러운 배경/텍스트를 사용.

### 카드 리스트 (상품 목록·카탈로그)

- **밝기**: 배경이 `from-[var(--surface-muted)] to-[var(--surface)]`(#f6f7f9 → #ffffff) 그라데이션으로, 이전 `from-[#f3f8ff] to-white`보다 뉴트럴하고 눈에 덜 부담됨.
- **가독성**: 본문/보조 텍스트가 `--text-primary`(#0b1220), `--text-muted`(#4b5563), `--text-subtle`(#9aa3b2)로 정리되어 네이비-차콜 계열로 통일되고, placeholder/캡션은 더 연하게 구분됨.
- **프리미엄 톤**: CTA/강조는 `--primary`(#2f6bff) 선명 블루, 보조/테두리는 `--border`(#e6e8ee) 뉴트럴 톤으로 차갑지 않게 맞춤. 카드 그림자는 `--shadow-soft` / `--shadow-soft-strong`로 입체감 유지.

### 모달 / 팝오버

- **연결 상태**: 이미 `--surface-elevated`, `--shadow-modal`, `--overlay` 사용 중 (ConsultModal, HeaderQuickConsultCtas, HeroQuickConsultButton, SignupForm, Modal, AdminConfirmProvider, GuidePdfModal, ThumbnailCropSelector, ProductImageGalleryModal, AdminNotificationBell, ImageCollageModal.module.css).
- **밝기**: 라이트에서 모달 배경이 `--surface-elevated`(#ffffff), 오버레이가 `--overlay`(rgba(11,18,32,0.45))로 더 짙어져 레이어 구분이 명확해짐.
- **입체감**: `--shadow-modal`이 `0 22px 70px rgba(11,18,32,0.2)`로 조정되어 라이트에서 모달이 더 뚜렷하게 떠 보이도록 유지됨.

---

## 3. 토큰 값 요약 (라이트 기준)

| 용도 | 이전 | 이후 |
|------|------|------|
| 페이지 배경 | #f8fafc | #fafafa (오프화이트) |
| Surface | #ffffff | #ffffff |
| Surface muted | #f1f5f9 | #f6f7f9 |
| Border | #e2e8f0 | #e6e8ee (뉴트럴) |
| Text primary | #0f172a | #0b1220 (네이비-차콜) |
| Text muted | #64748b | #4b5563 |
| Text subtle | #94a3b8 | #9aa3b2 |
| Primary (CTA) | #1e3a8a | #2f6bff (선명 블루) |
| Primary hover | #1b3475 | #2457d6 |
| Secondary | 골드 #b8962e | 프리미엄 네이비 #0b1b3a |
| Focus ring | primary 동일 | #79a7ff (연한 블루) |
| Overlay | 0.25 | 0.45 |
| Shadow modal | 25px 50px | 22px 70px, opacity 0.2 |

*다크 모드는 동일 구조로 primary #79a7ff, surface #101a2c, overlay 0.65 등 적용.*
