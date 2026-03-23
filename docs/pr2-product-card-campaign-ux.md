# PR2: 캠페인 대표 배지 UI/UX 강화

## 요약

- PR1의 **데이터 소스(`product.campaigns`)** 는 유지하고, **보이는 방식**만 정리했습니다.
- **추천 / 인기 / 신규** 와 **기타 campaign** 의 시각 계층을 분리하고, 카드 유형별 **표현 강도**를 달리했습니다.
- **대표 캠페인 1개**에 대해 라벨 매핑 기반 **피치 1줄**을 추가했습니다 (관리자 스키마 변경 없음).

## 비주얼 시스템

- 유틸: `src/lib/productCampaignPresentation.ts`  
  - `getCampaignBadgeTone` / `getCampaignBadgeClassName` / `getCampaignBadgeDescription` / `getCampaignPitchForLabel` / `resolveCampaignCardKind`
- 공통 UI: `src/components/products/ProductCampaignBadge.tsx`
- **추천**: 브랜드 primary (`--primary` / `--on-primary`)
- **인기**: 블루 톤 (추천보다 한 단계 절제)
- **신규**: 에메랄드 톤 (선명한 신상 느낌)
- **기타 campaign**: 슬레이트 다크 pill (과하지 않게 분명히)

## 1·2번째 배지 위계

- 최대 2개 규칙 유지.
- **1번째**: 전체 톤·크기 기준의 대표 배지.
- **2번째**: 반투명 다크 pill + 약한 ring, 글자 크기 소폭 축소 (같은 강도로 경쟁하지 않음).

## 카드 유형별 강도

| kind | 적용 | 배지 | 피치 문구 |
|------|------|------|-----------|
| `related` | 연관/가이드 세로 카드 | 가장 큰 pill | 표시 |
| `list` | 데스크톱 목록 카드 | 중간 | 표시 |
| `mobile` | 모바일 목록 | 컴팩트 + 세로 스택 | 표시 (짧게) |
| `home` | 홈 큐레이션 | related·grid 사이 | 표시 (짧게) |
| `grid` | 그리드 카드 | 최소 크기, **이미지에 1개만** | **생략** |

- 카탈로그: `campaignPresentationKind: "list"` / `"mobile"` 로 피치 계산 (`ProductCatalogSection`).

## 피치 문구 (라벨 매핑)

- 추천 → `MD가 추천하는 일정`
- 인기 → `요즘 많이 찾는 상품`
- 신규 → `최근 등록된 기획 상품`
- 기타 → `{label} 기획 상품` (길이 상한으로 truncate)

`productToProductCardProps`가 `campaignPitchLine`을 함께 내려줍니다. `ProductCard`는 **related** 에서 가격 아래·가이드 `selectionHighlightLine`과 **별도 슬롯**으로 피치를 둡니다.

## 정보성 칩과의 분리

- `src/lib/productCardSignals.ts` 의 `infoDisplayChipSurfaceClass`: 테마/상태 칩을 **muted·surface 톤**으로 낮춤.
- 대표 배지는 `ProductCampaignBadge`만 사용 — 정보 칩과 동일 컴포넌트/강한 accent를 쓰지 않음.

## 하지 않은 것 (PR2 범위 밖)

- taxonomy 스키마 변경, campaign별 편집 필드, 정렬 로직 변경 없음.

## 후속 PR 아이디어

- 관리자에서 campaign별 **표시 라벨 / 피치 문구 / 노출 여부** 제어
- 캠페인별 아이콘·토큰 확장
