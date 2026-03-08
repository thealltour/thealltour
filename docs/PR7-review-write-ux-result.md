# PR7: 여행 후기 작성 UI/UX 완성 — 결과 정리

## 1. 수정 파일 목록

| 구분 | 파일 경로 |
|------|-----------|
| **수정** | `src/types/review.ts` (ReviewProgressState, ReviewImageItem 추가) |
| **수정** | `src/components/ReviewWriteForm.tsx` (전면 개편) |
| **수정** | `src/app/reviews/write/page.tsx` (부제목·eligibility 문구) |

---

## 2. 후기 작성 UI 구조

- **상단: 여행 정보 카드**  
  `productInfo`가 있을 때만 표시.  
  문구: "이번 여행 후기", 상품명, 여행 일정(출발~복귀), "이번 여행은 어떠셨나요? 여행 경험을 공유하면 다른 여행자에게 큰 도움이 됩니다."

- **진행률**  
  "작성 진행률" + progress bar(0~100%) + 단계별 표시(★ 만족도, 한줄 요약, 여행 경험, 사진).  
  각 단계는 입력 여부에 따라 녹색으로 강조.

- **STEP 1 — 전체 만족도**  
  라벨: "전체 여행 만족도를 평가해 주세요"  
  가이드: "별을 탭하여 선택하세요."  
  별점 1~5 (모바일 터치 영역 확대: min-h-[44px] min-w-[44px])  
  eligibility 기반일 때만 세부 평점(일정/숙소/가이드/식사) 4개 추가.

- **STEP 2 — 한줄 요약**  
  placeholder: "이번 여행을 한 문장으로 표현한다면?"  
  비-eligibility일 때만 "제목 (선택)" 필드 추가.

- **STEP 3 — 여행 경험 작성**  
  - eligibility 기반:  
    - 좋았던 점 (placeholder + 안내: "특히 기억에 남는 경험을 적어주시면 다른 여행자에게 도움이 됩니다.")  
    - 아쉬웠던 점 (placeholder + 안내: "솔직한 의견은 더 좋은 여행 상품을 만드는 데 도움이 됩니다.")  
    - 여행 팁 (placeholder: "예: 준비물, 일정 팁, 현지 정보 등")  
    - 접이식 "자유 형식으로 더 쓰기" (content)  
  - 비-eligibility: 단일 "내용" textarea (필수).

- **STEP 4 — 사진 업로드**  
  "사진 추가 (최대 10장)" 버튼 + 선택된 장수 표시.  
  이미지가 있으면 2열(모바일) / 3열(데스크톱) 그리드, 드래그 정렬, 개별 삭제, 첫 번째에 "대표" 배지.

- **STEP 5 — 작성 완료**  
  데스크톱: "임시저장" / "후기 등록" 버튼.  
  모바일: 하단 고정(sticky) 영역에 동일 버튼.

- **기존 필드/로직 유지**  
  title, summary, content, content_good/bad_tip, rating, rating_schedule/stay/guide_food, image_urls, eligibility_id, draft/submitted 처리 방식은 변경 없음.

---

## 3. Progress UX 구현 방식

- **계산**  
  - hasRating: `formData.rating != null`  
  - hasSummary: `formData.summary.trim().length > 0`  
  - hasContent: content_good 또는 content_bad 또는 content_tip 또는 content 중 하나라도 비어 있지 않음  
  - hasImages: `imageItems.length > 0`  
  - percent: (충족한 단계 수 / 4) * 100, 반올림.

- **표시**  
  - "작성 진행률" 문구 + 파란색 progress bar (width: percent%)  
  - 퍼센트 숫자  
  - "★ 만족도 / 한줄 요약 / 여행 경험 / 사진" 라벨 — 충족 시 녹색.

---

## 4. 이미지 업로드 UX 구현 방식

- **단일 리스트**  
  `imageItems: ReviewImageItem[]` — `{ id, url, file? }`.  
  기존 URL은 `imageUrlsToItems(initialData?.image_urls)`로 초기화, 새 파일은 blob URL + file 보관.

- **사진 추가**  
  file input (sr-only) + label "📷 사진 추가 (최대 10장)".  
  선택 시 형식/용량 검사 후 `imageItems`에 blob URL + File으로 추가.

- **그리드**  
  모바일: `grid-cols-2`, 데스크톱: `sm:grid-cols-3`.  
  각 셀: SortableImageThumb (dnd-kit useSortable).

- **드래그 정렬**  
  `@dnd-kit/core` (DndContext, PointerSensor, KeyboardSensor) + `@dnd-kit/sortable` (SortableContext, arrayMove, verticalListSortingStrategy).  
  DragEnd 시 `arrayMove(imageItems, oldIndex, newIndex)`로 `imageItems` 갱신.

- **개별 삭제**  
  썸네일 우측 상단 X 버튼 (hover 시 표시, 터치 시에도 동작).  
  blob URL이면 revoke 후 해당 항목 제거.

