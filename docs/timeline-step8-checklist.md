# [STEP 8] 타임라인 최종 점검 체크리스트

## ✅ 1. 텍스트 일정만 입력해도 타임라인 자동 생성

- **mapProductToTimelineModel(product)** / **getTimelineModelFromSchedule(raw)** 가 `detailed_schedule` 또는 `itinerary` **텍스트만**으로 동작.
- Day 이미지(`itinerary_media_json`)는 선택. 없으면 `product.image_url`로 fallback.
- **ProductDetailV2**: `timelineModel` 생성 후 `hasInteractiveTimeline`이면 첫 화면에 **InteractiveTimelineV2** 노출.
- **일정 안내 탭**: `timelineViewModel`(레거시)으로 **ScheduleTimelineV2** + 아코디언 노출.

→ **체크 완료**

---

## ✅ 2. 일정이 적거나 형식이 달라도 크래시 없음 (파싱 실패 시 fallback)

- **parseTimelineDays** (mapProductToOverview): 빈 문자열 → `[]`, `[N일차]` 형식이 없으면 → `[]` 반환. 예외 없음.
- **getTimelineModelFromSchedule**: `parsed.length === 0` 이면 `{ days: [] }` 반환.
- **mapProductToTimelineModel**: `product` null/비정상이면 `{ days: [] }` 반환.
- **ProductDetailV2**: `hasInteractiveTimeline = timelineModel.days.length > 0` → days 없으면 타임라인 섹션 미렌더.
- **일정 안내 탭**: `parseScheduleDays(detailedSchedule)`는 `[라벨]` 형식으로 파싱. 형식이 다르면 `filtered.length === 0 && source` 시 `[{ label: "일정", content: source }]` 로 fallback하여 텍스트는 항상 표시.

→ **체크 완료**

---

## ✅ 3. Day별 이미지 없으면 product.image_url로 fallback

- **mapProductToTimelineModel**: 각 day에 대해  
  `d.imageUrl = itinerary_media_json[day] ?? product.image_url ?? null`
- **InteractiveTimelineV2** / **ScheduleTimelineV2**: **CoverImage**에서 `day.imageUrl || fallbackImageUrl` 사용.  
  ProductDetailV2에서 `fallbackImageUrl={resolvedOverviewFallbackUrl}` (= `product?.image_url ?? overviewFallbackUrl`) 전달.

→ **체크 완료**

---

## ✅ 4. Day별 이미지 업로드 시 해당 Day에만 반영

- **AdminProductManager**: Day별 **ImageUploadField**가 `dayKey = String(dayNum)` (1, 2, …)로 구분.
- **onUploaded**: `setForm(prev => ({ ...prev, itinerary_media_json: { ...prev.itinerary_media_json, [dayKey]: v } }))` → 해당 day 키에만 cardUrl 저장.
- 저장 payload의 **itinerary_media_json**은 현재 일정 일수(1~N)에 해당하는 키만 포함 (STEP 7에서 필터 적용).

→ **체크 완료**

---

## ✅ 5. 타임라인은 요약, 탭 일정은 상세로 역할 분리

- **첫 화면 (오버뷰 아래)**: **InteractiveTimelineV2** — Day 탭, 커버 이미지, 이벤트 카드 2~4개 등 **요약/흥미 유도**.
- **일정 안내 탭**: **ScheduleTimelineV2** + **아코디언** — 동일 데이터의 요약 + **전체 텍스트** 상세.

→ **체크 완료**

---

## 요약

| 항목 | 상태 |
|------|------|
| 텍스트 일정만으로 타임라인 자동 생성 | ✅ |
| 일정 적/형식 다름 시 크래시 없음, fallback | ✅ |
| Day 이미지 없을 때 product.image_url fallback | ✅ |
| Day 이미지 업로드 시 해당 Day에만 반영 | ✅ |
| 타임라인=요약, 탭=상세 역할 분리 | ✅ |
