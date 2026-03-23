# 로고·아이콘·메타데이터·구조화데이터 전수 점검 발췌

작성 기준: 현재 워크스페이스 실제 코드(검색/브라우저 탭/구조화 데이터 영향 지점).

## 1) App Router / Public 아이콘 파일 존재 여부

### 점검 결과

- 없음: `/app/favicon.ico`
- 없음: `/app/icon.png`
- 없음: `/app/icon.jpg`
- 없음: `/app/apple-icon.png`
- 없음: `/public/favicon.ico`
- 존재 (2025 업데이트):
  - `/public/favicon.ico`
  - `/public/favicon-16-v2.png`
  - `/public/favicon-32-v2.png`
  - `/public/apple-touch-icon-v2.png`

### 실제 적용 소스(추정)

- 아이콘 파일 자체보다 `src/app/layout.tsx`의 `metadata.icons`가 실제 브라우저 탭 아이콘 선언의 기준입니다.
- 경로 상수는 `src/lib/brandAssets.ts`에서 관리됩니다.

```ts
/**
 * 승인 워드마크 — 라이트(흰 배경) / 다크(납품 다크 배경)
 *
 * `next/image` 캐시 회피: 자산 교체 시 파일명 버전(v5/v6…) 올리기.
 */
/** 치수 변경 시 `ThemedWordmarkImage.tsx` 내 `WORDMARK_INTRINSIC_*` 도 맞출 것 */
export const THEALL_WORDMARK_INTRINSIC_LIGHT = { width: 1024, height: 184 } as const;
export const THEALL_WORDMARK_INTRINSIC_DARK = { width: 1024, height: 189 } as const;

/** @deprecated 라이트와 동일 — 하위 호환 */
export const THEALL_WORDMARK_INTRINSIC = THEALL_WORDMARK_INTRINSIC_LIGHT;

export const THEALL_WORDMARK_LIGHT_SRC = "/thealltour-wordmark-light-v5.png" as const;
export const THEALL_WORDMARK_DARK_SRC = "/thealltour-wordmark-dark-v6.png" as const;

/** OG·JSON-LD·폴백 등 단일 URL이 필요할 때 — 라이트 자산 */
export const THEALL_WORDMARK_IMAGE_SRC = THEALL_WORDMARK_LIGHT_SRC;

/** 파비콘·앱 아이콘 (`public/favicon-*.png`, `apple-touch-icon.png`) */
export const THEALL_FAVICON_16_SRC = "/favicon-16.png" as const;
export const THEALL_FAVICON_32_SRC = "/favicon-32.png" as const;
export const THEALL_APPLE_TOUCH_ICON_SRC = "/apple-touch-icon.png" as const;
```

---

## 2) metadata 선언부 (generateMetadata / export metadata / icons)

## `src/app/layout.tsx` (전역 적용 핵심 소스)

실제 적용 소스 추정: **매우 높음** (루트 레이아웃이므로 전체 App Router에 기본 적용).

```tsx
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import {
  THEALL_APPLE_TOUCH_ICON_SRC,
  THEALL_FAVICON_16_SRC,
  THEALL_FAVICON_32_SRC,
} from "@/lib/brandAssets";
// ...중략(import)

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://thealltour.com").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "더올투어 | 맞춤형 해외·국내 골프투어",
    template: "%s | 더올투어",
  },
  description:
    "가족여행, 효도여행, 골프투어, 테마여행까지. 상담부터 일정 제안까지 맞춤형으로 도와드립니다.",
  icons: {
    icon: [
      { url: THEALL_FAVICON_16_SRC, sizes: "16x16", type: "image/png" },
      { url: THEALL_FAVICON_32_SRC, sizes: "32x32", type: "image/png" },
    ],
    shortcut: THEALL_FAVICON_32_SRC,
    apple: THEALL_APPLE_TOUCH_ICON_SRC,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "더올투어",
    locale: "ko_KR",
    // ...
  },
  twitter: {
    card: "summary_large_image",
    // ...
  },
};
```

## `src/app/page.tsx`

실제 적용 소스 추정: 높음 (홈 탭 타이틀/검색 결과 제목·설명).

```tsx
import type { Metadata } from "next";
// ...
const META_TITLE = "더올투어 | 맞춤형 해외·국내 골프투어";
const META_DESC = "가족여행, 효도여행, 골프투어, 테마여행까지. 더올투어에서 맞춤형 일정으로 제안해드립니다.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
};
```

## `src/app/destinations/page.tsx`