- **대표 이미지**  
  index === 0 인 썸네일에 "대표" 배지(파란 배경).

- **저장 시**  
  buildPayload에서 `imageItems` 순서대로 URL 배열 생성(파일은 업로드 후 URL로 치환).  
  임시저장 성공 시 서버에서 내려준 최종 `image_urls`로 `imageItems` 재설정, blob revoke.

---

## 5. 모바일 UX 개선 내용

- **하단 버튼 고정**  
  `fixed bottom-0 left-0 right-0 z-10 ... sm:hidden` — 모바일에서만 표시.  
  배경: `bg-white/95 backdrop-blur`, 상단 border.  
  "임시저장" / "후기 등록" 두 버튼 동일 비율.

- **본문 여백**  
  폼 컨테이너에 `pb-24 md:pb-8` — 하단 고정 영역에 가려지지 않도록.

- **별점 터치 영역**  
  StarRating 버튼에 `min-h-[44px] min-w-[44px] flex items-center justify-center`, `touch-manipulation`으로 확대.

- **이미지 그리드**  
  기본 `grid-cols-2`(모바일), `sm:grid-cols-3`(데스크톱).

- **Textarea**  
  `min-h-[100px]` 등으로 최소 높이 지정해 자동 높이 느낌 유지.

---

## 6. Draft UX 개선 내용

- **자동 저장**  
  입력이 있고 제출/수동 임시저장 중이 아닐 때, 5초 디바운스 후 자동으로 draft 저장.  
  최신 폼/이미지 상태는 ref(formDataRef, imageItemsRef, currentReviewIdRef)로 참조해 클로저 스테일 방지.

- **저장 상태 표시**  
  - "저장 중..." — isSavingDraft 또는 draftStatus === "saving"  
  - "임시 저장됨" — draftStatus === "saved" (약 2~3초 후 idle로 복귀)

- **페이지 이탈 방지**  
  `hasAnyContent`(요약/내용/이미지 중 하나라도 있음)일 때 `beforeunload`에서 `e.preventDefault()` 호출.  
  브라우저 기본 확인 대화상자로 "작성 중인 내용이 있습니다" 유도.

---

## 7. Validation 처리 방식

- **제출 시 검사**  
  `validateForSubmit()`:  
  - eligibility 기반: rating 필수, (제목 또는 한줄 요약 또는 내용) 중 하나 이상 필수.  
  - 비-eligibility: 제목·내용 필수.

- **에러 표시**  
  - `fieldErrors`: 필드별 메시지 (rating, content, title 등).  
  - StarRating/Textarea에 `error` prop 전달, 필드 아래 `role="alert"` 문구로 표시.  
  - 상단 `errorMessage`: API 오류 등 공통 메시지.

- **메시지 예**  
  - "전체 만족도를 선택해 주세요." (rating 미선택)  
  - "여행 경험을 조금만 더 남겨주세요." (eligibility인데 내용 없음)  
  - "제목을 입력해 주세요." / "내용을 입력해 주세요." (비-eligibility)

---

## 8. 테스트 시나리오

1. **기본 흐름**  
   claim → write 진입 → STEP 1~4 입력 → 후기 등록 → 마이페이지 또는 목록 이동 확인.

2. **Draft 저장**  
   일부만 입력 후 대기(5초) → "저장 중..." → "임시 저장됨" 노출.  
   수동 "임시저장" 클릭 시에도 동일 메시지.

3. **이미지**  
   사진 5장 추가 → 2열/3열 그리드, 첫 장 "대표" 배지.  
   개별 X로 삭제, 드래그로 순서 변경 후 임시저장/제출 시 순서 반영 확인.

4. **모바일**  
   작은 뷰포트에서 별점 탭, 하단 고정 버튼, 스크롤 시 버튼 항상 노출 확인.

5. **Validation**  
   별점 없이 "후기 등록" → "전체 만족도를 선택해 주세요." 등 필드 아래/상단 메시지 확인.

6. **페이지 이탈**  
   내용 입력 후 새로고침/다른 주소 이동 시 브라우저 이탈 확인 대화상자 확인.

---

## 9. 남은 TODO

- **자동 저장 디바운스**  
  현재 5초. 사용자 피드백에 따라 3초/7초 등 조정 가능.

- **제목 자동 생성**  
  eligibility 시 제목 미입력이면 `summary.slice(0, 50) || "후기"` 사용.  
  "제주 골프 여행 3박4일 후기" 형태로 상품명 기반 자동 제목은 미구현(필요 시 추가).

- **이미지 EXIF/리사이즈**  
  업로드 전 리사이즈·EXIF 회전 처리 미구현.  
  필요 시 클라이언트에서 canvas/라이브러리로 처리 후 업로드 검토.

- **접근성**  
  Progress 영역에 `aria-label`/`role="progressbar"` 등 보강 여지 있음.
