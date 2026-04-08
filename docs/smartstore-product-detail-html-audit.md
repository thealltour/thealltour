# 스마트스토어 상품 상세설명 HTML 생성 PR — 코드·데이터 발췌

> 작성 기준: 저장소 워크스페이스 HEAD와 동일한 내용을 `docs/smartstore-html-audit-sources/`에 미러해 두었습니다.  
> 본 문서는 **요약·판단 메모**, **핵심 발췌**, **전체가 필요한 파일(page.tsx 등)** 을 한 파일에서 검토할 수 있게 구성했습니다.

## 원본 미러 디렉터리 (`docs/smartstore-html-audit-sources/`)

| 저장소 경로 | 미러 파일명 |
|-------------|-------------|
| `src/app/products/[id]/page.tsx` | `page.tsx` |
| `src/components/products/ProductDetailV2.tsx` | `ProductDetailV2.tsx` |
| `src/components/product-detail/ProductDetailTabs.tsx` | `ProductDetailTabs.tsx` |
| `src/lib/admin/productPreview.ts` | `productPreview.ts` |
| `src/types/product.ts` | `product.ts` |
| `src/types/adminProductForm.ts` | `adminProductForm.ts` |
| `src/lib/products/mapProductToTimelineModel.ts` | `mapProductToTimelineModel.ts` |
| `src/lib/noticeTemplates.ts` | `noticeTemplates.ts` |
| `src/lib/media/normalizeProductImageUrl.ts` | `normalizeProductImageUrl.ts` |
| `src/lib/products/images.ts` | `images.ts` |
| `src/components/admin/products/AdminProductManager.tsx` | `AdminProductManager.tsx` |
| `src/components/admin/ProductFormActionBar.tsx` | `ProductFormActionBar.tsx` |
| `src/components/admin/products/editor/ProductEditorShell.tsx` | `ProductEditorShell.tsx` |
| `src/components/admin/products/editor/adminProductPreview.mapper.ts` | `adminProductPreview.mapper.ts` |
| `src/components/admin/products/editor/adminProductForm.validation.ts` | `adminProductForm.validation.ts` |
| `src/components/admin/products/editor/adminProductForm.types.ts` | `adminProductForm.types.ts` |
| `src/app/globals.css` | `globals.css` |

---

## [1] 상품 상세 데이터 조회·조립

### 1-1 요약

- **조회**: `getProductByIdFresh(id)` (`src/lib/products`).
- **포함/불포함/선택관광 폴백**: `included_items`·`excluded_items`가 비어 있고 `optional_tours` 또는 `terms_and_notes`만 있으면 레거시 매핑(`optional_tours`→포함, `terms_and_notes`→불포함, `optional_tours` props는 생략).
- **예약/여행/예약조건/환불**: `resolveProductNoticesForDetailPage(product)` — 직접입력 → 공통 템플릿 → (`booking_notes`만) `terms_and_notes` 레거시.
- **ProductDetailV2**: `product` 전체 + 위에서 resolve한 문자열 props.

### 1-2 `src/app/products/[id]/page.tsx` (전체)