```tsx
export const metadata = {
  title: "지역별 여행 | 더올투어",
  description:
    "가고 싶은 지역부터 여행을 찾아보세요. 더올투어가 안내하는 지역별 여행·골프·패키지 상품을 만나보실 수 있습니다.",
};
```

## `src/app/themes/page.tsx`

```tsx
export const metadata = {
  title: "테마별 여행 | 더올투어",
  description:
    "원하는 여행 스타일, 목적, 분위기 기준으로 상품을 탐색해 보세요. 더올투어가 준비한 테마별 여행·골프·패키지를 만나보실 수 있습니다.",
};
```

## `src/app/recommended/page.tsx`

```tsx
export const metadata = {
  title: "여행추천 | 더올투어",
  description:
    "더올투어가 선별한 추천 여행·골프·패키지 상품을 만나보세요. 큐레이션된 코스로 쉽게 탐색할 수 있습니다.",
};
```

## `src/app/products/[id]/page.tsx`

실제 적용 소스 추정: 매우 높음 (상품 상세 canonical/OG/Twitter + JSON-LD 연결).

```tsx
export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const siteUrl = getSiteBaseUrl();
  const productPath = `/products/${id}`;
  const productUrl = `${siteUrl}${productPath}`;
  const seo = await getProductSeoData(id);

  if (!seo) {
    return {
      title: "패키지상품 | 더올투어",
      description: "더올투어 패키지상품 정보를 확인해 보세요.",
      alternates: {
        canonical: productUrl,
      },
    };
  }

  return {
    title: seo.browserTitle,
    description: seo.metaDescription,
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      type: "article",
      url: productUrl,
      siteName: "더올투어",
      title: seo.browserTitle,
      description: seo.metaDescription,
      images: [
        {
          url: `${productPath}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: seo.name,
        },
      ],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.browserTitle,
      description: seo.metaDescription,
      images: [`${productPath}/twitter-image`],
    },
  };
}
```

## `src/app/products/region/[slug]/page.tsx`

```tsx
export async function generateMetadata({ params }: RegionLandingProps): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = slug?.trim() ?? "";
  const siteUrl = getSiteBaseUrl();

  if (!trimmed) {
    return {
      title: "지역별 여행",
      description: "더올투어 지역별 맞춤 골프·테마 여행 상품을 확인해 보세요.",
      alternates: { canonical: `${siteUrl}/products` },
    };
  }

  const seo = await getRegionSeoData(trimmed);
  const path = `/products/region/${trimmed}`;
  const url = `${siteUrl}${path}`;

  if (!seo) {
    return {
      title: "지역별 여행",
      description: "더올투어 지역별 맞춤 여행 상품을 확인해 보세요.",
      alternates: { canonical: url },
    };
  }

  return {
    title: { absolute: seo.documentTitle },
    description: seo.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "더올투어",
      title: seo.documentTitle,
      description: seo.metaDescription,
      images: [{ url: `${path}/opengraph-image`, width: 1200, height: 630, alt: `${seo.ogTitle} 지역 여행` }],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.documentTitle,
      description: seo.metaDescription,
      images: [`${path}/twitter-image`],
    },
  };
}
```

## `src/app/products/theme/[slug]/page.tsx`

```tsx
export async function generateMetadata({ params }: ThemeLandingProps): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = slug?.trim() ?? "";
  const siteUrl = getSiteBaseUrl();

  if (!trimmed) {
    return {
      title: "테마별 여행",
      description: "더올투어 테마별 맞춤 여행 상품을 확인해 보세요.",
      alternates: { canonical: `${siteUrl}/products` },
    };
  }

  const seo = await getThemeSeoData(trimmed);
  const path = `/products/theme/${trimmed}`;
  const url = `${siteUrl}${path}`;

  if (!seo) {
    return {
      title: "테마별 여행",
      description: "더올투어 테마별 맞춤 여행 상품을 확인해 보세요.",
      alternates: { canonical: url },
    };
  }

  return {
    title: { absolute: seo.documentTitle },
    description: seo.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "더올투어",
      title: seo.documentTitle,
      description: seo.metaDescription,
      images: [{ url: `${path}/opengraph-image`, width: 1200, height: 630, alt: `${seo.ogTitle} 테마 여행` }],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.documentTitle,
      description: seo.metaDescription,
      images: [`${path}/twitter-image`],
    },
  };
}
```

## `src/app/destinations/[slug]/page.tsx`

```tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const destination = await getDestinationBySlugForPublicLanding(slug);
  if (!destination) return { title: "Not Found" };
  const { title, description } = getTaxonomyMetadataFallback(destination);
  return {
    title: `${title} | 더올투어`,
    description: description || `${title} 지역 여행·골프·패키지 상품을 만나보세요.`,
  };
}
```

## `src/app/themes/[slug]/page.tsx`

```tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const theme = await getThemeBySlugForPublicLanding(slug);
  if (!theme) return { title: "Not Found" };
  const { title, description } = getTaxonomyMetadataFallback(theme);
  return {
    title: `${title} | 더올투어`,
    description:
      description ||
      `${title} 테마의 여행·골프·패키지 상품을 만나보세요.`,
  };
}
```

## `src/app/guides/[slug]/page.tsx`

```tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return { title: "가이드 | 더올투어" };

  const title =
    guide.seo_title?.trim() ||
    guide.title_override?.trim() ||
    guide.title ||
    "여행 가이드";
  const description =
    guide.seo_description?.trim() ||
    guide.summary?.trim() ||
    `${title} - 더올투어 여행 가이드`;
  const ogImage =
    guide.cover_image_url?.trim() ||
    guide.guide_thumbnail_url?.trim() ||
    guide.thumbnail_url?.trim() ||
    null;
  const canonicalUrl = toAbsoluteUrl(`/guides/${encodeURIComponent(slug)}`);

  return {
    title: `${title} | 더올투어`,
    description: description.slice(0, 160),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      siteName: "더올투어",
      title: `${title} | 더올투어`,
      description: description.slice(0, 160),
      images: ogImage ? [{ url: toAbsoluteUrl(ogImage) }] : [],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | 더올투어`,
      description: description.slice(0, 160),
      images: ogImage ? [toAbsoluteUrl(ogImage)] : [],
    },
  };
}
```

## `src/app/reviews/page.tsx`

```tsx
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const onlyVerified = params.verified === "1";
  const onlyWithImages = params.photos === "1";
  const productId = params.productId ?? undefined;
  let productTitle: string | undefined;
  if (productId) {
    const product = await getProductByIdFresh(productId);
    productTitle = product?.title;
  }
  const meta = buildReviewListMetadata({
    productId,
    productTitle,
    onlyVerified,
    onlyWithImages,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonical },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: meta.canonical,
      siteName: "더올투어",
      type: "website",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
  };
}
```

## `src/app/reviews/[id]/page.tsx`

```tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const review = await getPublicReviewById(id);
  if (!review) {
    return { title: "후기를 찾을 수 없습니다 | 더올투어" };
  }
  const meta = buildReviewDetailMetadata(review, {
    pageUrl: `${getSiteUrl()}/reviews/${id}`,
  });
  if (!meta) return { title: "여행 후기 | 더올투어" };
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonical },
    openGraph: meta.openGraph,
    twitter: meta.twitter,
  };
}
```

## robots 메타 선언 파일

- `src/app/reviews/write/page.tsx`
- `src/app/mypage/reviews/[id]/page.tsx`
- `src/app/reviews/claim/layout.tsx`

```tsx
// src/app/reviews/write/page.tsx
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};
```

```tsx
// src/app/mypage/reviews/[id]/page.tsx
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};
```

```tsx
// src/app/reviews/claim/layout.tsx
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};
```

---

## 3) manifest 관련

### 점검 결과

- 없음: `src/app/manifest.ts`
- 없음: `src/app/manifest.json`
- 없음: `public/site.webmanifest`
- 없음: `public/manifest.json`

실제 적용 소스 추정: 현재는 별도 웹앱 매니페스트 미운영 상태.

---

## 4) 구조화 데이터(JSON-LD) 관련

### `src/app/products/[id]/page.tsx` (`application/ld+json`)

실제 적용 소스 추정: 매우 높음 (상품 상세 HTML에 직접 삽입).

```tsx
const productJsonLdBase = buildProductReviewJsonLd(
  {
    id: product.id,
    title: product.title,
    description: product.description,
    image_url: product.image_url,
  },
  productReviewStats,
  [],
  { productUrl },
);
// ... aggregateRating/review 병합
const productJsonLd = {
  ...productJsonLdBase,
  category: product.category,
  offers:
    typeof product.price === "number"
      ? {
          "@type": "Offer",
          priceCurrency: "KRW",
          price: product.price,
          availability: "https://schema.org/InStock",
          url: productUrl,
        }
      : undefined,
};

<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
/>
```

### `src/app/reviews/[id]/page.tsx` (`application/ld+json`)

실제 적용 소스 추정: 매우 높음 (리뷰 상세 HTML에 직접 삽입).

```tsx
const reviewJsonLd = buildReviewJsonLd(review, { pageUrl });

<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewJsonLd) }}
/>
```

### `src/components/seo/ProductReviewJsonLd.tsx`

```tsx
export function ProductReviewJsonLd({
  product,
  reviews,
  options,
}: ProductReviewJsonLdProps) {
  const data: ProductReviewStructuredData | null = buildProductReviewStructuredData(
    product,
    reviews,
    options,
  );
  const json = serializeStructuredData(data);
  if (!json || json === "null") return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
```

### `src/lib/seo/reviews.ts` (`Organization`, `logo` 관련 키워드 포함 파일)

실제 적용 소스 추정: 높음 (리뷰 상세/리스트 메타+JSON-LD 빌더).

```ts
export function buildReviewJsonLd(
  review: PublicReviewItem,
  options?: { pageUrl?: string },
): Record<string, unknown> {
  // ...
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    // ...
    itemReviewed,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: siteUrl,
    },
    url: pageUrl,
    ...(images.length > 0 ? { image: images } : {}),
  };
}
```

### `src/lib/seo/products.ts`

실제 적용 소스 추정: 높음 (상품 상세 Product 스키마 베이스).

```ts
export function buildProductReviewJsonLd(
  product: ProductForSeo,
  stats: ProductReviewStats,
  reviews: PublicReviewItem[],
  options?: { productUrl?: string },
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: truncateForMeta(product.description || product.title, 160),
    image: [imageUrl],
    url: productUrl,
    brand: { "@type": "Brand", name: SITE_NAME },
  };
  // aggregateRating / review 추가
  return base;
}
```

### 키워드 점검 결과

- `Organization`: 있음 (`src/lib/seo/reviews.ts`)
- `logo`: 다수 파일에서 로고 컴포넌트/CSS 키워드 존재(브랜딩/헤더 UI), JSON-LD의 `logo` 속성은 현재 직접 선언 없음
- `WebSite`: 없음
- `LocalBusiness`: 없음
- `TravelAgency`: 없음
- `application/ld+json`: 있음 (`products/[id]`, `reviews/[id]`, `components/seo/ProductReviewJsonLd.tsx`)

---

## 5) head 태그 직접 선언(`rel="icon"`, `apple-touch-icon`, `shortcut icon`)

### 점검 결과

- `<link rel="icon">` 직접 선언: 없음
- `<link rel="apple-touch-icon">` 직접 선언: 없음
- `<link rel="shortcut icon">` 직접 선언: 없음

실제 적용 소스 추정: 직접 `<head>` 링크 대신 `metadata.icons`(루트 레이아웃) 사용.

참고: `src/app/layout.tsx`에는 아래 링크만 직접 존재

```tsx
<link
  rel="preconnect"
  href="https://qmswixmwquuazrhfyils.supabase.co"
  crossOrigin=""
/>
<link rel="dns-prefetch" href="https://img.modetour.com" />
```

---

## 6) robots / sitemap / canonical / metadataBase

### 확인된 항목

- `metadataBase`: `src/app/layout.tsx`
- `canonical`(alternates 포함): 아래 파일들
  - `src/app/products/[id]/page.tsx`
  - `src/app/products/region/[slug]/page.tsx`
  - `src/app/products/theme/[slug]/page.tsx`
  - `src/app/guides/[slug]/page.tsx`
  - `src/app/reviews/page.tsx`
  - `src/app/reviews/[id]/page.tsx`
- `robots`: 아래 파일들
  - `src/app/reviews/write/page.tsx`
  - `src/app/mypage/reviews/[id]/page.tsx`
  - `src/app/reviews/claim/layout.tsx`
- `sitemap` 라우트 파일 (`src/app/**/sitemap.*`): 없음
- `robots.txt` 라우트 파일 (`src/app/**/robots.*`): 없음

---

## 최종 적용 소스 요약(추정)

1. 브라우저 탭 아이콘: `src/app/layout.tsx`의 `metadata.icons` + `src/lib/brandAssets.ts` + `/public/favicon-*.png`, `/public/apple-touch-icon.png`
2. 검색결과 제목/설명/canonical: 각 라우트의 `metadata` 또는 `generateMetadata`
3. 구조화 데이터(JSON-LD): `src/app/products/[id]/page.tsx`, `src/app/reviews/[id]/page.tsx`에서 직접 `<script type="application/ld+json">` 삽입
4. 보조 SEO 빌더: `src/lib/seo/products.ts`, `src/lib/seo/reviews.ts`
