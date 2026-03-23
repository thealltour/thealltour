# PR1: 상품 카드 대표 배지 — `campaign` 단일 1차 소스

## 요약

- **대표 배지(이미지 오버레이·캠페인 큐레이션)** 의 데이터 소스를 **`product.campaigns`**(기획/추천 taxonomy에서 붙이는 값)으로 통일했습니다.
- **테마·상태** 는 **정보성 칩** 으로만 쓰며, 대표 배지 오버레이와 **역할·렌더 위치를 분리**했습니다.

## 왜 campaign을 source of truth로 했는가

- 기획 의도상 배지는 taxonomy의 **campaign** 에서 정의하고 상품 등록 시 붙이는 **CMS형 구조**에 맞추기 위함입니다.
- 지역/테마/상품군 탭 데이터는 **정렬·필터·정보 제공** 용도로 유지하고, **카드 상단 “대표” 시각 계층**은 campaign만 담당하게 했습니다.

## `is_recommend` / `is_popular` fallback

- **`product.campaigns`에 유효 라벨이 하나라도 있으면** boolean 플래그는 **대표 배지에 사용하지 않습니다** (중복 방지).
- **campaigns가 비어 있을 때만** `is_recommend` → 「추천」, `is_popular` → 「인기」를 **하위 호환용**으로 추가합니다.
- campaigns에 이미 「추천」「인기」 문자열이 있으면, 같은 의미의 플래그로 **이중 배지가 나오지 않습니다**.

## theme / status를 대표 배지에서 분리한 이유

- 테마 문자열(`getProductBadges`)은 **상품 이해 보조** 성격이 강하고, 캠페인 큐레이션과 **같은 시각 강도로 올리면 신호가 섞입니다**.
- 재고/상담 상태(마감, 마감임박, 상담 후 안내)는 **정보성 칩** 으로 유지하고, **캠페인 오버레이와 같은 줄에서 경쟁하지 않게** 했습니다.

## 적용한 카드 컴포넌트

- `ProductCard` — **grid·list**: 이미지 좌상단에 캠페인 오버레이, 본문 상단 행은 정보 칩만. **related**: 기존처럼 이미지 오버레이는 캠페인(+ `topPickLabel`), 본문 상단에 정보 칩 행 추가.
- `ProductListCard`, `ProductListCardMobile`
- `HomeProductCard`
- 관리자 미리보기: `productToCardPropsPayload` (`src/lib/admin/productPreview.ts`)

## 구현 메모

- 우선순위(문자열 기반, taxonomy 스키마 변경 없음): **추천 > 인기 > 신규 > 기타**(동일 그룹 내 `localeCompare("ko")`).
- 대표 배지 **최대 2개** — `src/lib/productCampaignBadges.ts` 에 집중.
- 정보 칩: `pickInfoDisplayChips` — `src/lib/productCardSignals.ts`.
- **상품 목록 정렬·필터 로직은 변경하지 않음** (카드 표시만).

## 후속 PR에서 다룰 수 있는 영역

- campaign별 **관리자 표시 라벨 / 설명문** 확장
- 캠페인 배지 **비주얼 토큰** 세분화 (현재는 기존 칩 스타일 유지)
- taxonomy 스키마에 **우선순위·표시명 필드**를 두고 문자열 매칭 축소