```tsx
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import ProductDetailV2 from "@/components/products/ProductDetailV2";
import { ProductReviewsSection } from "@/components/products/ProductReviewsSection";
import { ProductReviewSection } from "@/components/products/ProductReviewSection";
import RelatedProductsSection from "@/components/products/RelatedProductsSection";
import { GuideCard } from "@/components/guides/GuideCard";
import {
  ProductDetailStickyV2Desktop,
  ProductDetailStickyV2Mobile,
} from "@/components/products/ProductDetailStickyV2";
import { PageContainer } from "@/components/layout/PageContainer";
import { NavigationContextHeader } from "@/components/navigation/NavigationContextHeader";
import {
  buildProductsBreadcrumbItems,
  getProductsNavFallbackHref,
} from "@/components/navigation/breadcrumb-config";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ProductQuoteProvider } from "@/components/products/ProductQuoteContext";
import AlertCard from "@/components/ui/AlertCard";
import { ConsultModalProvider } from "@/components/inquiry/ConsultModal";
import { getProductByIdFresh, getProducts } from "@/lib/products";
import { getRelatedProducts } from "@/lib/products/getRelatedProducts";
import { getGuidesByDestinationId } from "@/lib/guides";
import { getProductReviewStats, getProductReviews } from "@/lib/reviewStats";
import { buildProductReviewJsonLd } from "@/lib/seo/products";
import { addTrustScoresToReviews } from "@/lib/reviewTrustScore";
import {
  buildProductReviewStructuredData,
} from "@/lib/reviewStructuredData";
import { parseReviewPersonalizationContext } from "@/lib/reviewPersonalizationContext";
import { getReviewExperimentVariant } from "@/lib/reviewExperimentAssignment";
import { cookies } from "next/headers";
import { getSiteSettings } from "@/lib/siteSettings";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { THEALL_WORDMARK_IMAGE_SRC } from "@/lib/brandAssets";
import { getProductSeoData } from "@/lib/products/getProductSeoData";
import { getSiteBaseUrl, toAbsoluteUrl } from "@/lib/seo/getSiteSeoDefaults";
import { resolveProductNoticesForDetailPage } from "@/lib/noticeTemplates";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const siteUrl = getSiteBaseUrl();
  const productPath = `/products/${id}`;
  const productUrl = `${siteUrl}${productPath}`;
  const defaultOgImageUrl = `${siteUrl}/og-default-v1.png`;
  /** 메타 description·OG 부제는 getProductSeoData 내부에서 DB SEO → slug 패턴 카피 → fallback 순으로 결정 */
  const seo = await getProductSeoData(id);

  if (!seo) {
    const title = "여행 상품 상세 | 일정·가격·후기 한눈에 | 더올투어";
    const description =
      "여행 상품 상세 정보입니다. 일정, 가격, 후기까지 한 번에 확인하고 상담으로 맞춤 여행을 준비해보세요.";
    return {
      title,
      description,
      alternates: {
        canonical: productUrl,
      },
      openGraph: {
        type: "article",
        url: productUrl,
        siteName: "더올투어",
        title,
        description,
        images: [
          {
            url: defaultOgImageUrl,
            width: 1200,
            height: 630,
            alt: "여행 상품 상세",
          },
        ],
        locale: "ko_KR",
      },
    };
  }

  const title = `${seo.name} | 일정·가격·후기 한눈에 | 더올투어`;
  const description = `${seo.name} 여행 상품 상세 정보입니다. 일정, 가격, 후기까지 한 번에 확인하고 상담으로 맞춤 여행을 준비해보세요.`;

  return {
    title,
    description,
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      type: "article",
      url: productUrl,
      siteName: "더올투어",
      title,
      description,
      images: [
        {
          url: defaultOgImageUrl,
          width: 1200,
          height: 630,
          alt: seo.name,
        },
      ],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${productPath}/twitter-image`],
    },
  };
}

function formatPrice(price?: number) {
  if (typeof price !== "number") return null;
  return new Intl.NumberFormat("ko-KR").format(price);
}

type FlightCardData = {
  fromAirport?: string;
  fromDate?: string;
  fromTime?: string;
  toAirport?: string;
  toDate?: string;
  toTime?: string;
  flightName?: string;
};

