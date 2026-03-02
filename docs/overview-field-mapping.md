# 오버뷰 자동 생성 필드 매핑표

AdminProductManager(폼) / Product 타입 기준. 오버뷰 구성요소별로 **1순위 필드 → fallback → 없을 때 처리**를 정리한다.

---

## 1. 요약 카드 (Summary Cards)

목표: 항공 / 숙소 / 지역(또는 테마) 등 3개 이상 카드.

### 1-1. 항공 (kind: `flight`)

| 구분 | 소스 | Admin 폼 필드 | Product 필드 |
|------|------|----------------|--------------|
| **1순위** | 출발지 → 도착지 | `departure_from_airport`, `departure_to_airport` | `product.departure_from_airport`, `product.departure_to_airport` |
| **fallback** | 항공편명만 | `departure_flight_name` | `product.departure_flight_name` |
| **없을 때** | 카드 미노출 | — | 요약 카드 목록에 "항공" 카드를 넣지 않음 |

**표시 규칙**
- 둘 다 있으면: `"ICN → 시드니"` 형태
- 출발지만: 출발지명만
- 도착지만: 도착지명만
- 편명만: `departure_flight_name` 그대로
- 모두 없으면: 항공 카드 생략 (고정 문구 "항공 정보는 상담 시 안내" 사용하지 않음)

---

### 1-2. 숙소 (kind: `hotel`)

| 구분 | 소스 | Admin 폼 필드 | Product 필드 |
|------|------|----------------|--------------|
| **1순위** | 카드 부가 문구에서 패턴 추출 | `meta_info` | `product.meta_info` |
| **패턴** | 정규식 `(\d+성\|전일정\s*\d+성\|호텔\|리조트)` 등 | — | — |
| **fallback** | 일정 요약에서 패턴 추출 | — | `product.itinerary` |
| **fallback2** | meta_info 전체(30자 이하) | `meta_info` | `product.meta_info` |
| **없을 때** | 카드 미노출 | — | 요약 카드 목록에 "숙소" 카드 넣지 않음 |

**표시 규칙**
- `meta_info` / `itinerary`에서 "4성", "전일정4성", "호텔", "리조트" 등 매칭 시 해당 문자열 사용
- 매칭 실패하고 `meta_info` 길이 ≤30이면 `meta_info` 전체를 값으로 사용
- 모두 없으면: 숙소 카드 생략

---

### 1-3. 지역 (kind: `region`)

| 구분 | 소스 | Admin 폼 필드 | Product 필드 |
|------|------|----------------|--------------|
| **1순위** | 테마(지역/키워드) | `theme` | `product.theme` |
| **fallback** | 카테고리 | `category` | `product.category` |
| **없을 때** | 카드 미노출 | — | 둘 다 비어 있으면 지역 카드 생략 |

**표시 규칙**
- `theme` 있으면 "지역" 카드로 `theme` 표시
- `theme` 없고 `category` 있으면 `category` 표시 (예: "해외", "국내")

---

### 1-4. 테마 (kind: `theme`)

| 구분 | 소스 | Admin 폼 필드 | Product 필드 |
|------|------|----------------|--------------|
| **1순위** | 테마 | `theme` | `product.theme` |
| **중복 방지** | 지역과 동일하면 생략 | — | region 값과 같으면 테마 카드 추가 안 함 |
| **없을 때** | 카드 미노출 | — | 테마 카드 생략 |

---

### 1-5. 기간 (kind: `etc`, label: "기간")

| 구분 | 소스 | Admin 폼 필드 | Product 필드 |
|------|------|----------------|--------------|
| **1순위** | 기간 문자열 | `duration` | `product.duration` |
| **없을 때** | 카드 미노출 | — | 기간 카드 생략 (타임라인만 있으면 "일정 N일" 카드로 대체 가능) |

---

### 1-6. 기타 (kind: `etc`)

| 구분 | 소스 | Admin 폼 필드 | Product 필드 |
|------|------|----------------|--------------|
| **조건** | 이미 나온 카드 값과 중복 아닐 때만 | `meta_info` | `product.meta_info` |
| **없을 때** | 카드 미노출 | — | 기타 카드 생략 |

