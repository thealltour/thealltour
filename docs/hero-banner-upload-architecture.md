# 업로드형 히어로 배너 — 기존 코드 발췌 및 구조 요약

업로드형 히어로 배너 설계 시 참고용. 발췌 시점 기준 경로는 저장소 기준입니다.

---

## 1. 관련 파일 목록

| 구분 | 경로 |
|------|------|
| 홈 데이터 | `src/app/page.tsx` |
| 배너 조회 | `src/lib/homeBanners.ts` |
| 히어로 문구 | `src/lib/heroContent.ts`, `src/types/homeHeroContent.ts` |
| 히어로 UI | `src/components/home/HeroSection.tsx` |
| 배너 타입 | `src/types/homeBanner.ts` |
| DB 스키마 | `supabase/home_banners.sql` |
| 관리 UI | `src/components/admin/AdminBannerManager.tsx`, `src/app/admin/banners/page.tsx` |
| 업로드 필드 | `src/components/admin/ImageUploadField.tsx` |
| 업로드 API | `src/app/api/admin/uploads/image/route.ts` |
| 배너 CRUD API | `src/app/api/admin/banners/route.ts`, `src/app/api/admin/banners/[id]/route.ts` |
| 스토리지 | `src/lib/storage/index.ts`, `src/lib/storage/StorageProvider.ts`, `src/lib/storage/providers/SupabaseStorageProvider.ts` |
| 클라이언트 리사이즈 | `src/lib/images/deriveCardAndHeroWebp.ts` (ImageUploadField에서 사용) |
| 기타 업로드 | `src/app/api/admin/uploads/images/route.ts`, `src/app/api/admin/uploads/guide/route.ts`, `src/app/api/admin/uploads/pdf/route.ts` |
| 다중 이미지 | `src/components/admin/MultiImageUploadField.tsx` |

---

## 2. 관리자 이미지 업로드 기존 구조

### 2.1 배너 관리 UI (`AdminBannerManager.tsx`)

- **PC 배너**: `ImageUploadField` — `uploadedUrlKey="hero"`, URL은 `form.image_url`에 반영.
- **모바일 배너(선택)**: 별도 `ImageUploadField` — `form.mobile_image_url`, 동일 `uploadedUrlKey="hero"`.
- **저장**: `fetch` JSON → `POST/PATCH /api/admin/banners` — `image_url`, `mobile_image_url` 등.

```tsx
// 발췌: 폼 제출 body
body: JSON.stringify({
  title: form.title,
  image_url: form.image_url,
  mobile_image_url: form.mobile_image_url.trim() || null,
  link_url: form.link_url.trim() || null,
  sort_order: form.sort_order.trim() === "" ? null : Number(form.sort_order),
  is_active: form.is_active,
}),
```

```tsx
// 발췌: ImageUploadField 연결 (PC)
<ImageUploadField
  value={form.image_url}
  onChange={(url) => setForm((prev) => ({ ...prev, image_url: url }))}
  onUploaded={(url) => setForm((prev) => ({ ...prev, image_url: url }))}
  uploadedUrlKey="hero"
  optional={false}
  placeholder="PC 배너 이미지 URL 또는 아래에서 파일 업로드 (권장 1920x640)"
  sizeHint="권장: 웹(PC) 1920x640px. JPG/PNG/WebP 사용 가능"
/>
```

### 2.2 `ImageUploadField.tsx` — 업로드 UI·핸들러

- **입력**: 텍스트 URL + `<input type="file" accept="image/jpeg,image/png,image/webp" />` (라벨 안, `sr-only`).
- **흐름**: 파일 선택 → `deriveCardAndHeroWebp(file)` → `FormData`에 `hero`/`card` webp 첨부 → `POST /api/admin/uploads/image` → 응답 `heroUrl` / `cardUrl` 중 `uploadedUrlKey`에 맞는 URL을 `onUploaded`로 전달.

```tsx
// 발췌: 업로드 요청
const formData = new FormData();
if (uploadedUrlKey === "card") {
  formData.append("card", card, card.name);
} else {
  formData.append("hero", hero, hero.name);
  formData.append("card", card, card.name);
}
const res = await fetch("/api/admin/uploads/image", {
  method: "POST",
  body: formData,
});
const data = await res.json();
const { heroUrl, cardUrl } = data;
const urlToUse = uploadedUrlKey === "card" ? cardUrl : heroUrl;
onUploaded(urlToUse);
```

### 2.3 `POST /api/admin/uploads/image` — 서버

- **인증**: 주석상 middleware `ADMIN_AUTH_COOKIE` (미인증 401).
- **제한**: 확장자 jpg/jpeg/png/webp, MIME 허용, **최대 10MB**.
- **저장 경로 생성**: `products/${yyyy}/${mm}/${timestamp}-${random}.webp` 및 `-card.webp` (배너 전용 prefix 아님).
- **반환**: `{ heroUrl, cardUrl, url: hero }`.

```ts
// 발췌: 검증·업로드
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const MAX_SIZE = 10 * 1024 * 1024;

const { url } = await provider.uploadPublicImage({
  file: heroFile,
  path,
  contentType: heroFile.type,
});

return NextResponse.json({
  heroUrl: hero,
  cardUrl: card,
  url: hero,
});
```

---

## 3. 홈 히어로 데이터 연결 (`page.tsx`)

- `Promise.all`로 `getHomeBanners()`, `getHeroContent()` 등 병렬 조회.
- **배너**: `getHomeBanners()` 활성 배열 전체 → `heroBanners` (`sort_order` 순, `HeroSection`에서 0/1/N장 처리).
- **문구**: `resolveHeroContent(heroContent)` → `hero` (배너와 별도 테이블 `home_hero_content`).

