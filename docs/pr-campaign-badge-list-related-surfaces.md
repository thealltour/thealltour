# PR: Campaign 배지 공통 소스 + related / list / mobile 표면 분리

## 왜 카드 컴포넌트 통합 대신 badge system 공통화인가

- **related**는 큐레이션·발견(이미지 위 강한 오버레이, 피치 1줄 허용).
- **list**는 비교·스캔(밀도·가독성 우선, 이미지 위 큰 배지는 정보 흐름을 깸).
- 한 컴포넌트로 합치면 한쪽 UX가 반드시 손상되므로, **데이터 파이프라인만 공통**하고 **표현 위치·강도는 카드별 유지**.

## 공통 소스

- `buildCampaignRepresentativeBadges(product, { max })` — campaign / `campaign_card_meta` 단일 진입점.
- `productToProductCardProps` — `campaignPresentationKind`가 `list` | `mobile`이면 기본 `max: 1`, `omitCampaignPitch: true`.
- 상수 `CAMPAIGN_BADGE_MAX` — related/grid/home 2, list·모바일 리스트 1.

## 표현 정책

| 표면 | 위치 | max | 피치 |
|------|------|-----|------|
| related / grid 오버레이 | 이미지 좌상단 | 2 | 유지 |
| ProductCard `layout=list` | 제목 위 인라인 `sm` + `surface=inline` | 1 | 없음 |
| ProductListCard / Mobile | 제목·칩 위 인라인 | 1 | 생략 |
| HomeProductCard | 이미지 오버레이 | 2 | 유지 |

## UI 레이어

- `ProductCampaignBadge`: `size` (`sm` | `md`), `surface` (`overlay` | `inline`).
- `getCampaignBadgeClassName`: 인라인은 밝은 배경용 링/톤, 보조(2번째)는 절제된 테두리 칩.

## /destinations · /themes 하위 추천 섹션

- `CuratedBlock` + `featuredLanding`은 **ProductCard `layout=related`** — 기존처럼 이미지 오버레이 + 최대 2배지, 동일 소스.
- 상품 목록 **리스트**(`/products` 등)는 **ProductListCard** — 위 정책으로 제목 위 소형 배지 1개만.

## QA 포인트

1. related: 배지 2개·오버레이·피치 유지.
2. 목록 리스트: 배지 1개·제목 위·피치 없음.
3. 모바일 리스트: 배지 1개·좁은 폭 truncate.
4. 홈 카드: 소스 동일, max 2 유지.
