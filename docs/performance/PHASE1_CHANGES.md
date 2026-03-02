# Phase 1 최적화 변경 사항

## 적용 완료

### 1. 히어로 이미지 (LCP)

**파일**: `src/app/page.tsx`

- **모바일 히어로**: `sizes="(max-width: 768px) 100vw, 0px"` — 데스크톱에서 미표시 시 0px로 불필요 로드 방지
- **데스크톱 히어로**: `sizes="(min-width: 1024px) 960px, (min-width: 768px) 768px, 0px"` — 모바일에서 미표시 시 0px
- **quality={82}**: 기본 75보다 약간 높게, 용량·품질 균형

### 2. Preconnect 정리

**파일**: `src/app/layout.tsx`

- **Supabase**: `preconnect` 유지 (히어로 이미지 LCP용)
- **img.modetour.com**: `preconnect` → `dns-prefetch`로 변경 (폴드 아래 상품 이미지용, 가벼운 연결)

### 3. Next.js Image 설정

**파일**: `next.config.ts`

- **deviceSizes**: `360` 추가 (모바일 359px 뷰포트 대응)
- **imageSizes**: `360` 추가 (모바일 히어로 최적 크기)

### 4. Browserslist

**파일**: `package.json`

- `"not dead"` 추가 — 사용 중단 브라우저 제외, polyfill 축소

---

## 추후 검토

### 폰트 preload

- Pretendard 경로: `/assets/fonts/pretendard-variable.woff2`
- `public/assets/fonts/` 폴더 존재 시 layout에 preload 추가 가능

### 동적 import

- `PdfViewer`, `ProductImageGalleryModal`, `ScheduleVisualEditorV2` 등 무거운 컴포넌트
- 모달/탭에서만 사용 시 `next/dynamic`으로 지연 로드 검토

### 서버 응답 (TTFB 628ms)

- 홈: `getFeaturedProducts`, `getHomeBanners` — 이미 `unstable_cache` 사용
- Vercel Edge/ISR 배포 시 TTFB 개선 기대

---

## 측정 권장

```bash
npm run build && npm run start
npm run lighthouse
```

프로덕션 빌드 기준으로 LCP, TBT 재측정 후 결과 비교.
