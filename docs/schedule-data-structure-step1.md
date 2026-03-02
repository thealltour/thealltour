# [STEP 1] 일정 데이터 구조 파악 요약

## 1. types/product.ts — 일정 관련 필드

| 필드 | 타입 | 용도 |
|------|------|------|
| `itinerary` | `string` (optional) | 일정 요약/간단 일정 텍스트 |
| `detailed_schedule` | `string` (optional) | **상세 일정 본문** (일정 안내 탭의 주 데이터 소스) |

- **구조**: **문자열 하나**입니다. day 배열·key-value·JSON이 아니라 **플레인 텍스트**입니다.
- **형식**: 줄 단위. `[라벨]` 한 줄 다음에 해당 라벨의 본문이 이어지는 형태입니다.
  - 예: `[1일차]\n인천 출발\n...\n\n[2일차]\n하노이 시내관광\n...`
- **days 배열 형태 아님**: 타입 상 `days: [{ day, items }]` 같은 구조는 없고, 위 두 필드 모두 `string`입니다.
- **오버뷰용 타입** (`ProductOverview`, `OverviewTimelineDay`)은 **오버뷰 jsonb/파생 모델**용이며, **저장되는 일정 원문**과는 별개입니다.

---

## 2. ProductDetailV2 — “일정 안내” 탭 렌더링

### 데이터 소스

- **props**: `detailedSchedule?: string` (camelCase)
- 페이지에서 전달: `detailedSchedule={product.detailed_schedule ?? product.itinerary ?? ""}`

### 기대하는 데이터 형태

- **입력**: **문자열 하나** (`detailedSchedule`).
- **파싱**: `parseScheduleDays(detailedSchedule)` (로컬 함수)
  - 정규식: `^\[(.+)\]\s*$` → 한 줄이 `[임의 라벨]`이면 새 구간 시작.
  - 라벨 다음 줄들 → 해당 구간의 `content`.
- **파싱 결과 타입** (내부):

  ```ts
  type ScheduleDay = { label: string; content: string };
  // 예: [{ label: "1일차", content: "인천 출발\n하노이 도착\n..." }, ...]
  ```

- **렌더링**:
  1. **시각화 타임라인** (상단): `timelineModel?.days?.length > 0`이면 `ScheduleTimelineV2` 노출.  
     - `timelineModel`은 `mapProductToTimelineModel(product)` 또는 `getTimelineModelFromSchedule(detailedSchedule)`로 생성.  
     - `[N일차]` / `[N일]` / `[NDay]` 형식만 숫자 day로 파싱됨.
  2. **아코디언** (아래): `scheduleDays = parseScheduleDays(detailedSchedule)` → `ScheduleDay[]`.  
     - 각 항목: `day.label`(제목), `day.content`(본문, `whitespace-pre-line`).

정리하면, **실제 렌더링이 기대하는 건 “하나의 문자열”**이고, 내부적으로 **`{ label, content }[]` 형태로 파싱**해 사용합니다. DB/API에는 **문자열만** 저장됩니다.

---

## 3. AdminProductManager — 일정 입력/저장 매핑

### 폼 필드명 (form state)

| form 필드 | 의미 | 저장 시 API 필드 |
|-----------|------|-------------------|
| `form.detailed_schedule` | 상세 일정 전체 텍스트 | `detailed_schedule` |
| `form.itinerary` | (별도) 일정 요약/간단 문구 | `itinerary` |

### 입력 UI

- **일정 입력**: 하나의 **textarea** (`form.detailed_schedule`).
  - placeholder: `[1일차]\n인천 출발 / 하노이 도착\n...\n\n[2일차]\n하노이 시내관광\n...`
  - `onChange`: `setForm(prev => ({ ...prev, detailed_schedule: event.target.value }))`
- **내부 편집**: `parseDetailedSchedule(form.detailed_schedule)` → `DayScheduleDraft[]` (`{ label, content }[]`)로 파싱 후, UI에서 일차 추가/수정/삭제하고, `serializeDetailedSchedule(drafts)`로 다시 문자열로 만들어 `form.detailed_schedule`에 반영.

### 저장 흐름 (API)

- **PATCH/POST body**:
  - `detailed_schedule`: `form.detailed_schedule.trim() === "" ? undefined : form.detailed_schedule`
  - `itinerary`: `form.itinerary.trim() === "" ? null : form.itinerary`
- **DB**: `detailed_schedule`, `itinerary` 컬럼에 **문자열 그대로** 저장 (trim 후 null/빈 문자열 처리만).

### 직렬화 형식 (Admin ↔ 저장)

- **문자열 형식**:  
  `[라벨1]\n본문1\n\n[라벨2]\n본문2\n\n...`
- `serializeDetailedSchedule`:  
  `[label]\ncontent` 블록을 `\n\n`로 이어 붙임.
- `parseDetailedSchedule`:  
  `^\[(.+)\]\s*$`로 라벨 줄을 찾고, 다음 `[...]` 전까지를 해당 라벨의 `content`로 파싱.

---

## 완료 조건 정리: “텍스트로 입력하는 일정”의 실제 저장 형태

| 항목 | 내용 |
|------|------|
| **저장 형태** | **단일 문자열** (`detailed_schedule` 컬럼, optional `string`) |
| **형식** | 줄 단위. `[라벨]\n본문` 블록이 `\n\n`로 구분. 라벨은 자유 문자열 (예: `1일차`, `Day 1`, `제1일` 등). |
| **일정 요약** | 별도 필드 `itinerary` (역시 문자열). 상세 페이지에서는 `detailed_schedule ?? itinerary`로 fallback. |
| **day 배열/JSON** | 저장 구조에는 없음. day 배열은 **프론트/파생 모델**에서만 사용 (parse 후 `ScheduleDay[]`, `TimelineViewModel` 등). |

따라서 **“텍스트로 입력하는 일정”의 실제 저장 형태**는 **`detailed_schedule` 한 개의 문자열**로 확정됩니다.