export default async function ProductDetailPage({ params, searchParams }: ProductDetailPageProps) {
  const { id } = await params;
  const rawSearch = searchParams ? await searchParams : {};
  const personalizationContext = parseReviewPersonalizationContext(rawSearch);
  const reviewSort =
    rawSearch?.reviewSort === "rating" ? "rating" : rawSearch?.reviewSort === "latest" ? "latest" : undefined;
  const cookieStore = await cookies();
  const subjectKey = cookieStore.get("review_exp_subject")?.value;
  const persistedVariant = cookieStore.get("review_exp_highlight")?.value;
  const queryVariant = typeof rawSearch?.reviewVariant === "string" ? rawSearch.reviewVariant : undefined;
  const reviewExperimentVariant = getReviewExperimentVariant("review_highlight_variant", {
    queryVariant,
    persistedVariant: persistedVariant ?? undefined,
    subjectKey: subjectKey ?? undefined,
  });
  const product = await getProductByIdFresh(id);

  if (!product) {
    notFound();
  }

  if (product.is_active === false) {
    notFound();
  }

  const formattedPrice = formatPrice(product.price);
  const normalizedIncluded = product.included_items?.trim() ?? "";
  const normalizedExcluded = product.excluded_items?.trim() ?? "";
  const normalizedOptional = product.optional_tours?.trim() ?? "";
  const normalizedTerms = product.terms_and_notes?.trim() ?? "";
  const shouldFallbackFromLegacyDetailFields =
    !normalizedIncluded && !normalizedExcluded && (normalizedOptional || normalizedTerms);
  const resolvedIncludedItems = shouldFallbackFromLegacyDetailFields
    ? product.optional_tours ?? product.inclusions
    : product.included_items ?? product.inclusions;
  const resolvedExcludedItems = shouldFallbackFromLegacyDetailFields
    ? product.terms_and_notes
    : product.excluded_items;
  const resolvedOptionalTours = shouldFallbackFromLegacyDetailFields ? undefined : product.optional_tours;
  const {
    bookingNotes: resolvedBookingNotes,
    travelNotes: resolvedTravelNotes,
    bookingConditions: resolvedBookingConditions,
    refundPolicy: resolvedRefundPolicy,
  } = await resolveProductNoticesForDetailPage(product);
  const siteUrl = getSiteBaseUrl();
  const productUrl = `${siteUrl}/products/${product.id}`;
  const productImageUrl = toAbsoluteUrl(siteUrl, product.image_url?.trim() || THEALL_WORDMARK_IMAGE_SRC);
  const productReviewStats = await getProductReviewStats(product.id);
  const productReviewsForSeo = await getProductReviews(product.id, {
    limit: 50,
    sort: "recommended",
  });
  const reviewsWithTrust = addTrustScoresToReviews(productReviewsForSeo);
  const reviewsForSeo = reviewsWithTrust.map((r) => ({ ...r, status: "visible" }));
  const structuredData = buildProductReviewStructuredData(
    { name: product.title, id: product.id },
    reviewsForSeo,
  );
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
  if (structuredData) {
    if (structuredData.aggregateRating) {
      (productJsonLdBase as Record<string, unknown>).aggregateRating =
        structuredData.aggregateRating;
    }
    if (structuredData.review?.length) {
      (productJsonLdBase as Record<string, unknown>).review = structuredData.review;
    }
  } else {
    delete (productJsonLdBase as Record<string, unknown>).aggregateRating;
    delete (productJsonLdBase as Record<string, unknown>).review;
  }
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
  const departureFlight: FlightCardData = {
    fromAirport: product.departure_from_airport,
    fromDate: product.departure_from_date,
    fromTime: product.departure_from_time,
    toAirport: product.departure_to_airport,
    toDate: product.departure_to_date,
    toTime: product.departure_to_time,
    flightName: product.departure_flight_name,
  };
  const arrivalFlight: FlightCardData = {
    fromAirport: product.arrival_from_airport,
    fromDate: product.arrival_from_date,
    fromTime: product.arrival_from_time,
    toAirport: product.arrival_to_airport,
    toDate: product.arrival_to_date,
    toTime: product.arrival_to_time,
    flightName: product.arrival_flight_name,
  };
  const settings = await getSiteSettings();
  const kakaoHref = settings.kakao_chat_url || settings.kakao_channel_url || "https://pf.kakao.com";
  const sourcePath = `/products/${product.id}`;
  const [relatedGuides, allProducts] = await Promise.all([
    product.destination_id?.trim()
      ? getGuidesByDestinationId(product.destination_id.trim(), 3)
      : Promise.resolve([]),
    getProducts(),
  ]);

  const relatedProducts = getRelatedProducts({
    currentProduct: product,
    allProducts,
    limit: 6,
  });

  const statusV2 = product.status ?? "AVAILABLE";
  const oneLiner =
    product.one_liner?.trim() ||
    product.description?.trim().split(/\n/)[0]?.slice(0, 200) ||
    product.title;

  const hasReviews = productReviewStats.reviewCount > 0;

  return (
    <ConsultModalProvider>
      <ProductQuoteProvider>
        <SiteHeader activeTab="products" />
      <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white py-6 sm:py-10 md:py-14">
        <PageContainer size="wide">
          <main className="w-full">
            <NavigationContextHeader
              items={buildProductsBreadcrumbItems("product_detail", {
                currentLabel: product.title,
              })}
              pageTitle={product.title}
              fallbackHref={getProductsNavFallbackHref("product_detail")}
            />

            <div className="flex gap-8 xl:gap-10 lg:items-start">
            <div className="min-w-0 flex-1 space-y-8 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
              <section className="rounded-none bg-transparent shadow-none ring-0 sm:rounded-3xl sm:bg-white sm:shadow-md sm:ring-1 sm:ring-[#dbeafe]">
                <script
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
                />
                <div className="p-0 sm:p-6 md:p-8">
                  <ProductDetailV2
                    title={product.title}
                    region={product.theme}
                    category={product.category}
                    statusTag={statusV2}
                    oneLiner={oneLiner}
                    priceFormatted={formattedPrice}
                    duration={product.duration}
                    priceMeta={product.price_meta || "1인 기준"}
                    fuelIncluded={product.fuel_included}
                    includedItems={resolvedIncludedItems ?? ""}
                    excludedItems={resolvedExcludedItems ?? ""}
                    detailedSchedule={product.detailed_schedule ?? product.itinerary ?? ""}
                    optionalTours={resolvedOptionalTours ?? ""}
                    minDeparturePeople={product.min_departure_people ?? ""}
                    bookingNotes={resolvedBookingNotes}
                    travelNotes={resolvedTravelNotes}
                    bookingConditions={resolvedBookingConditions}
                    refundPolicy={resolvedRefundPolicy}
                    consultHref={`/quote?productId=${encodeURIComponent(product.id)}`}
                    productId={product.id}
                    productTitle={product.title}
                    sourcePath={sourcePath}
                    kakaoHref={kakaoHref}
                    trust={product.trust}
                    options={product.options}
                    basePrice={product.price}
                    product={product}
                    overviewFallbackUrl={product.image_url}
                    reviewSummary={productReviewStats.reviewCount > 0 ? { averageRating: productReviewStats.averageRating, reviewCount: productReviewStats.reviewCount } : undefined}
                  />
                </div>
              </section>

              {/* PR27: 리뷰 영역 신뢰도 카드 (평점/후기 수 또는 최근 예약 + 상담 CTA) */}
              <ProductReviewSection
                rating={productReviewStats.averageRating}
                reviewCount={productReviewStats.reviewCount}
                bookingCount={product.trust?.recentConsultCount}
                consultHref={`/quote?productId=${encodeURIComponent(product.id)}`}
                productId={product.id}
                productTitle={product.title}
                sourcePath={`${sourcePath}#reviews`}
                status={statusV2}
              />
              <ProductReviewsSection
                productId={product.id}
                productTitle={product.title}
                personalizationContext={personalizationContext}
                experimentKey="review_highlight_variant"
                variant={reviewExperimentVariant}
                reviewSort={reviewSort}
                hideWhenNoReviews
              />

              {/* PR43: 연관 상품 섹션 (관련도 우선 정렬, fallback 채움) */}
              <RelatedProductsSection
                title="이 상품과 비슷한 여행"
                description="여행지, 테마, 상품 구성이 비슷한 상품을 모아봤어요."
                products={relatedProducts}
              />

              {relatedGuides.length > 0 ? (
                <SectionBlock surface="none" padding="md">
                  <SectionHeader
                    eyebrow="TRAVEL GUIDE"
                    title="이 여행을 더 잘 즐기는 방법"
                    description="이 지역과 관련된 가이드를 만나보세요."
                    align="left"
                  />
                  <ul
                    className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    aria-label="관련 가이드"
                  >
                    {relatedGuides.map((guide) => (
                      <li key={guide.id} className="flex min-h-0 h-full min-w-0">
                        <GuideCard guide={guide} className="w-full" />
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    <Link
                      href="/guides"
                      className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                    >
                      가이드 더 보기
                    </Link>
                  </div>
                </SectionBlock>
              ) : null}

              <AlertCard variant="info" title="상담 안내">
                문의를 남겨주시면 일정/예산/동행구성에 맞춰 맞춤 동선과 견적 옵션을 안내드립니다.
              </AlertCard>
            </div>

            <ProductDetailStickyV2Desktop
              priceFormatted={formattedPrice}
              productId={product.id}
              productTitle={product.title}
              sourcePath={sourcePath}
              kakaoHref={kakaoHref}
              status={statusV2}
              trust={product.trust}
              product={product}
              experimentKey="review_highlight_variant"
              variant={reviewExperimentVariant}
            />
          </div>
        </main>
        </PageContainer>

        <ProductDetailStickyV2Mobile
          priceFormatted={formattedPrice}
          productId={product.id}
          productTitle={product.title}
          sourcePath={sourcePath}
          kakaoHref={kakaoHref}
          status={statusV2}
          trust={product.trust}
          product={product}
          experimentKey="review_highlight_variant"
          variant={reviewExperimentVariant}
        />
      </div>
      </ProductQuoteProvider>
    </ConsultModalProvider>
  );
}

```
### 1-3 `resolveProductNoticesForDetail*` (발췌: `src/lib/noticeTemplates.ts` 124–244행)

```ts
export type ResolvedProductNoticesForDetail = {
  bookingNotes: string;
  travelNotes: string;
  bookingConditions: string;
  refundPolicy: string;
};

export async function resolveBookingNoticeForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  legacyTerms: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  const t = (await getNoticeTemplateContent("booking_notes", templateType ?? undefined)).trim();
  if (t) return t;
  // TODO(PR-H): legacy fallback (terms_and_notes) is temporary — remove after full migration
  return legacyTerms?.trim() ?? "";
}

export async function resolveTravelNoticeForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return (await getNoticeTemplateContent("travel_notes", templateType ?? undefined)).trim();
}

export async function resolveBookingConditionsForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return (await getNoticeTemplateContent("booking_conditions", templateType ?? undefined)).trim();
}

