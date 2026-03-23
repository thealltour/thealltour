# 가이드 클릭 시 동일 페이지 갱신 PR — 관련 코드 발췌

> 목적: 노션 원문은 **새 창**으로 유지하면서, **현재 페이지**에서 클릭한 가이드 기준으로 추천상품·관련 카테고리/테마·이전/다음 가이드·목록 등을 갱신하는 작업을 위한 코드 맥락 정리.  
> 발췌 시점: 저장소 현재 기준 (파일 경로는 `src/` 기준).

---

## 요약 (현재 구조)

| 구분 | 내용 |
|------|------|
| `/guides` 목록 | 서버 `GuidesIndexPage` → `GuidesListClient`가 카드마다 `<a href={notionUrl} target="_blank">` (노션만). `GuideCard` 미사용. |
| 홈 가이드 | `HomeGuideSection` → `GuideCard` + `linkBehavior="notion_external"` → 노션 URL이면 `<a target="_blank">`. |
| `/guides/[slug]` | **이미 존재**. 서버에서 `getGuideBySlug`, `getProductsForGuide`, `getRelatedGuidesByGuide`로 관련 상품·가이드·destination/theme 링크 렌더. **이전/다음 가이드 로직 없음**. |
| `GuideDetailBody` | `window.open` + 노션 링크. **현재 코드베이스에서 import 되는 곳 없음**(미사용 컴포넌트). |

---

## [1] 가이드 카드 및 클릭 처리부

### `src/components/guides/GuideCard.tsx` (전체)

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import type { Guide } from "@/types/guide";
import { getGuideHref, getGuideNotionViewUrl } from "@/lib/guides";
import { cn } from "@/lib/cn";

export type GuideCardProps = {
  guide: Guide;
  className?: string;
  /** 요약/태그 표시 줄 수 등 조정용. 기본은 카드형 */
  variant?: "default" | "compact";
  /**
   * default: 사이트 내 링크(getGuideHref).
   * notion_external: /guides 목록과 동일하게 노션 원문(새 탭). URL 없으면 getGuideHref로 폴백.
   */
  linkBehavior?: "default" | "notion_external";
};

/** 이미지:텍스트 = 5:5(50%:50%). 행 높이는 카드 전체(h-full) 기준으로 균일. */
const CARD_LINK_CLASS =
  "group grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-soft-strong)] hover:ring-1 hover:ring-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 sm:rounded-3xl";

/**
 * 단일 가이드 카드. 썸네일, 제목, 요약, 카테고리/태그 일부.
 * 홈 / destination·theme 랜딩 / 가이드 상세 관련 가이드에서 공통 사용.
 */
export function GuideCard({
  guide,
  className,
  variant = "default",
  linkBehavior = "default",
}: GuideCardProps) {
  const notionUrl = linkBehavior === "notion_external" ? getGuideNotionViewUrl(guide).trim() : "";
  const siteHref = getGuideHref(guide);
  const openNotion = linkBehavior === "notion_external" && notionUrl.length > 0;
  const href = openNotion ? notionUrl : siteHref;
  const thumbUrl =
    guide.cover_image_url ?? guide.thumbnail_url ?? guide.guide_thumbnail_url ?? "";
  const title = guide.title_override?.trim() || guide.title;
  const hasCategoryOrTags = guide.category || (guide.tags?.length ?? 0) > 0;
  const hasTaxonomyNames = guide.destination_name || guide.theme_name;
  const showMeta = variant === "default" && (hasCategoryOrTags || !!hasTaxonomyNames);

  /** h-full: 레일·그리드에서 행 높이 맞춤. min-h: 비율 그리드가 쓸 최소 카드 높이. */
  const wrapperClass = cn(
    CARD_LINK_CLASS,
    "h-full min-h-[240px] min-w-0 max-w-full sm:min-h-[260px]",
    className,
  );

  const inner = (
    <>
      <div className="relative min-h-0 w-full overflow-hidden bg-[var(--surface-muted)]">
        {thumbUrl ? (
          <Image
            src={thumbUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full min-h-[5.5rem] items-center justify-center type-caption text-[var(--text-muted)]">
            가이드
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-col overflow-hidden p-4 sm:p-5">
        {showMeta ? (
          <div className="flex flex-wrap items-center gap-1.5 section-label text-[var(--text-muted)]">
            {guide.category ? (
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                {guide.category}
              </span>
            ) : null}
            {guide.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption"
              >
                {tag}
              </span>
            ))}
            {!hasCategoryOrTags && guide.destination_name ? (
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                {guide.destination_name}
              </span>
            ) : null}
            {!hasCategoryOrTags && guide.theme_name ? (
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                {guide.theme_name}
              </span>
            ) : null}
          </div>
        ) : null}
        <h3 className="font-card-title mt-1 line-clamp-2 type-small font-semibold text-[var(--foreground)]">
          {title}
        </h3>
        {variant === "default" && guide.summary ? (
          <p className="mt-1 line-clamp-2 type-caption text-[var(--text-muted)]">
            {guide.summary}
          </p>
        ) : null}
        <span className="mt-auto inline-flex items-center pt-3 section-label text-[var(--primary)]">
          보기
          <span className="ml-1" aria-hidden>→</span>
        </span>
      </div>
    </>
  );

  if (openNotion) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={wrapperClass}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={wrapperClass}>
      {inner}
    </Link>
  );
}
```

### `src/components/guides/GuidesListClient.tsx` (전체)

```tsx
"use client";

import type { Guide } from "@/types/guide";
import { getGuideNotionViewUrl } from "@/lib/guides";

export type GuideWithBadges = Guide & { badgeLabels: string[] };

type GuidesListClientProps = {
  guides: GuideWithBadges[];
};

