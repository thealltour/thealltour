# Kill AI Slop — 관리자 콘솔(백엔드) 결과 검토 가이드

이 문서는 관리자 콘솔 색상 정리 작업을 검토하기 위한 가이드입니다.

- **1차**: `refactor(admin): 관리자 콘솔 상태색을 --success/--warning/--danger 토큰으로 통일한다`
  (commit `64ed9de`) — 42개 파일에서 색상 클래스만 교체했고, 레이아웃·문구·동작 로직은 건드리지
  않았습니다.
- **2차**: 1차에서 "고정 다크 캔버스"라는 이유로 제외했던 이미지 관리 도구 3곳을 라이트/다크
  모드에 맞춰 가변되도록 전면 토큰화하고, 인쇄용 유인물 콘텐츠(`FlyerTemplateSections.tsx`)의
  섹션별 파스텔 색 남발도 정리했습니다. 이 역시 색상 클래스 교체만이며 레이아웃·문구·동작
  로직은 그대로입니다.

## 1. 무엇이, 왜 바뀌었나

`amber-50`, `emerald-50`, `red-50`, `blue-50`, `sky-50`, `violet-50`, `indigo-50`처럼
그때그때 골라 쓴 Tailwind 기본 색을, 이미 `globals.css`에 정의돼 있던 시맨틱 토큰으로
교체했습니다.

| 기존 (예시) | 교체 후 | 의미 |
|---|---|---|
| `amber-*`, `yellow-*`(카카오 제외) | `text-[var(--warning)]` / `bg-[var(--warning-bg)]` | 주의·대기·미확인 상태 |
| `emerald-*`, `green-*` | `text-[var(--success)]` / `bg-[var(--success-bg)]` | 완료·정상·승인 상태 |
| `red-*`, `rose-*` | `text-[var(--danger)]` / `bg-[var(--danger-bg)]` | 오류·삭제·긴급 상태 |
| `blue-*`(상태 아닌 강조), `indigo-*`, `violet-*`, `sky-*` | `text-[var(--primary)]` 또는 중립(`--surface-muted`, `--text-secondary`) | 브랜드 강조 또는 단순 구분 |

토큰은 라이트/다크 모드 값이 `globals.css`에 이미 다르게 정의돼 있어서, 기존에
색상마다 따로 붙어 있던 `dark:border-amber-800` 같은 다크모드 클래스는 함께
제거했습니다. **다크모드에서 대비가 깨지지 않는지가 이번 검토의 핵심 포인트입니다.**

## 2. 화면별 확인 체크리스트

관리자 콘솔(`/theall_manager_only/...`)에 로그인한 뒤, 라이트 모드와 다크 모드
둘 다에서 아래 화면을 열어 상태 배지·버튼 색이 "의미에 맞게" 보이는지 확인해 주세요.
(예: 위험/오류는 붉은 계열, 경고/대기는 주황 계열, 완료/성공은 초록 계열로 보이면 정상)

### 상품 (Products)
- `/theall_manager_only/products` — 목록의 퀵액션 버튼 줄
  - 밴드 훅·블로그 텍스트·스마트스토어 HTML·이미지 ZIP·유인물 버튼이 **모두 같은 중립 회색 톤**으로 보이는지 (예전엔 보라/남색/하늘색 등 제각각이었음)
  - **스레드(Threads) 버튼만 브랜드 오렌지(accent) 톤**으로 보이는지
  - **카카오 버튼은 그대로 노란색**인지 (의도적으로 유지)
  - 활성/비활성 토글 버튼: 비활성화할 때 주황(warning), 다시 켤 때 초록(success)
  - 상품 등록 폼 상단에 "임시 저장본이 있습니다" 배너가 뜨는 경우 주황 톤인지
  - 폼 하단 에러 메시지, 우측 미리보기 패널의 "미리보기 품질 경고" 박스가 주황 톤인지
- 상품 등록 폼 내부 아코디언 섹션
  - 목적지/테마 선택 칩에서 "선택됨" 상태가 브랜드 블루(primary) 톤으로 보이는지 (예전엔 주황이었음)
  - 옵션 JSON 파싱 오류 박스, 삭제 버튼들이 빨간(danger) 톤인지
  - 레거시 일정 배너가 주황(warning) 톤인지
- 유인물 생성 모달 — 상단 "저장 중" 상태 배지가 주황 톤인지 (동기화됨=초록, 미저장=회색)

### 문의 (Inquiries)
- `/theall_manager_only/inquiries` — 목록/모바일 카드의 상담중·상담종료·보류·재개·예약확정·삭제 버튼 색
  - 상담중/재개 = 주황(warning), 상담종료/여행완료 = 초록(success), 보류 = 중립 회색, 예약확정 = 브랜드 블루(primary), 삭제 = 빨강(danger)
  - 목록 상단 요약 카드 6개(미응답/팔로업지연/오늘팔로업/HOT리드/미배정/고객회신) 색 배치가 자연스러운지
- `/theall_manager_only/inquiries/dashboard` — 에러 배너가 빨간 톤인지
- 문의 상세의 문자 발송 패널, 중복 발송 경고 박스가 주황 톤인지

### 리뷰 (Reviews)
- `/theall_manager_only/reviews/moderation` — 숨김/복원/검토중/완료 버튼 톤 (데스크톱 표+모바일 카드+일괄 처리 바 3곳 모두 동일하게)
- `/theall_manager_only/review-reports` — "리뷰 숨김" 버튼이 주황 톤인지
- `/theall_manager_only/reviews/insights` — Health 배지(Healthy=초록/Watch=주황/Risk=빨강), risk/watch 카드 테두리
- `/theall_manager_only/reviews/authors` — High/Medium/Low Risk 요약 카드 (빨강/주황/초록)
- `/theall_manager_only/reviews/notifications` — 심각도 배지(긴급=빨강/경고=주황/정보=브랜드블루), 요약 카드, 안읽음 카드 테두리