/** 환불 규정: 직접입력 → refund_policy 템플릿만. legacy/terms_and_notes 폴백 없음 */
export async function resolveRefundPolicyForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return (await getNoticeTemplateContent("refund_policy", templateType ?? undefined)).trim();
}

/**
 * 상품 상세·관리자 미리보기(서버) 공통 해석.
 * 순서: 직접입력 → 공통 템플릿 → (예약 유의만) terms_and_notes 레거시.
 * 템플릿 로드는 getNoticeTemplatesByGroup 캐시를 공유하므로 Promise.all로 병렬 호출해도 중복 fetch가 최소화됨.
 */
export async function resolveProductNoticesForDetailPage(
  product: Product,
): Promise<ResolvedProductNoticesForDetail> {
  const [bookingNotes, travelNotes, bookingConditions, refundPolicy] = await Promise.all([
    resolveBookingNoticeForDetail(
      product.booking_notes,
      product.booking_notes_template_type,
      product.terms_and_notes,
    ),
    resolveTravelNoticeForDetail(product.travel_notes, product.travel_notes_template_type),
    resolveBookingConditionsForDetail(
      product.booking_conditions,
      product.booking_conditions_template_type,
    ),
    resolveRefundPolicyForDetail(product.refund_policy, product.refund_policy_template_type),
  ]);
  return { bookingNotes, travelNotes, bookingConditions, refundPolicy };
}

