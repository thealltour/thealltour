# PR: 문의 최초유입 자동 분류 + GA4 문의 이벤트 연결 — 작업 보고

## 전제 사항 (이번 PR 기준)

- **PR1** (first_touch, inquiry_page_url 저장)이 이미 적용된 상태로 진행.
- **GA4**: `NEXT_PUBLIC_GA_ID` 설정 및 `layout.tsx`의 gtag Script 설치가 되어 있어야 문의 제출 시 `generate_lead` 이벤트가 전송됨.

---

## 1. 실제 수정 파일 목록

| 구분 | 파일 |
|------|------|
| **신규** | `src/types/gtag.d.ts` — `window.gtag` 전역 타입 선언 (TypeScript 에러 방지) |
| **신규** | `supabase/migrations/20260318_add_inquiry_attribution_fields.sql` |
| **신규** | `src/lib/analytics/attribution.ts` |
| **수정** | `src/types/inquiry.ts` — FirstTouch.firstVisitAt, Inquiry/InquiryInput에 acquisition_*·first_landing_path 추가 |
| **수정** | `src/app/api/inquiries/route.ts` — POST 시 inferAttribution 반영, normalizeInquiryRow에 정규화 필드 포함 |
| **수정** | `src/components/ConsultModal.tsx` — GA4 `generate_lead` 전송, `window.gtag` 타입 사용 |
| **수정** | `src/components/InquiryForm.tsx` — 동일 |
| **수정** | `src/components/HeroInquiryForm.tsx` — 동일 |
| **수정** | `src/components/admin/AdminInquiryTable.tsx` — 최초유입 컬럼: 1행 소스는 hostname만 표시, 전체 referrer는 title 툴팁에만 노출, `parseHostname` 사용 |

---

## 2. Migration 적용 결과

### 적용 방법

- **로컬 Supabase CLI 사용 시**
  ```bash
  npx supabase db push
  ```
  또는
  ```bash
  npx supabase migration up
  ```

- **Supabase 대시보드 사용 시**  
  SQL Editor에서 아래 내용 실행:

  ```sql
  -- 20260318_add_inquiry_attribution_fields.sql
  alter table public.inquiries add column if not exists acquisition_channel text;
  alter table public.inquiries add column if not exists acquisition_source_label text;
  alter table public.inquiries add column if not exists acquisition_medium text;
  alter table public.inquiries add column if not exists acquisition_summary text;
  alter table public.inquiries add column if not exists first_landing_path text;
  ```

### 적용 후 확인

- `inquiries` 테이블에 `acquisition_channel`, `acquisition_source_label`, `acquisition_medium`, `acquisition_summary`, `first_landing_path` 컬럼이 존재하는지 확인.
- 기존 행은 해당 컬럼이 NULL이며, 신규 문의부터 서버에서 자동 분류값이 채워짐.

---

## 3. UTM / referrer / direct 테스트 결과

직접 아래 시나리오로 확인해 주세요.

### 3-1. UTM 유입

- **방법**: 브라우저에서  
  `https://사이트주소/?utm_source=naver&utm_medium=organic`  
  로 접속 후 문의 폼 제출.
- **기대**:
  - DB: `acquisition_source_label = 'naver'`, `acquisition_channel = 'organic'`, `acquisition_summary = 'naver / organic'`.
  - 관리자 목록 최초유입: 1행 `naver`, 2행 `organic` 뱃지, 3행 경로/요약.

### 3-2. Referrer 유입 (검색 등)

- **방법**: Google 검색 결과 등에서 사이트로 들어온 뒤 (또는 개발자도구에서 `document.referrer` 시뮬레이션은 불가하므로, 실제로 검색 후 유입) 문의 제출.
- **기대**:
  - DB: `acquisition_source_label = 'google'`, `acquisition_channel = 'organic'`.
  - 관리자 목록 1행: **hostname만** (예: `www.google.com`).  
    전체 referrer URL은 해당 셀 **title 툴팁**에만 표시.

### 3-3. Direct 유입

- **방법**: 주소창에 URL 직접 입력하거나 북마크로 접속 후 문의 제출 (referrer 없음, UTM 없음).
- **기대**:
  - DB: `acquisition_source_label = 'direct'`, `acquisition_channel = 'direct'`, `acquisition_summary = 'direct'`.
  - 관리자 목록: 1행 `direct`, 2행 `direct` 뱃지.

### 3-4. 기존 데이터

- **기대**: `acquisition_*` / `first_landing_path`가 NULL인 기존 문의는 목록에서 “미확인” 또는 first_touch 기반 fallback 표시, 깨짐 없음.

---

## 4. 관리자 목록 화면

- **경로**: `/admin/inquiries` (또는 `/theall_manager_only/inquiries`).
- **확인 포인트**:
  - “최초유입” 컬럼 존재.
  - 1행: **소스는 hostname만** (referrer일 때 전체 URL 아님).  
    전체 referrer는 해당 셀에 마우스 오버 시 **title 툴팁**으로만 노출.
  - 2행: acquisition_channel 뱃지(paid/organic/social/referral/direct 등).
  - 3행: first_landing_path 또는 acquisition_summary.
  - 툴팁에 `acquisition_summary`, `inquiry_page_url`, `first_touch.firstReferrer` 포함.

**캡처**: 위 조건이 보이도록 관리자 문의 목록 화면을 스크린샷으로 남겨 두시면 됩니다.

---

## 5. GA4 DebugView / 실시간 이벤트 확인

- **전제**: `NEXT_PUBLIC_GA_ID`가 설정되어 있고, `layout.tsx`에 gtag Script가 포함되어 있어야 함.
- **확인 방법**:
  1. GA4 속성 → **보고서 → 실시간** 또는 **구성 → DebugView** 사용.
  2. 문의 폼에서 제출 성공 후 `generate_lead` 이벤트 수신 여부 확인.
  3. 이벤트 파라미터: `event_category: "inquiry"`, `event_label`, `inquiry_page_url`, `acquisition_channel`, `acquisition_source_label`, `acquisition_medium` 등.
- **gtag 미설치 시**: `window.gtag`가 없으면 이벤트 전송은 스킵되며, 문의 저장/API는 그대로 동작.

**결과**: 실시간 보고서 또는 DebugView에서 `generate_lead` 이벤트가 문의 제출 시마다 찍히는지 확인 후, 필요 시 스크린샷으로 남기시면 됩니다.

---

## 6. 이번 PR에서 반영한 4가지

1. **PR1 선적용 전제**: first_touch·inquiry_page_url 저장은 이미 되어 있다고 가정하고, 이번 PR은 attribution 필드·GA4·UI만 확장.
2. **GA4 전제**: `NEXT_PUBLIC_GA_ID` 및 layout gtag 설치가 되어 있을 때만 문의 이벤트 전송이 동작한다고 문서/보고에 명시.
3. **TypeScript**: `src/types/gtag.d.ts`에 `Window.gtag` 전역 선언 추가, 문의 폼 3곳에서 `window.gtag` 직접 사용으로 통일.
4. **관리자 목록 1행**: referrer 기반일 때 **1행에는 hostname만** 표시하고, **전체 referrer는 해당 셀의 title 툴팁에만** 노출하도록 수정 (`parseHostname` 사용).

---

## 7. 후속 작업 (이번 PR 제외)

- GA4 Data API 호출.
- 관리자 대시보드 내 GA4 카드/차트 직접 렌더링.
- BigQuery Export 연동.

위 항목들은 별도 PR에서 진행하면 됩니다.
