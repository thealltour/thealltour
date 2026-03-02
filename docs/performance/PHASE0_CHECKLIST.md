# Phase 0: 현황 측정 체크리스트

## 1. Web Vitals 실측

### 설정 완료
- [x] `WebVitalsReporter` 컴포넌트 추가 (`src/components/WebVitalsReporter.tsx`)
- [x] `layout.tsx`에 마운트

### 측정 방법

1. **개발 환경**
   ```bash
   npm run dev
   ```
   - 브라우저 콘솔에서 `[Web Vitals]` 로그 확인
   - LCP, INP, CLS, FCP, TTFB 수치 기록

2. **프로덕션 빌드 (로컬)**
   ```bash
   npm run build && npm run start
   ```
   - Lighthouse 모바일 시뮬레이션 권장

3. **PageSpeed Insights**
   - https://pagespeed.web.dev/
   - 배포 URL 입력 후 모바일 점수 확인

---

## 2. Lighthouse 측정

### 모바일 시뮬레이션 (Chrome DevTools)

1. F12 → Lighthouse 탭
2. **Mode**: Navigation
3. **Device**: Mobile
4. **Categories**: Performance
5. **Analyze page load** 실행

### CLI

```bash
# 서버 실행 후 (npm run dev 또는 npm run start)
npm run lighthouse        # 모바일 시뮬레이션
npm run lighthouse:desktop # 데스크톱
```

### 기록할 지표

| 지표 | 목표 | 현재값 | 비고 |
|------|------|--------|------|
| LCP | ≤3초 | _____ | |
| TBT | 낮을수록 좋음 | _____ | |
| INP | ≤200ms | _____ | |
| CLS | ≤0.1 | _____ | (현재 0.022면 양호) |
| FCP | ≤1.8초 | _____ | |
| Speed Index | ≤3.4초 | _____ | |

---

## 3. Supabase 현황

### Dashboard 확인

1. **Project Settings → Usage**
   - Database: 월간 요청 수
   - Storage: 대역폭, 저장 용량

2. **Logs → API**
   - 느린 쿼리 (응답 시간 스파이크)
   - 호출 빈도가 높은 테이블

### 기록할 항목

| 항목 | 값 |
|------|-----|
| DB 월간 요청 수 | _____ |
| Storage 대역폭 | _____ |
| p95 응답 시간 (느린 쿼리) | _____ |

### 테이블별 사용처 (페이지 로드 시 호출)

| 테이블 | 호출 위치 | 캐시 | 비고 |
|--------|-----------|------|------|
| `home_banners` | 홈 `/` | unstable_cache 120s | LCP 이미지 소스 |
| `products` | 홈, 상품 목록/상세 | unstable_cache | 상품 이미지 다수 |
| `guides` | 가이드 목록/상세 | unstable_cache 3h | Notion 연동 |
| `site_settings` | 여러 페이지 | - | 헤더, 히어로 텍스트 |
| `reviews` | 리뷰 페이지 | - | |
| `inquiries` | 관리자 | - | |
| `notices` | 공지/약관 | - | |
| `members` | 로그인/회원 | - | |
| `admin_*` | 관리자 전용 | - | |

---

## 4. LCP 후보 요소 식별

### 홈 (`/`)

| 요소 | 타입 | 우선순위 | 비고 |
|------|------|----------|------|
| primaryBanner 이미지 | Image | LCP 후보 | `priority`, `fetchPriority="high"` 적용됨 |
| H1 텍스트 | 텍스트 | - | 이미지 없을 때 대체 |

### 상품 목록 (`/products`)

| 요소 | 타입 | 우선순위 | 비고 |
|------|------|----------|------|
| ProductsHero | client | - | site_settings fetch |
| 첫 상품 카드 이미지 | Image | LCP 후보 | ProductCatalogSection 내 |

### 가이드 (`/guides`)

| 요소 | 타입 | 우선순위 | 비고 |
|------|------|----------|------|
| PageHero (텍스트) | - | - | H1 등 |
| 첫 가이드 카드 이미지 | Image | LCP 후보 | GuidesListClient 내 |

---

## 5. Phase 0 완료 조건

- [ ] Web Vitals 1회 이상 측정 (개발 또는 프로덕션)
- [ ] Lighthouse 모바일 Performance 점수 1회 기록
- [ ] Supabase Usage/Logs 1회 확인
- [ ] LCP 후보 요소 목록 작성

---

## 다음 단계 (Phase 1)

Phase 0 결과를 바탕으로 LCP 최적화 작업을 진행합니다.