```tsx
// 발췌
const [homeCurated, topBanners, heroContent, settings, destinations, themes, homeGuides, homeReviews] =
  await Promise.all([
    getHomeCuratedData(),
    getHomeBanners(),
    getHeroContent(),
    // ...
  ]);

const hero = resolveHeroContent(heroContent);

<HeroSection heroBanners={topBanners} hero={hero} />
```

### 3.1 `getHomeBanners()` (`homeBanners.ts`)

- Supabase `home_banners`, `is_active === true`, `sort_order`·`created_at` 정렬.
- `unstable_cache`, tag `home-banners`, revalidate 120s.

---

## 4. `HeroSection` 배너 렌더링

- **props**: `heroBanners: HomeBanner[]` (비면 배경 없음).
- **슬라이드**: `HeroPanoramaSlideshow` — 2장 이상이면 5초 간격·700ms opacity fade, `prefers-reduced-motion` 시 자동 전환 없음(첫 장 고정).
- **소스 분기**: 태블릿 스택 `md:block lg:hidden` → `mobile_image_url?.trim() || image_url` / 데스크톱 `hidden lg:block` → `image_url`.
- **`link_url`**: 배경 `pointer-events-none` — 클릭 미연결.

구현: `src/components/home/HeroSection.tsx` (`HeroPanoramaSlideshow`).

---

## 5. 타입·스키마

### 5.1 `HomeBanner` (`types/homeBanner.ts`)

```ts
export type HomeBanner = {
  id: string;
  title: string;
  image_url: string;
  mobile_image_url?: string | null;
  link_url?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
  created_at?: string | null;
};
```

- **이미지 배열 필드 없음** — 행당 URL 문자열 1~2개(PC/모바일).
- **`title`**: DB not null, 이미지 `alt`로 사용.
- **`link_url`**: DB에 있으나 `HeroSection` 배경 레이어는 `pointer-events-none` — 클릭 CTA는 미연결(별도 작업 필요).

### 5.2 `home_banners` SQL (`supabase/home_banners.sql`)

- 컬럼: `title`, `image_url`, `mobile_image_url`, `link_url`, `sort_order`, `is_active`, `created_at`.
- **다중 행** 가능 — 앱은 **정렬된 활성 행 전부**를 히어로 배경 슬라이드에 사용.

### 5.3 히어로 문구 (`home_hero_content`)

- `HomeHeroContent` / `getHeroContent` — **텍스트·플레이스홀더** 등, **이미지 URL 없음**.

---

## 6. 이미지 저장소

- **`STORAGE_PROVIDER`** 환경변수 (예: `supabase`) → `getStorageProvider()`.
- **Supabase**: 버킷 기본 **`product-images`**, `upload(path, buffer, { contentType, cacheControl, upsert: false })` → `getPublicUrl(path)` 로 **공개 URL** 반환.
- **로컬 `public/` 직접 저장** 아님 (업로드 API 경유).

```ts
// 발췌: SupabaseStorageProvider
const BUCKET = "product-images";
const { data } = this.client.storage.from(bucket).getPublicUrl(path);
return { url: data.publicUrl, path };
```

---

## 7. 현재 구조 요약

| 항목 | 내용 |
|------|------|
| **업로드 방식** | 브라우저에서 webp 파생(`deriveCardAndHeroWebp`) → `multipart/form-data` → `/api/admin/uploads/image` → `IStorageProvider.uploadPublicImage` |
| **저장 위치** | Supabase Storage `product-images` 버킷, 경로 패턴 `products/YYYY/MM/...webp` |
| **홈 히어로 연결** | `getHomeBanners()` **활성 배열 전체** → `HeroSection` `heroBanners` — **sort_order 순 fade 슬라이드**(2장 이상), 0장·1장도 동작 |
| **단일/다중** | DB **다중 행** + 프론트 **전부 노출**(슬라이드). 자동 전환 5초, fade 700ms, `prefers-reduced-motion` 시 첫 장 고정 |
| **모바일 전용 이미지** | **md~lg 미만**: `mobile_image_url ?? image_url` / **lg+**: `image_url` (히어로 배경 전용 스택 2중) |

---

## 8. 재사용 가능한 관리자 구조

- **`ImageUploadField`**: 상품·일정·배너 등 공통 업로드 + URL 입력.
- **`AdminBannerManager`**: 배너 CRUD + 위 필드 2개(PC/모바일).
- **배너 API**: JSON body로 URL 저장 (파일은 업로드 API가 먼저 URL을 만들어 줌).

---

## 9. 이번 작업(업로드형 히어로 확장) 시 막힐 수 있는 포인트

1. **히어로와 업로드 경로 혼재**  
   - 업로드 경로가 `products/...`로 고정 — 배너 전용 prefix/버킷 정책이 필요하면 `generatePath` 분기 또는 별도 API.

2. **도트/화살표·링크 배너**  
   - 슬라이드 UI는 fade 자동만 구현. 네비게이션·`link_url` 클릭은 후속 PR.

3. **`link_url` 무용**  
   - 배경이 `pointer-events-none`이라 링크 배너가 되려면 클릭 가능 레이어 추가.

4. **Next/Image 도메인**  
   - Supabase public URL이 `images.remotePatterns` 등에 허용돼 있어야 함 (`next.config`).

5. **히어로 “문구”와 “배너” 분리**  
   - 이미지는 `home_banners`, 카피는 `home_hero_content` — 한 화면에서 묶어 편집하려면 관리 UI/스키마 통합 검토.

---

## 10. 문서 이력

- 초안: 히어로 배너·업로드·스토리지·홈 연결 코드 발췌.
- **feat(home-hero)**: 다중 배너 fade 슬라이드 + `mobile_image_url` md~lg 구간 연결 반영.