export function resolveBookingNoticeForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  legacyTerms: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
  legacyTermsMap: TermsTemplateMap | null | undefined,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  const t = getNoticeTemplateContentFromMaps(
    noticeMaps,
    "booking_notes",
    templateType,
    legacyTermsMap ?? undefined,
  );
  if (t) return t;
  // TODO(PR-H): legacy fallback (terms_and_notes) is temporary — remove after full migration
  return legacyTerms?.trim() ?? "";
}

export function resolveTravelNoticeForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return getNoticeTemplateContentFromMaps(noticeMaps, "travel_notes", templateType);
}

export function resolveBookingConditionsForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return getNoticeTemplateContentFromMaps(noticeMaps, "booking_conditions", templateType);
}

export function resolveRefundPolicyForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return getNoticeTemplateContentFromMaps(noticeMaps, "refund_policy", templateType);
}
```
---

## [2] 사용자용 상세 렌더링

- **전문**: 미러 `ProductDetailV2.tsx`, `ProductDetailTabs.tsx`.
- **`parseBulletLines`**: 두 컴포넌트에 **동일 로직의 로컬 함수**(공용 유틸 아님).

### 2-1 스마트스토어 HTML에 쓸 만한 데이터 흐름 (`ProductDetailV2`)

- **갤러리**: `images_json`, `image_url`, `itinerary_v2_json.days[].coverImageUrl`, `itinerary_media_json` → `normalizeProductImageUrl`.
- **탭 본문**: `parseBulletLines`로 `includedItems`, `excludedItems`, `optionalTours`, `bookingNotes`, `travelNotes`, `bookingConditions`, `refundPolicy`.
- **일정**: `parseScheduleDays(detailedSchedule)` + `mapProductToTimelineModel(product)`.

---

## [3] 관리자 편집·미리보기·액션

- **`ProductForm.tsx`**: 없음 → `ProductEditorShell` + `ProductFormState`.
- **액션 바**: `ProductFormActionBar` (`id="product-form-actionbar"`), `onPreviewClick` → `#product-form-preview-panel` 스크롤.
- **미리보기**: `mapAdminProductFormToPreviewProduct` → `productToDetailV2PropsPayload` + `POST /api/admin/products/preview`.