---

## 2. 커버 이미지 (대표 이미지)

| 구분 | 소스 | Admin 폼 필드 | Product 필드 |
|------|------|----------------|--------------|
| **1순위** | 대표 이미지 URL | `image_url` | `product.image_url` |
| **fallback** | 상세 쪽에서 전달하는 fallback | — | ProductDetailV2 `overviewFallbackUrl` (= product.image_url) |
| **없을 때** | TravelOverviewV2에서 fallbackImageUrl 사용; 최종 없으면 로고 등 앱 기본 이미지 | — | 빈 문자열이면 상세 페이지에서 fallback으로 대표 이미지 한 번 더 넘김 |

**표시 규칙**
- `overview.coverImageUrl` 우선 → 없으면 `fallbackImageUrl` (실제로는 대표 이미지와 동일 소스)

---

## 3. 일정 테마 차트 (가능하면)

| 구분 | 소스 | Admin 폼 필드 | Product 필드 |
|------|------|----------------|--------------|
| **현재** | 자동 추출 소스 없음 | — | — |
| **가능한 추후 소스** | 테마 토큰 균등 분할 | `theme` (쉼표 등 구분) | `product.theme` → `parseThemeTokens()` |
| **가능한 추후 소스** | 일정 bullets 키워드 집계 | `detailed_schedule` | `product.detailed_schedule` |
| **없을 때** | 차트 섹션 미렌더 | — | `overview.chart` 없음 → TravelOverviewV2에서 차트 블록 비표시 |

**표시 규칙**
- 현재 구현에서는 Product 기반 자동 생성 차트 없음. 나중에 `theme` 구분자 파싱 또는 일정 키워드 집계로 `chart.items: { label, percent }[]` 생성 가능.

---

## 4. Day 요약 타임라인 (가능하면)

| 구분 | 소스 | Admin 폼 필드 | Product 필드 |
|------|------|----------------|--------------|
| **1순위** | 상세 일정 텍스트 | `detailed_schedule` | `product.detailed_schedule` |
| **fallback** | 일정 요약 | `itinerary` | `product.itinerary` |
| **파싱 규칙** | `[N일차]` / `[N일]` / `[Day N]` 패턴으로 일차 구분, 이하 내용을 해당 day의 headline/bullets로 사용 | — | — |
| **없을 때** | 타임라인 미노출 | — | `overview.timeline` 없음 → Day 요약 블록 비표시 |

**표시 규칙**
- `[1일차] 인천 출발` → day=1, headline="인천 출발", bullets=["인천 출발"]
- 같은 일차 다음 줄들은 bullets에 추가
- 파싱 결과가 없으면 타임라인 생성 안 함

---

## 5. Admin 폼 ↔ Product 필드 대응 요약

| 오버뷰 항목 | Admin 폼 필드 | Product 필드 |
|-------------|----------------|--------------|
| 항공 | departure_from_airport, departure_to_airport, departure_flight_name | 동일 |
| 숙소 | meta_info, (itinerary) | meta_info, itinerary |
| 지역 | theme, category | theme, category |
| 테마 | theme | theme |
| 기간 | duration | duration |
| 기타 카드 | meta_info | meta_info |
| 커버 이미지 | image_url | image_url |
| 차트 | (자동 추출 없음, 추후 theme/detailed_schedule) | theme, detailed_schedule |
| 타임라인 | detailed_schedule, itinerary | detailed_schedule, itinerary |

---

## 6. 전체 없을 때 동작

- **요약 카드가 하나도 없고 타임라인도 없으면**: `enabled: false`, `summaryCards: []` 반환 → TravelOverviewV2 미렌더.
- **타임라인만 있고 요약 카드가 없으면**: "일정" 카드 1개 추가 (value: `"N일"`) 후 오버뷰 표시.
- **커버 이미지**: 항상 `product.image_url` 또는 fallback 사용. 필드가 비어 있으면 상세 쪽 fallback/앱 기본 이미지 사용.

이 매핑표는 `src/lib/overview/mapProductToOverview.ts`의 자동 생성 로직과 일치한다.