### 랜딩(카카오싱크 등) & 공지
- `/theall_manager_only/landings` — Publish/Unpublish 버튼, published 상태 배지(초록), "Publish 검증 실패" 박스(빨강)
- `/theall_manager_only/landings/analytics`, 카카오모먼트 CSV 업로드/효율 섹션 — 에러(빨강)·안내 박스
- `/theall_manager_only/notices` — 등록/삭제 성공·실패 메시지, "게시중" 배지(초록)
- `/theall_manager_only/settings` (관리자 계정) — 목록 로드 에러 메시지(빨강)

### PWA / SMS / 도구
- `/theall_manager_only/pwa` — "OS 알림이 꺼져 있습니다" 배너, 미지원 브라우저 안내가 주황 톤인지
- `/theall_manager_only/sms` — 번호만 발송 안내, 미연결 경고 박스가 주황 톤인지
- `/theall_manager_only/tools/thealltour-extension` — "업로드된 빌드 없음" 안내가 주황 톤인지
- 로그인 화면(`/theall_manager_only/login`) — 로그인 실패 에러 메시지가 빨간 톤인지

### 이미지 관리 도구 (2차 — 고정 다크 캔버스를 라이트/다크 가변으로 전환)
아래 3곳은 이전엔 항상 어두운 슬레이트 배경이었지만, 이제 나머지 관리자 화면과 동일하게
라이트 모드에서는 밝게, 다크 모드에서는 어둡게 바뀝니다. **라이트/다크 두 모드 모두** 카드
배경·테두리·글자색이 자연스러운 대비를 유지하는지, "대표"(주황)·"삭제 예정"(빨강)·"복구"
(초록) 뱃지 의미가 여전히 잘 보이는지 확인해 주세요.
- 모두투어 상품 등록/편집 화면의 일정 편집기 — 이벤트 이미지 카드의 "대표"/"삭제 예정"/
  "복구"/"미할당으로 이동" 뱃지·버튼 (`itinerary/shared/EventImagesEditor.tsx`)
- 모두투어 상품 등록/편집 화면의 "미할당 이미지" 풀 전체 — 카드, 전체 선택/해제, 중복 그룹
  선택, 대표 추천/자동 배치 버튼 (`modetour/UnassignedImagePool.tsx`)
- 외부 상품 가져오기(엑스터널 임포트) 화면 — 미리보기, "일정 이미지 배치" 패널의 검증 알림,
  "이미지 검수 요약" 박스, 생성 완료/에러 결과 화면, 하단 토스트
  (`external-import/ExternalImportNewProductShared.tsx`)

### 인쇄용 유인물 (2차 — 색상 정리, 다크모드와 무관)
- 상품 편집 화면의 "유인물 생성" 모달 미리보기/PDF — 수하물·준비물 카드가 더 이상 주황/하늘색
  파스텔이 아니라 "유의사항" 카드와 같은 중립 회색 톤인지, 포함(초록)/불포함(로즈)만 색이
  남아있는지 확인 (`products/modals/FlyerTemplateSections.tsx`). 이 화면은 고객에게 나가는
  인쇄물이라 다크모드와 무관하게 항상 같은 톤이어야 정상입니다.

## 3. 이번에 의도적으로 손대지 않은 곳 (검토 시 참고)

아래는 스캐너가 여전히 "히트"로 잡지만, 검토 후 **일부러 그대로 둔** 항목입니다.

| 파일 | 이유 |
|---|---|
| `products/modals/FlyerTemplateSections.tsx`의 포함/불포함 카드(emerald/rose) | 실제 긍정("포함=받는 것")/주의("불포함=추가 비용") 의미가 있는 의도된 대비. 헤더·출발 카드의 브랜드 강조(`var(--primary)`)도 동일하게 유지 |
| `products/AdminProductsQuickActions.tsx`의 카카오 버튼 | 카카오톡 실제 브랜드 색(yellow)이라 의도적으로 유지 |

`modetour/UnassignedImagePool.tsx`, `itinerary/shared/EventImagesEditor.tsx`,
`external-import/ExternalImportNewProductShared.tsx`는 1차에서 "고정 다크 캔버스"라는 이유로
제외했었으나, 2차 작업에서 나머지 관리자 화면과 동일한 라이트/다크 토큰으로 전환했습니다
(위 체크리스트 참고).

## 4. 재검증 방법 (선택)

직접 스캐너를 다시 돌려 히트 수를 확인하고 싶으시면:

```powershell
node .agents/skills/kill-ai-slop/scripts/scan.mjs src/components/admin --only=04,05
```

1차 작업 전 124건 → 1차 후 18건 → 2차 후 4건이며, 남은 4건은 모두 위 3절의 의도적 예외
(카카오 버튼, 포함/불포함 카드) 또는 스캐너 오탐(이미 토큰화된 코드를 리터럴 매칭으로 다시
잡은 경우)입니다.

## 5. 검토 후 알려주실 것

- [ ] 위 화면들에서 라이트/다크 모드 모두 색상이 자연스러운지 (특히 이미지 관리 도구 3곳의
      라이트 모드 신규 대비)
- [ ] 유인물(PDF) 미리보기에서 수하물/준비물 카드가 중립 톤으로 통일되어도 어색하지 않은지
- [ ] 문제가 없다면 2단계(공개 프론트엔드 — 홈/상품/블로그 등) 슬롭 검사·정리를 이어서 진행할지