### 3-1 `AdminProductManager.tsx` PR용 발췌 (전문은 미러 파일)

```tsx
// previewProduct / localDetailProps / serverPreview (대략 902–953행)
const previewProduct = useMemo(() => {
  const base = mapAdminProductFormToPreviewProduct(
    form,
    previewImageObjectUrl ?? form.images_json[0] ?? form.image_url?.trim() ?? "",
  );
  return hydrateProductWithCampaignCardMeta(base, activeCampaignOptions);
}, [form, previewImageObjectUrl, activeCampaignOptions]);

const localDetailProps = useMemo(() => {
  const payload = productToDetailV2PropsPayload(
    previewProduct,
    noticeTemplatesByGroup,
    legacyTermsTemplateMap,
  );
  return { ...payload, onConsultClick: () => {}, kakaoHref: "#", trust: undefined };
}, [previewProduct, noticeTemplatesByGroup, legacyTermsTemplateMap]);

// POST /api/admin/products/preview (대략 1218–1253행)
fetch("/api/admin/products/preview", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ form, imageUrl }),
});

function handlePreviewClick() {
  document.getElementById("product-form-preview-panel")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

// ProductFormActionBar onPreviewClick={handlePreviewClick}
// aside#product-form-preview-panel 내부 ProductDetailV2 {...previewDetailProps}

```


---

## [4] 관리자 미리보기 변환

