# [STEP 7] 운영/QA 체크리스트

상품 상세·관리자 일정 시각화 배포 전 점검용 체크리스트입니다.

---

## 1. 레거시 텍스트만 있어도 상세가 정상 노출(기존 UI)

- [ ] **확인 방법**: 상품에 `itinerary_v2_json` 없음(또는 `days: []`), `detailed_schedule`(또는 `itinerary`) 텍스트만 있는 경우 → 상세 페이지에서 **일정 안내** 탭에 기존 아코디언([1일차], [2일차] …)으로 표시되고, 탭 위에는 시각화 타임라인 블록이 **나오지 않음**.
- **구현**: `ProductDetailV2.tsx` — `hasVisualItinerary = product?.itinerary_v2_json?.days?.length > 0` 일 때만 시각화 렌더. `!hasVisualItinerary && hasSchedule` 이면 `parseScheduleDays(detailedSchedule)` 아코디언만 사용.

---

## 2. 시각화 일정(itinerary_v2_json) 입력 후 저장하면 상세에서 타임라인으로 노출

- [ ] **확인 방법**: 관리자에서 **시각화 일정(권장)** 탭에서 Day/이벤트 입력 후 저장 → 상품 상세 진입 시 **탭 위**와 **일정 안내 탭** 모두에서 `InteractiveTimelineV2`(Day 탭, 커버 이미지, 이벤트 카드)가 노출됨.
- **구현**: `hasVisualItinerary` true 시 `InteractiveTimelineV2` 렌더. API `PATCH/POST` 에서 `itinerary_v2_json` 저장 (`api/admin/products/[id]/route.ts`, `api/admin/products/route.ts`).

---

## 3. "레거시 텍스트로 초안 만들기" 버튼이 동작하고 수정 가능

- [ ] **확인 방법**: 관리자 **일정** 탭 → **레거시 텍스트(기존)** 에 `[1일차]` 등 텍스트 입력 후 **레거시 텍스트로 초안 만들기** 클릭 → **시각화 일정** 탭에 Day/이벤트가 채워짐. 이후 Day 제목·이벤트·커버 이미지 수정 후 저장 가능.
- **구현**: `ScheduleVisualEditorV2.tsx` — `applyLegacyDraft`에서 `parseLegacyItineraryText(legacy_itinerary_text)` 호출 후 `setForm`으로 `itinerary_v2_json` 갱신.

---

## 4. Day 커버 이미지 없으면 대표 이미지로 fallback

- [ ] **확인 방법**: Day에 커버 이미지를 넣지 않은 상품 상세 → 각 Day 영역에 **상품 대표 이미지**(`product.image_url`)가 노출됨. 대표 이미지도 없으면 placeholder(아이콘 + "Day N 대표 이미지") 노출.
- **구현**: `mapProductToTimelineModel.ts` — Day 이미지 우선순위 `coverImageUrl` → `itinerary_media_json[day]` → `product.image_url`. `InteractiveTimelineV2` `CoverImage`: `day.imageUrl || fallbackImageUrl` 후 없으면 placeholder.

---

## 5. 이벤트 0개 / Day 0개 등 엣지 케이스에서 깨지지 않음

- [ ] **Day 0개**: `itinerary_v2_json.days.length === 0` → `hasVisualItinerary` false → 시각화 블록 미렌더, 레거시만 사용.
- [ ] **특정 Day 이벤트 0개**: `InteractiveTimelineV2`에서 해당 Day 선택 시 "해당 일차 이벤트가 없습니다." 문구만 노출.
- [ ] **model.days 빈 배열**: `InteractiveTimelineV2` 진입 시 `if (!model?.days?.length) return null` 로 아무것도 그리지 않음.
- **구현**: `ProductDetailV2.tsx` 분기, `InteractiveTimelineV2.tsx` early return 및 `activeDay.events.length === 0` 분기.

---

## 6. Mobile / PC 반응형 정상

- [ ] **PC**: Day 탭 가로 배치, 타임라인 중앙 세로 라인 + 이벤트 좌/우 번갈아 배치.
- [ ] **Mobile**: `InteractiveTimelineV2` — `md:hidden` / `hidden md:block` 으로 모바일에서는 단일 컬럼 스택. Day 탭은 flex-wrap으로 줄바꿈.
- **구현**: `InteractiveTimelineV2.tsx` — 데스크톱 `hidden md:block`, 모바일 `space-y-4 md:hidden`.

---

## 요약

| # | 항목 | 확인 |
|---|------|------|
| 1 | 레거시 텍스트만 있어도 상세 정상 노출(기존 UI) | ☐ |
| 2 | itinerary_v2_json 저장 후 상세에서 타임라인 노출 | ☐ |
| 3 | 레거시 텍스트로 초안 만들기 동작·수정 가능 | ☐ |
| 4 | Day 커버 없으면 대표 이미지 fallback | ☐ |
| 5 | 이벤트 0개 / Day 0개 엣지 케이스 안 깨짐 | ☐ |
| 6 | Mobile/PC 반응형 정상 | ☐ |