export function GuidesListClient({ guides }: GuidesListClientProps) {
  if (guides.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 type-small text-content-muted shadow-md ring-1 ring-[#e2e8f0]">
        아직 등록된 여행가이드가 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {guides.map((guide) => {
        const notionUrl = getGuideNotionViewUrl(guide);
        const hasUrl = notionUrl.length > 0;
        return hasUrl ? (
          <a
            key={guide.id}
            href={notionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-md ring-1 ring-[#e2e8f0] transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2"
          >
            <div className="relative h-40 w-full overflow-hidden bg-slate-200">
              {guide.cover_image_url || guide.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={guide.cover_image_url || guide.thumbnail_url || ""}
                  alt={guide.title_override || guide.title}
                  className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  loading="lazy"
                />
              ) : null}
            </div>
            {guide.badgeLabels.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-0">
                {guide.badgeLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption text-[var(--text-muted)]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex flex-1 flex-col gap-2 p-4 pt-2">
              <p className="section-label text-content-muted">여행가이드</p>
              <h3 className="font-card-title type-h3 text-content-primary">
                {guide.title_override || guide.title}
              </h3>
              {guide.summary ? (
                <p className="type-caption leading-relaxed text-content-secondary">
                  {guide.summary}
                </p>
              ) : null}
            </div>
          </a>
        ) : (
          <div
            key={guide.id}
            className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-md ring-1 ring-[#e2e8f0] opacity-75"
          >
            <div className="relative h-40 w-full overflow-hidden bg-slate-200">
              {guide.cover_image_url || guide.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={guide.cover_image_url || guide.thumbnail_url || ""}
                  alt={guide.title_override || guide.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </div>
            {guide.badgeLabels.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-0">
                {guide.badgeLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption text-[var(--text-muted)]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex flex-1 flex-col gap-2 p-4 pt-2">
              <p className="section-label text-content-muted">여행가이드</p>
              <h3 className="font-card-title type-h3 text-content-primary">
                {guide.title_override || guide.title}
              </h3>
              {guide.summary ? (
                <p className="type-caption leading-relaxed text-content-secondary">
                  {guide.summary}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">원문 URL이 없습니다.</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### `src/components/guides/GuideCardList.tsx` (전체) — `/blog` 등, PDF/노션/랜딩 분기

```tsx
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Guide } from "@/types/guide";
import { getGuideNotionViewUrl } from "@/lib/guides";
import { GuidePdfModal } from "@/components/guides/GuidePdfModal";

type GuideCardListProps = {
  guides: Guide[];
};

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR");
}

export function GuideCardList({ guides }: GuideCardListProps) {
  const [modalPdfUrl, setModalPdfUrl] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState<string>("");

  const openPdfModal = useCallback((pdfUrl: string, title: string) => {
    setModalPdfUrl(pdfUrl);
    setModalTitle(title);
  }, []);

  const closePdfModal = useCallback(() => {
    setModalPdfUrl(null);
    setModalTitle("");
  }, []);

  if (guides.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 type-small text-content-muted shadow-md ring-1 ring-[#e2e8f0]">
        아직 등록된 여행가이드가 없습니다.{" "}
        <Link
          href="/theall_manager_only/guides"
          className="font-medium text-[var(--primary)] underline hover:text-[var(--primary-hover)]"
        >
          관리자 페이지
        </Link>
        에서 가이드를 등록해 주세요.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {guides.map((guide) => {
          const thumbUrl =
            guide.cover_image_url ??
            guide.thumbnail_url ??
            guide.guide_thumbnail_url ??
            "";
          const pdfUrl = guide.guide_pdf_url ?? "";
          const hasPdf = Boolean(pdfUrl?.trim());
          const hasNotionDetail = Boolean(
            guide.slug?.trim() && guide.notion_page_id?.trim(),
          );
          const hasLanding = Boolean(guide.landing_url?.trim());
          const guideTitle = guide.title_override?.trim() || guide.title;

          const cardContent = (
            <>
              {thumbUrl ? (
                <div className="relative h-40 w-full overflow-hidden">
                  <Image
                    src={thumbUrl}
                    alt={guide.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 30vw"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center bg-[#eff6ff] type-caption text-content-muted">
                  썸네일 이미지 없음
                </div>
              )}
              <div className="flex flex-1 flex-col gap-3 p-5">
                {(guide.category || (guide.tags?.length ?? 0) > 0 || guide.destination_name || guide.theme_name) ? (
                  <div className="flex flex-wrap items-center gap-1.5 section-label text-content-muted">
                    {guide.category ? (
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                        {guide.category}
                      </span>
                    ) : null}
                    {guide.tags?.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption"
                      >
                        {tag}
                      </span>
                    ))}
                    {!guide.category && (guide.tags?.length ?? 0) === 0 && guide.destination_name ? (
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                        {guide.destination_name}
                      </span>
                    ) : null}
                    {!guide.category && (guide.tags?.length ?? 0) === 0 && guide.theme_name ? (
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                        {guide.theme_name}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <p className="section-label uppercase tracking-wide text-[#B8962E]">
                    TRAVEL GUIDE
                  </p>
                  <h2 className="font-card-title line-clamp-2 type-body font-semibold text-content-primary md:type-small">
                    {guideTitle}
                  </h2>
                </div>
                {guide.summary ? (
                  <p className="line-clamp-4 type-small leading-6 text-content-secondary">
                    {guide.summary}
                  </p>
                ) : null}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="type-caption text-content-muted">
                    {formatDate(guide.created_at)}
                  </span>
                </div>
              </div>
            </>
          );

          const cardClass =
            "flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[#e2e8f0] transition hover:-translate-y-1 hover:shadow-lg";

          if (hasPdf) {
            return (
              <article
                key={guide.id}
                role="button"
                tabIndex={0}
                className={`${cardClass} cursor-pointer`}
                onClick={() => openPdfModal(pdfUrl, guideTitle)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPdfModal(pdfUrl, guideTitle);
                  }
                }}
              >
                {cardContent}
              </article>
            );
          }

          if (hasNotionDetail) {
            const notionUrl = getGuideNotionViewUrl(guide);
            return notionUrl ? (
              <a
                key={guide.id}
                href={notionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cardClass}
              >
                {cardContent}
              </a>
            ) : (
              <article key={guide.id} className={cardClass}>
                {cardContent}
              </article>
            );
          }

          if (hasLanding) {
            return (
              <a
                key={guide.id}
                href={guide.landing_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={cardClass}
              >
                {cardContent}
              </a>
            );
          }

          return (
            <article key={guide.id} className={cardClass}>
              {cardContent}
            </article>
          );
        })}
      </div>

      <GuidePdfModal
        isOpen={Boolean(modalPdfUrl)}
        pdfUrl={modalPdfUrl ?? ""}
        title={modalTitle}
        onClose={closePdfModal}
      />
    </>
  );
}
```

### `src/components/guides/GuideCardGrid.tsx` (전체)

```tsx
import type { Guide } from "@/types/guide";
import { GuideCard } from "@/components/guides/GuideCard";

export type GuideCardGridProps = {
  guides: Guide[];
  className?: string;
  gridCols?: "2" | "3" | "4";
};

/** 가이드 카드 그리드. 홈/랜딩/가이드 상세 관련 가이드에서 사용 */
export function GuideCardGrid({
  guides,
  className,
  gridCols = "4",
}: GuideCardGridProps) {
  if (guides.length === 0) return null;
  const gridClass =
    gridCols === "2"
      ? "grid-cols-1 sm:grid-cols-2"
      : gridCols === "3"
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <ul
      className={`grid gap-4 ${gridClass} ${className ?? ""}`.trim()}
      aria-label="여행 가이드"
    >
      {guides.map((guide) => (
        <li key={guide.id} className="flex min-h-0 h-full min-w-0">
          <GuideCard guide={guide} className="w-full" />
        </li>
      ))}
    </ul>
  );
}
```

### `window.open` / 노션 / `target="_blank"` 기타

| 파일 | 내용 |
|------|------|
| `GuideDetailBody.tsx` | `useEffect`에서 `window.open(notionUrl, "_blank", "noopener,noreferrer")`; 하단 `<a target="_blank">`. **다른 파일에서 import 없음.** |
| `GuideNotionModal.tsx` | 툴바에 `target="_blank"` 링크 "새 탭에서 열기" + iframe `src={notionUrl}`. |
| `NotionBlocksRenderer.tsx` | 리치텍스트 링크 `target="_blank" rel="noopener noreferrer"`. |
| `guides/[slug]/page.tsx` | `bodyLinks`의 외부 링크 전부 `target="_blank"`. |

---

## [2] 가이드 데이터 구조 / 타입 / 로더

### `src/types/guide.ts` (전체)

```ts
export type Guide = {
  id: string;
  title: string;
  summary?: string;
  thumbnail_url?: string;
  landing_url?: string;
  guide_pdf_url?: string | null;
  guide_thumbnail_url?: string | null;
  is_published?: boolean;
  sort_order?: number;
  created_at?: string;
  // Notion 연동 필드
  slug?: string | null;
  notion_page_id?: string | null;
  notion_url?: string | null;
  title_override?: string | null;
  cover_image_url?: string | null;
  tags?: string[] | null;
  category?: string | null;
  published_at?: string | null;
  /** 랜딩 연결: destination taxonomy id (product_taxonomies.id, taxonomy_type=destination) */
  destination_id?: string | null;
  /** 랜딩 연결: theme taxonomy id (product_taxonomies.id, taxonomy_type=theme) */
  theme_id?: string | null;
  /** 카드 뱃지용: destination_id로 조회한 지역명. API에서 채움 */
  destination_name?: string | null;
  /** 카드 뱃지용: theme_id로 조회한 테마명. API에서 채움 */
  theme_name?: string | null;
  notion_last_edited_time?: string | null;
  last_synced_at?: string | null;
  // SEO 필드
  seo_title?: string | null;
  seo_description?: string | null;
  focus_keyword?: string | null;
};
```

### `src/lib/guides.ts` (전체)

```ts
import { supabase } from "@/lib/supabase";
import type { Guide } from "@/types/guide";
import { unstable_cache } from "next/cache";
import { getTaxonomyById } from "@/lib/productTaxonomies";

function safeUuidOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = typeof value === "string" ? value.trim() : String(value).trim();
  return s === "" ? null : s;
}

function normalizeGuide(row: Record<string, unknown>): Guide {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    summary: typeof row.summary === "string" ? row.summary : undefined,
    thumbnail_url: typeof row.thumbnail_url === "string" ? row.thumbnail_url : undefined,
    landing_url: typeof row.landing_url === "string" ? row.landing_url : undefined,
    guide_pdf_url: typeof row.guide_pdf_url === "string" ? row.guide_pdf_url : undefined,
    guide_thumbnail_url: typeof row.guide_thumbnail_url === "string" ? row.guide_thumbnail_url : undefined,
    is_published: typeof row.is_published === "boolean" ? row.is_published : undefined,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : undefined,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    slug: typeof (row as any).slug === "string" ? ((row as any).slug as string) : null,
    notion_page_id:
      typeof (row as any).notion_page_id === "string" ? ((row as any).notion_page_id as string) : null,
    notion_url: typeof (row as any).notion_url === "string" ? ((row as any).notion_url as string) : null,
    title_override:
      typeof (row as any).title_override === "string" ? ((row as any).title_override as string) : null,
    cover_image_url:
      typeof (row as any).cover_image_url === "string" ? ((row as any).cover_image_url as string) : null,
    tags: Array.isArray((row as any).tags) ? (((row as any).tags as string[]) ?? null) : null,
    category: typeof (row as any).category === "string" ? ((row as any).category as string) : null,
    published_at:
      typeof (row as any).published_at === "string" ? ((row as any).published_at as string) : null,
    destination_id: safeUuidOrNull((row as any).destination_id),
    theme_id: safeUuidOrNull((row as any).theme_id),
    destination_name: typeof (row as any).destination_name === "string" ? ((row as any).destination_name as string) : null,
    theme_name: typeof (row as any).theme_name === "string" ? ((row as any).theme_name as string) : null,
    notion_last_edited_time:
      typeof (row as any).notion_last_edited_time === "string"
        ? ((row as any).notion_last_edited_time as string)
        : null,
    last_synced_at:
      typeof (row as any).last_synced_at === "string" ? ((row as any).last_synced_at as string) : null,
    seo_title: typeof (row as any).seo_title === "string" ? ((row as any).seo_title as string) : null,
    seo_description:
      typeof (row as any).seo_description === "string" ? ((row as any).seo_description as string) : null,
    focus_keyword:
      typeof (row as any).focus_keyword === "string" ? ((row as any).focus_keyword as string) : null,
  };
}

// 유저 여행가이드(/blog) 통합 목록: PDF/Notion 모두 노출. limit 있으면 해당 건수만.
// 정렬: sort_order asc → published_at desc → created_at desc
export async function getPublishedGuides(limit?: number): Promise<Guide[]> {
  let query = supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });
  if (typeof limit === "number" && limit > 0) {
    query = query.limit(limit);
  }
  const { data, error } = await query;

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}

/** 홈 페이지용: 발행 가이드 최대 limit건 + destination_id/theme_id에 대해 지역·테마명 채움 (카드 뱃지용). */
export async function getHomeGuidesWithTaxonomyNames(limit = 4): Promise<Guide[]> {
  return getPublishedGuidesWithTaxonomyNames(limit);
}

/** 발행 가이드 조회 + destination_id/theme_id에 대해 지역·테마명 채움 (카드 뱃지용). limit 없으면 전체. */
export async function getPublishedGuidesWithTaxonomyNames(limit?: number): Promise<Guide[]> {
  const guides = await getPublishedGuides(limit);
  const destIds = [...new Set(guides.map((g) => g.destination_id).filter(Boolean))] as string[];
  const themeIds = [...new Set(guides.map((g) => g.theme_id).filter(Boolean))] as string[];
  const [destMap, themeMap] = await Promise.all([
    Promise.all(destIds.map((id) => getTaxonomyById(id))).then((list) =>
      new Map(list.map((t, i) => [destIds[i], t?.name ?? null])),
    ),
    Promise.all(themeIds.map((id) => getTaxonomyById(id))).then((list) =>
      new Map(list.map((t, i) => [themeIds[i], t?.name ?? null])),
    ),
  ]);
  return guides.map((g) => ({
    ...g,
    destination_name: g.destination_id ? (destMap.get(g.destination_id) ?? null) : null,
    theme_name: g.theme_id ? (themeMap.get(g.theme_id) ?? null) : null,
  }));
}

/** 홈 페이지용: 발행된 가이드 최대 4건. published_at 우선 정렬, 없으면 created_at. */
export async function getHomeGuides(limit = 4): Promise<Guide[]> {
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}

/** destination 랜딩용: 해당 destination_id로 연결된 발행 가이드. sort_order asc → published_at desc → created_at desc. */
export async function getGuidesByDestinationId(
  destinationId: string,
  limit = 4,
): Promise<Guide[]> {
  const id = destinationId?.trim();
  if (!id) return [];
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .eq("destination_id", id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}

/** theme 랜딩용: 해당 theme_id로 연결된 발행 가이드. sort_order asc → published_at desc → created_at desc. */
export async function getGuidesByThemeId(themeId: string, limit = 4): Promise<Guide[]> {
  const id = themeId?.trim();
  if (!id) return [];
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .eq("theme_id", id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}

/** slug로 공개 가이드 1건 조회. is_published = true. */
export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  const s = slug?.trim();
  if (!s) return null;
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .eq("slug", s)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeGuide(data as Record<string, unknown>);
}

/** 가이드 상세용: 동일 destination_id 또는 theme_id로 연결된 다른 가이드. 현재 가이드 제외, limit 기본 4. */
export async function getRelatedGuidesByGuide(
  guide: Guide,
  limit = 4,
): Promise<Guide[]> {
  const destinationId = guide.destination_id?.trim() || null;
  const themeId = guide.theme_id?.trim() || null;
  const excludeId = guide.id;

  if (!destinationId && !themeId) {
    return getPublishedGuides(limit + 1).then((list) =>
      list.filter((g) => g.id !== excludeId).slice(0, limit),
    );
  }

  const orConditions: string[] = [];
  if (destinationId) orConditions.push(`destination_id.eq.${destinationId}`);
  if (themeId) orConditions.push(`theme_id.eq.${themeId}`);

  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .neq("id", excludeId)
    .or(orConditions.join(","))
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}

/**
 * 노션 원문 URL. notion_url 우선, 없으면 notion_page_id로 https://notion.so/{hex} 생성.
 * /guides 목록·홈 가이드 섹션 등 외부 노션 열기에 공통 사용.
 */
export function getGuideNotionViewUrl(guide: Guide): string {
  const url = guide.notion_url?.trim();
  if (url) return url;
  const pageId = guide.notion_page_id?.trim();
  if (pageId) {
    const hex = pageId.replace(/-/g, "");
    return `https://notion.so/${hex}`;
  }
  return "";
}

/** 가이드 카드/상세 링크. slug 있으면 /guides/[slug] 우선, 없으면 landing_url, 없으면 /guides */
export function getGuideHref(guide: Guide): string {
  if (guide.slug?.trim()) return `/guides/${encodeURIComponent(guide.slug.trim())}`;
  if (guide.landing_url?.trim()) return guide.landing_url.trim();
  return "/guides";
}

// Notion 기반 상세 페이지(/guides)용: slug와 notion_page_id가 있는 가이드만
export async function getPublishedNotionGuides(): Promise<Guide[]> {
  return unstable_cache(
    async () => {
      const { data, error } = await supabase
        .from("guides")
        .select("*")
        .eq("is_published", true)
        .not("slug", "is", null)
        .not("notion_page_id", "is", null)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false });

      if (error) {
        return [];
      }
      return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
    },
    ["guides-notion-list"],
    {
      revalidate: 60 * 60 * 3,
      tags: ["guides:list"],
    },
  )();
}

/** /guides 목록 검색: q가 있으면 title, summary ilike 검색. 없으면 getPublishedNotionGuides()와 동일 조건. */
export async function getPublishedNotionGuidesWithSearch(q?: string | null): Promise<Guide[]> {
  const term = q?.trim();
  if (!term) return getPublishedNotionGuides();

  const pattern = `%${term}%`;
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .not("slug", "is", null)
    .not("notion_page_id", "is", null)
    .or(`title.ilike.${pattern},summary.ilike.${pattern}`)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) return [];
  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}
```

### `src/lib/productTaxonomies.ts` — `buildGuideBadgeLabels` (발췌)

```ts
/**
 * 가이드 카드 뱃지용: destination 계층명 + theme명 + 태그를 합친 라벨 배열.
 * idToTaxonomy는 getActiveTaxonomiesForHeader() 등으로 조회한 뒤 destination/theme만 필터해 맵으로 전달.
 */
export function buildGuideBadgeLabels(
  guide: { destination_id?: string | null; theme_id?: string | null; tags?: string[] | null },
  idToTaxonomy: Map<string, ProductTaxonomy>,
): string[] {
  const labels: string[] = [];
  const destChain = buildDestinationNameChain(guide.destination_id, idToTaxonomy);
  labels.push(...destChain);
  const themeId = guide.theme_id?.trim();
  if (themeId) {
    const theme = idToTaxonomy.get(themeId);
    if (theme?.name) labels.push(theme.name);
  }
  if (Array.isArray(guide.tags)) {
    for (const t of guide.tags) {
      if (typeof t === "string" && t.trim()) labels.push(t.trim());
    }
  }
  return labels;
}
```

### `src/lib/products.ts` — `getProductsForGuide` (발췌)

```ts
/** 가이드 상세용: guide의 destination_id / theme_id 기준 관련 상품. destination 우선, theme 보조, 최대 limit(기본 6). */
export async function getProductsForGuide(
  guide: { destination_id?: string | null; theme_id?: string | null },
  limit = 6,
): Promise<Product[]> {
  const products = await getProducts();
  if (products.length === 0) return [];

  const destinationId = guide.destination_id?.trim() || null;
  const themeId = guide.theme_id?.trim() || null;

  const byDestination =
    destinationId != null
      ? products.filter((p) => p.destination_id === destinationId)
      : [];
  let byTheme: Product[] = [];
  if (themeId) {
    const themeTax = await getTaxonomyById(themeId);
    const themeNameLower = themeTax?.name?.trim().toLowerCase();
    if (themeNameLower) {
      byTheme = products.filter((p) => {
        const tokens = parseThemeTokens(p.theme).map((t) => t.toLowerCase());
        return tokens.some(
          (t) =>
            t === themeNameLower ||
            t.includes(themeNameLower) ||
            themeNameLower.includes(t),
        );
      });
    }
  }

  const seen = new Set<string>();
  const merged: Product[] = [];
  for (const p of byDestination) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      merged.push(p);
    }
  }
  for (const p of byTheme) {
    if (!seen.has(p.id) && merged.length < limit) {
      seen.add(p.id);
      merged.push(p);
    }
  }
  return merged.slice(0, limit);
}
```

### `src/app/api/guides/route.ts` (전체)

```ts
import { NextResponse } from "next/server";
import { getPublishedGuides } from "@/lib/guides";

export async function GET() {
  const guides = await getPublishedGuides();
  return NextResponse.json(guides);
}
```

---

## [3] 가이드 목록 페이지 / 섹션 렌더링

### `src/app/guides/page.tsx` (전체)

```tsx
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { GuidesListClient } from "@/components/guides/GuidesListClient";
import { GuideSearchBar } from "@/components/guides/GuideSearchBar";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { getPublishedNotionGuidesWithSearch } from "@/lib/guides";
import { getActiveTaxonomiesForHeader, buildGuideBadgeLabels } from "@/lib/productTaxonomies";

export const revalidate = 300;

type Props = { searchParams?: Promise<{ q?: string }> };

export default async function GuidesIndexPage({ searchParams }: Props) {
  const params = await searchParams ?? {};
  const q = typeof params.q === "string" ? params.q : undefined;
  const guides = await getPublishedNotionGuidesWithSearch(q);

  const taxonomies = await getActiveTaxonomiesForHeader();
  const idToTaxonomy = new Map(taxonomies.map((t) => [t.id, t]));

  const guidesWithBadges = guides.map((guide) => ({
    ...guide,
    badgeLabels: buildGuideBadgeLabels(guide, idToTaxonomy),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="blog" />

      <SectionBody className="flex flex-col gap-[var(--space-5)] max-w-6xl">
        <PageHero
          kicker="THEALL TOUR GUIDE"
          title="여행가이드"
          subtitle="지역별 골프장 정보, 시즌별 추천 코스, 출발 전 꼭 알아두면 좋은 팁들을 정리한 가이드입니다. 카드를 클릭하면 원문(노션)을 바로 확인할 수 있습니다."
          size="sm"
        />
        <Breadcrumb items={[{ label: "홈", href: "/" }, { label: "여행가이드" }]} />

        <section className="space-y-4">
          <GuideSearchBar />
          <GuidesListClient guides={guidesWithBadges} />
        </section>
      </SectionBody>
    </div>
  );
}
```

### `src/app/blog/page.tsx` (전체) — 통합 가이드 목록 + `GuideCardList`

```tsx
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { getPublishedGuidesWithTaxonomyNames } from "@/lib/guides";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { GuideCardList } from "@/components/guides/GuideCardList";

export default async function BlogPage() {
  const guides = await getPublishedGuidesWithTaxonomyNames();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="blog" />

      <SectionBody className="flex flex-col gap-[var(--space-5)] max-w-6xl">
        <PageHero
          kicker="THEALL TOUR GUIDE"
          title="여행가이드"
          subtitle="지역별 골프장 정보, 시즌별 추천 코스, 출발 전 꼭 알아두면 좋은 팁들을 정리한 가이드입니다. 카드 유형에 따라 PDF 바로보기 또는 상세 가이드 페이지로 이동합니다."
          size="sm"
        />

        <section className="space-y-4">
          <GuideCardList guides={guides} />
        </section>
      </SectionBody>
    </div>
  );
}
```

### `src/app/page.tsx` — 홈에서 가이드 섹션 (발췌)

```tsx
import { getHomeGuidesWithTaxonomyNames } from "@/lib/guides";
// ...
import { HomeGuideSection } from "@/components/home/HomeGuideSection";

export default async function Home() {
  const [/* ... */, homeGuides, /* ... */] = await Promise.all([
    // ...
    getHomeGuidesWithTaxonomyNames(4),
    // ...
  ]);

  return (
    <>
      {/* ... */}
      <HomeGuideSection guides={homeGuides} />
      {/* ... */}
    </>
  );
}
```

### `src/components/home/HomeGuideSection.tsx` (전체)

```tsx
"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { SectionBlock } from "@/components/layout/SectionBlock";
import {
  SectionHeader,
  SECTION_HEADER_MOBILE_CTA_CLASS,
  HOME_MAIN_SECTION_BLOCK_CLASS,
} from "@/components/layout/SectionHeader";
import { GuideCard } from "@/components/guides/GuideCard";
import type { Guide } from "@/types/guide";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** 카드 폭(sm 기준 260px) + gap(12px)에 맞춘 스크롤 스텝 */
const SCROLL_AMOUNT = 280;

export type HomeGuideSectionProps = {
  guides: Guide[];
  className?: string;
};

/**
 * 홈 여행 가이드 섹션. 여행 준비에 도움이 되는 가이드 + 카드.
 * 지역·테마 섹션과 동일하게 가로 스크롤 레이아웃.
 */
export function HomeGuideSection({ guides, className }: HomeGuideSectionProps) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT, behavior: "smooth" });
  };

  if (guides.length === 0) return null;

  return (
    <SectionBlock
      surface="none"
      padding="md"
      className={cn("space-y-2 sm:space-y-4 !p-3 sm:!p-6 md:!p-8", className)}
    >
      <SectionHeader
        title="여행 준비에 도움이 되는 가이드"
        description="지역별·테마별 꿀팁과 가이드를 만나보세요."
        action={
          <Link
            href="/guides"
            className={SECTION_HEADER_MOBILE_CTA_CLASS}
            aria-label="여행 가이드 더보기"
          >
            더보기
            <span aria-hidden>→</span>
          </Link>
        }
        align="left"
      />
      <div className="relative group/scroll">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="왼쪽으로 스크롤"
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-soft)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition opacity-90 hover:opacity-100 -translate-x-1 sm:translate-x-0"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="오른쪽으로 스크롤"
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-soft)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition opacity-90 hover:opacity-100 translate-x-1 sm:translate-x-0"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden />
          </button>
        )}
        <ul
          ref={scrollRef}
          className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
          aria-label="여행 가이드"
        >
          {guides.map((guide) => (
            <li
              key={guide.id}
              className="flex w-[58%] max-w-[300px] shrink-0 self-stretch sm:w-[260px] sm:max-w-none md:w-[272px]"
            >
              <GuideCard guide={guide} linkBehavior="notion_external" className="w-full min-w-0" />
            </li>
          ))}
        </ul>
      </div>
    </SectionBlock>
  );
}
```

### 랜딩: `destinations/[slug]/page.tsx` — 가이드 그리드 + 사이드 필터 맥락 (발췌)

```tsx
import { GuideCardGrid } from "@/components/guides/GuideCardGrid";
import { HubFilterSidebar } from "@/components/hub/HubFilterSidebar";
import { getGuidesByDestinationId } from "@/lib/guides";
// ...
const [taxonomyOptions, hubThemes, destinationGuides, /* ... */] = await Promise.all([
  getProductTaxonomyOptions(products),
  getHubThemes(),
  getGuidesByDestinationId(destination.id, 4),
  // ...
]);

{destinationGuides.length > 0 ? (
  <SectionBlock surface="none" padding="md">
    <SectionHeader eyebrow="TRAVEL GUIDE" title={`${destination.name} 여행 가이드`} /* ... */ />
    <div className="mt-6">
      <GuideCardGrid guides={destinationGuides} />
    </div>
    <div className="mt-4">
      <Link href="/guides" className="type-btn ...">가이드 더 보기</Link>
    </div>
  </SectionBlock>
) : null}
```

### 랜딩: `themes/[slug]/page.tsx` — 동일 패턴 (`getGuidesByThemeId`, `GuideCardGrid`)

### 상품 상세: `products/[id]/page.tsx` — 관련 가이드 (발췌)

```tsx
import { GuideCard } from "@/components/guides/GuideCard";
import { getGuidesByDestinationId } from "@/lib/guides";

const [relatedGuides, allProducts] = await Promise.all([
  product.destination_id?.trim()
    ? getGuidesByDestinationId(product.destination_id.trim(), 3)
    : Promise.resolve([]),
  getProducts(),
]);

{relatedGuides.length > 0 ? (
  <SectionBlock surface="none" padding="md">
    <SectionHeader eyebrow="TRAVEL GUIDE" title="이 여행을 더 잘 즐기는 방법" /* ... */ />
    <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="관련 가이드">
      {relatedGuides.map((guide) => (
        <li key={guide.id} className="flex min-h-0 h-full min-w-0">
          <GuideCard guide={guide} className="w-full" />
        </li>
      ))}
    </ul>
    <Link href="/guides">가이드 더 보기</Link>
  </SectionBlock>
) : null}
```

---

## [4] 추천상품 / 카탈로그 / 필터 패턴

### `src/components/products/RelatedProductsSection.tsx` (전체)

```tsx
"use client";

import type { Product } from "@/types/product";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";

export type RelatedProductsSectionProps = {
  title?: string;
  description?: string;
  products?: Product[];
};

const DEFAULT_TITLE = "이 상품과 비슷한 여행";
const DEFAULT_DESCRIPTION = "여행지, 테마, 상품 구성이 비슷한 상품을 모아봤어요.";

export default function RelatedProductsSection({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  products = [],
}: RelatedProductsSectionProps) {
  const list = Array.isArray(products) ? products : [];
  if (!list.length) return null;

  return (
    <section className="mt-8 w-full px-4 md:px-0" aria-labelledby="related-products-section-heading">
      <div className="space-y-1 mb-4">
        <h2 id="related-products-section-heading" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        {description?.trim() && <p className="text-sm text-slate-500">{description}</p>}
      </div>

      <ProductCardGridSection>
        {list.map((product) => (
          <ProductCard
            key={product.id}
            {...productToProductCardProps(product, {
              layout: "grid",
              analyticsSource: "product_list",
              analyticsSection: "related_products",
            })}
          />
        ))}
      </ProductCardGridSection>
    </section>
  );
}
```

### `src/components/product-detail/ProductCatalogSection.tsx`

- **클라이언트 컴포넌트**: `useState`로 `internalTab`, `internalThemeTab`; URL 제어 시 `onCategoryChange` / `onThemeChange` / `initialRegion` / `initialTheme`.
- **칩 UI**: `categoryTabs` / `themeTabs` map + `onClick`에서 탭 전환.
- 일부 주석/문자열이 저장소에서 깨져 `??`로 보일 수 있음 — **원본 파일 기준으로 작업**.

전체는 **303줄** — `src/components/product-detail/ProductCatalogSection.tsx` 파일 직접 참조.

### `src/components/products/ProductCard.tsx`

- **전체 약 466줄** — `layout: "grid" | "list" | "related" | "stack"`, `hrefDetail` 있으면 `<Link>`, 없으면 `onClickDetail` 카드.
- **전문**: 저장소 `src/components/products/ProductCard.tsx` (이 문서에는 중복 생략, PR 작성 시 해당 파일 단일 소스로 사용).

---

## [5] 페이지 내 state / 서버·클라이언트 경계

| 위치 | 패턴 |
|------|------|
| `guides/page.tsx` | **서버 컴포넌트** — 데이터 전부 서버 fetch 후 `GuidesListClient`에 전달. 선택된 가이드 state 없음. |
| `GuidesListClient` | 클라이언트이나 **상태 없음** — 정적 그리드 + 외부 링크만. |
| `GuideSearchBar` | `useState` + `router.push(/guides?q=...)` — 검색어만 URL 연동. |
| `GuideCardList` | PDF 모달용 `useState(modalPdfUrl, modalTitle)`. |
| `HomeGuideSection` | 가로 스크롤 버튼용 `useState` / `useRef`만. |
| `guides/[slug]/page.tsx` | **전부 서버** — `relatedProducts` / `relatedGuides`는 서버에서 계산. |
| `ProductCatalogSection` | 지역/테마 탭 + 키워드 필터 — **선택 상태에 따라 목록 변경** 패턴의 참고 구현. |

**`selectedGuide` / `activeGuide` / `recommendedProducts` state**를 쓰는 공개 가이드 페이지는 **현재 없음** (상세는 서버 데이터).

### `src/components/guides/GuideSearchBar.tsx` (전체)

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { Search } from "lucide-react";

const PLACEHOLDER = "가이드를 검색해보세요";

export function GuideSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [value, setValue] = useState(q);

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const term = value.trim();
      const next = new URLSearchParams(searchParams.toString());
      if (term) next.set("q", term);
      else next.delete("q");
      router.push(`/guides?${next.toString()}`);
    },
    [value, router, searchParams],
  );

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]"
          aria-hidden
        />
        <input
          type="text"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={PLACEHOLDER}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 pl-11 text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
          aria-label={PLACEHOLDER}
        />
      </div>
    </form>
  );
}
```

---

## [6] 가이드 상세 페이지

### `src/app/guides/[slug]/page.tsx` (전체)

> **이전/다음 가이드 계산 로직 없음.** 관련 상품·관련 가이드·destination/theme 링크만 서버에서 조회.

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { getGuideBySlug, getRelatedGuidesByGuide } from "@/lib/guides";
import { getProductsForGuide } from "@/lib/products";
import { getTaxonomyById } from "@/lib/productTaxonomies";
import { getDestinationLandingHref, getThemeLandingHref } from "@/lib/hubLandingLinks";
import { GuideCardGrid } from "@/components/guides/GuideCardGrid";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");

function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${p}`;
}

type Props = { params: Promise<{ slug: string }> };

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
  const seoTitle = `${title} (2026 최신) | 더올투어`;
  const seoDescription = `${title}에 대한 최신 정보, 비용, 추천 코스를 정리했습니다.`;

  return {
    title: seoTitle,
    description: seoDescription,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      siteName: "더올투어",
      title: seoTitle,
      description: seoDescription,
      images: ogImage ? [{ url: toAbsoluteUrl(ogImage) }] : [],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: seoTitle,
      description: seoDescription,
      images: ogImage ? [toAbsoluteUrl(ogImage)] : [],
    },
  };
}

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) notFound();

  const [relatedProducts, relatedGuides, destinationTax, themeTax] = await Promise.all([
    getProductsForGuide(guide, 6),
    getRelatedGuidesByGuide(guide, 4),
    guide.destination_id ? getTaxonomyById(guide.destination_id) : null,
    guide.theme_id ? getTaxonomyById(guide.theme_id) : null,
  ]);

  const displayTitle = guide.title_override?.trim() || guide.title;
  const coverUrl =
    guide.cover_image_url?.trim() ||
    guide.guide_thumbnail_url?.trim() ||
    guide.thumbnail_url?.trim() ||
    "";

  const bodyLinks: { label: string; href: string }[] = [];
  if (guide.landing_url?.trim()) bodyLinks.push({ label: "상세 보기", href: guide.landing_url.trim() });
  if (guide.notion_url?.trim()) bodyLinks.push({ label: "노션에서 보기", href: guide.notion_url.trim() });
  if (guide.guide_pdf_url?.trim()) bodyLinks.push({ label: "PDF 다운로드", href: guide.guide_pdf_url.trim() });

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-8">
          {/* Hero / 상단 비주얼 */}
          <section className="overflow-hidden rounded-2xl sm:rounded-3xl bg-[var(--surface-muted)]">
            {coverUrl ? (
              <div className="relative aspect-[21/9] w-full">
                <Image
                  src={coverUrl}
                  alt=""
                  fill
                  sizes="100vw"
                  priority
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 text-white">
                  <h1 className="heading-display type-h2 font-semibold text-white drop-shadow-md md:type-h1">
                    {`${displayTitle} 여행 가이드`}
                  </h1>
                  {guide.published_at ? (
                    <p className="mt-2 type-caption text-white/90">
                      {new Date(guide.published_at).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex flex-col justify-end p-5 sm:p-8 min-h-[200px]">
                <h1 className="heading-display type-h2 font-semibold text-[var(--foreground)] md:type-h1">
                  {`${displayTitle} 여행 가이드`}
                </h1>
                {guide.published_at ? (
                  <p className="mt-2 type-caption text-[var(--text-muted)]">
                    {new Date(guide.published_at).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                ) : null}
              </div>
            )}
          </section>

          {/* 요약 + 태그/카테고리 */}
          <SectionBlock surface="none" padding="md">
            {guide.summary ? (
              <p className="type-body text-[var(--foreground)] leading-relaxed">
                {guide.summary}
              </p>
            ) : null}
            {(guide.tags?.length ?? 0) > 0 || guide.category ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {guide.category ? (
                  <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 type-caption font-medium text-[var(--foreground)] ring-1 ring-[var(--border)]">
                    {guide.category}
                  </span>
                ) : null}
                {guide.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[var(--surface-muted)] px-3 py-1 type-caption text-[var(--text-muted)] ring-1 ring-[var(--border)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {bodyLinks.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {bodyLinks.map(({ label, href }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                  >
                    {label}
                  </a>
                ))}
              </div>
            ) : null}
          </SectionBlock>

          {/* 관련 destination / theme 링크 */}
          {(destinationTax || themeTax) ? (
            <SectionBlock surface="muted" padding="md">
              <SectionHeader
                title="이 가이드와 관련된 탐색"
                align="left"
              />
              <ul className="mt-4 flex flex-wrap gap-3">
                {destinationTax ? (
                  <li>
                    <Link
                      href={getDestinationLandingHref(destinationTax)}
                      className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                    >
                      {destinationTax.name} 여행 보기
                    </Link>
                  </li>
                ) : null}
                {themeTax ? (
                  <li>
                    <Link
                      href={getThemeLandingHref(themeTax)}
                      className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                    >
                      {themeTax.name} 테마 보기
                    </Link>
                  </li>
                ) : null}
              </ul>
            </SectionBlock>
          ) : null}

          {/* 관련 상품 */}
          {relatedProducts.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                eyebrow="RELATED PRODUCTS"
                title="이 가이드와 함께 보면 좋은 여행"
                description="연결된 지역·테마의 추천 상품입니다."
                align="left"
              />
              <ProductCardGridSection>
                {relatedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    {...productToProductCardProps(product, {
                      layout: "grid",
                      analyticsSource: "home_curated",
                      analyticsSection: `guide_${slug}`,
                    })}
                  />
                ))}
              </ProductCardGridSection>
              <div className="mt-4">
                <Link
                  href="/products"
                  className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                >
                  전체 상품 보기
                </Link>
              </div>
            </SectionBlock>
          ) : null}

          {/* 관련 가이드 */}
          {relatedGuides.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                eyebrow="TRAVEL GUIDE"
                title="함께 보면 좋은 가이드"
                align="left"
              />
              <div className="mt-6">
                <GuideCardGrid guides={relatedGuides} gridCols="4" />
              </div>
              <div className="mt-4">
                <Link
                  href="/guides"
                  className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                >
                  가이드 전체 보기
                </Link>
              </div>
            </SectionBlock>
          ) : null}
        </PageContainer>
      </main>
    </div>
  );
}
```

### `src/app/guides/[slug]/loading.tsx` (전체)

```tsx
import { PageContainer } from "@/components/layout/PageContainer";

export default function GuideDetailLoading() {
  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)]">
      <div className="h-14 shrink-0 bg-[var(--surface)]" />
      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-8">
          <div className="h-[280px] animate-pulse rounded-2xl bg-[var(--surface-muted)] sm:rounded-3xl" />
          <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
              />
            ))}
          </div>
        </PageContainer>
      </main>
    </div>
  );
}
```

### `src/app/guides/[slug]/not-found.tsx` (전체)

```tsx
import Link from "next/link";
import { cn } from "@/lib/cn";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";

export default function GuideNotFound() {
  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />
      <main className="flex w-full flex-col items-center justify-center py-20">
        <PageContainer size="default" className="text-center">
          <h1 className="type-h2 font-semibold text-[var(--foreground)]">
            가이드를 찾을 수 없습니다
          </h1>
          <p className="mt-2 type-body text-[var(--text-muted)]">
            요청하신 여행 가이드가 없거나 비공개 상태입니다.
          </p>
          <Link
            href="/guides"
            className={cn(
              "mt-6 inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--primary)] px-5 py-2.5 font-semibold text-[var(--on-primary)] transition hover:opacity-90",
              solidButtonShadowClasses,
            )}
          >
            가이드 목록으로
          </Link>
        </PageContainer>
      </main>
    </div>
  );
}
```

### `src/components/guides/GuideDetailBody.tsx` (전체) — **현재 라우트에서 미사용**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import type { GuideTocItem } from "@/lib/notion/types";

type GuideDetailBodyProps = {
  excerptText: string;
  toc: GuideTocItem[];
  notionUrl: string | undefined;
  title: string;
  /** /guides/[slug] 직접 진입 시 원문을 새 탭에서 자동 오픈 */
  autoOpenModalOnMount?: boolean;
};

export function GuideDetailBody({
  excerptText,
  toc,
  notionUrl,
  title,
  autoOpenModalOnMount = false,
}: GuideDetailBodyProps) {
  const hasExcerpt = excerptText?.trim().length > 0;
  const hasToc = Array.isArray(toc) && toc.length > 0;
  const hasNotionUrl = Boolean(notionUrl?.trim());
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (!hasNotionUrl || !autoOpenModalOnMount || !notionUrl?.trim() || hasOpenedRef.current) return;
    hasOpenedRef.current = true;
    window.open(notionUrl.trim(), "_blank", "noopener,noreferrer");
  }, [hasNotionUrl, autoOpenModalOnMount, notionUrl]);

  return (
    <section className="space-y-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] md:p-8">
      {hasToc ? (
        <nav
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3"
          aria-label="목차"
        >
          <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">목차</h2>
          <ul className="space-y-1.5 text-sm">
            {toc.map((item) => (
              <li
                key={item.id}
                className={item.level === 3 ? "pl-4" : ""}
                style={{ listStyle: "none" }}
              >
                <a
                  href={`#${item.id}`}
                  className="link-primary underline-offset-2 hover:underline"
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {hasExcerpt ? (
        <div className="prose prose-slate max-w-none text-[var(--text-secondary)]">
          <div className="whitespace-pre-line leading-relaxed">{excerptText}</div>
        </div>
      ) : null}

      {hasNotionUrl ? (
        <div className="border-t border-[var(--divider)] pt-6">
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            원문은 노션에서 작성되었으며, 아래 버튼으로 전체 문서를 새 탭에서 볼 수 있습니다.
          </p>
          <a
            href={notionUrl!}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${title} 원문 새 탭에서 보기`}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            원문 보기 (새 탭)
          </a>
        </div>
      ) : null}
    </section>
  );
}
```

---

## 실제 수정 진입점 (우선순위)

1. **`src/app/guides/page.tsx` + `src/components/guides/GuidesListClient.tsx`**  
   - 목록이 **전부 새 탭 노션**이라, “같은 URL에서 선택 가이드에 맞춰 우측/하단 패널 갱신”을 넣으려면 **레이아웃을 쪼개고 클라이언트 state 또는 URL(searchParams slug) 연동**이 첫 관문.

2. **`src/lib/guides.ts`**  
   - 이전/다음 가이드, 선택 가이드 기준 메타데이터, 클라이언트에서 쓸 수 있게 **목록+인덱스 API** 또는 **단일 엔드포인트** 추가 시 여기 또는 `src/app/api/guides/...` 확장.

3. **`src/app/guides/[slug]/page.tsx` (또는 이를 감싸는 새 클라이언트 셸)**  
   - 이미 “가이드 1건 + 관련 상품 + 관련 가이드 + taxonomy 링크” 패턴이 구현되어 있어, **동일 UI를 `/guides` 단일 페이지에 임베드**할 때 재사용·추출하기 좋음.

보조: `GuideCard.tsx` (클릭 시 `preventDefault` + `window.open` + 부모 콜백), `getGuideNotionViewUrl`, `HomeGuideSection` / `GuideCardGrid` / `GuideCardList` 동기화.