- 미러 `productPreview.ts`: `formToPreviewProduct`, `productToDetailV2PropsPayload`.
- 스마트스토어 HTML: 동일 입력으로 `buildSmartstoreDetailHtml(...)` 신설 권장.

---

## [5] 타입·스키마

- `product.ts`, `adminProductForm.ts`, `adminProductForm.validation.ts`, `adminProductForm.types.ts` → 미러 동명 파일.

---

## [6] 유틸

- **일정**: 미러 `mapProductToTimelineModel.ts`.
- **이미지**: 미러 `normalizeProductImageUrl.ts`, `images.ts`.
- **클립보드**: 공용 유틸 없음; `navigator.clipboard.writeText` 패턴(`AdminProductManager` JSON 복사 등).

---

## [7] 상품 데이터 예시 (합성, 비식별)

### 7-1 일반 패키지

```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "title": "○○ 5일 패키지",
  "one_liner": "핵심 일정 한 줄 요약",
  "description": "본문 첫 줄\n추가 설명",
  "image_url": "https://cdn.example.com/cover.jpg",
  "images_json": ["https://cdn.example.com/cover.jpg", "https://cdn.example.com/gallery-2.jpg"],
  "itinerary_v2_json": null,
  "itinerary_days_json": [],
  "itinerary_media_json": {},
  "detailed_schedule": "[1일차]\n공항 픽업\n\n[2일차]\n시티 투어",
  "included_items": "왕복 항공권\n4성급 호텔",
  "excluded_items": "개인 경비\n선택 관광",
  "optional_tours": "야경 투어 (별도)",
  "booking_conditions": "계약금 10%\n잔금 출발 14일 전",
  "booking_notes": "여권 사본 필요",
  "travel_notes": "현지 날씨 확인",
  "refund_policy": "출발 30일 전 100%\n7일 전 50%",
  "terms_and_notes": null,
  "min_departure_people": "10"
}
```


### 7-2 이미지·일정 풍부

```json
{
  "id": "00000000-0000-0000-0000-000000000002",
  "title": "△△ 딥다이브 7일",
  "image_url": "https://cdn.example.com/hero.jpg",
  "images_json": ["https://cdn.example.com/hero.jpg", "https://cdn.example.com/extra-1.jpg"],
  "itinerary_v2_json": {
    "days": [
      {
        "day": 1,
        "title": "도착 & 자유",
        "coverImageUrl": "https://cdn.example.com/day1-cover.jpg",
        "events": [
          {
            "heading": "공항 픽업",
            "description": "전용 차량",
            "images": [{ "url": "https://cdn.example.com/day1-ev1.jpg" }]
          }
        ]
      },
      {
        "day": 2,
        "title": "핵심 관광",
        "events": [{ "heading": "국립공원", "description": "가이드 동행" }]
      }
    ]
  },
  "itinerary_media_json": { "2": "https://cdn.example.com/day2-fallback.jpg" },
  "included_items": "가이드\n입장료",
  "excluded_items": "점심\n개인 경비"
}
```


---

## [8] 스타일 톤

- 미러 `globals.css` (`--primary`, `--surface` 등).
- `ProductDetailV2`: 카드 `#dbeafe` / `#f8fbff`, 제목 `#0f172a`, 본문 slate 계열 → 인라인 스타일 매핑 참고.

---

## [9] PR 메모

1. **버튼 위치**: `ProductFormActionBar` + (선택) 미리보기 패널 헤더.
2. **이미지 URL**: 공개 https + `normalizeProductImageUrl`; 만료형 signed URL은 본 파이프라인에서 미확인.
3. **재사용**: `resolveProductNotices*`, `productToDetailV2PropsPayload`, `formToPreviewProduct`, `mapProductToTimelineModel`, `normalizeProductImageUrl`, (추출) `parseBulletLines`.

---

## [10] 발췌 형식

- **전체 복사**: `docs/smartstore-html-audit-sources/` 원본과 저장소 파일이 동일.
- **본 md**: `page.tsx` 전체 + 공지 resolve 발췌 + 운영 메모.

