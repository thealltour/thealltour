# 리뷰/마이페이지/상담신청/상품상세/스토리지 구조 발췌

아래는 수정 판단이 가능하도록 관련 함수가 포함된 충분한 범위로 발췌한 내용입니다.

---

## 1. 마이페이지 리뷰 관리 페이지

### 1-1. 리뷰 관리 목록을 렌더링하는 페이지 (더미 데이터 + 상세보기 준비중 버튼)

**파일:** `src/app/mypage/reviews/page.tsx`

```tsx
import MyPageLayout from "@/components/mypage/MyPageLayout";

const MOCK_REVIEWS = Array.from({ length: 10 }).map((_, index) => ({
  id: `review-${index + 1}`,
  title: `내 리뷰 제목 ${index + 1}`,
  productName: `여행 상품 ${index + 1}`,
  createdAt: `2026-02-${String((index % 9) + 1).padStart(2, "0")}`,
}));

export default function MyPageReviewsPage() {
  return (
    <MyPageLayout title="리뷰 관리" description="내가 작성한 리뷰를 확인할 수 있습니다.">
      <section className="space-y-2">
        {MOCK_REVIEWS.map((review) => (
          <article key={review.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{review.title}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{review.productName}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">작성일 {review.createdAt}</p>
            <button type="button" className="mt-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
              상세보기 (준비중)
            </button>
          </article>
        ))}
      </section>
    </MyPageLayout>
  );
}
```

- **더미 데이터:** `MOCK_REVIEWS` — `id`, `title`, `productName`, `createdAt` 형태로 10개 생성.
- **상세보기 (준비중) 버튼:** 각 카드 내 `<button type="button">상세보기 (준비중)</button>`, 현재 클릭 핸들러 없음.

---

## 2. 여행후기 작성 페이지

### 2-1. 후기 작성 폼 페이지

**파일:** `src/app/reviews/write/page.tsx`

```tsx
import SiteHeader from "@/components/SiteHeader";
import ReviewWriteForm from "@/components/ReviewWriteForm";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { ContentCard } from "@/components/layout/ContentCard";

export default function ReviewWritePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="reviews" />
      <SectionBody className="flex flex-col gap-[var(--space-5)]">
        <PageHero
          kicker="THEALL TOUR REVIEWS"
          title="여행후기 작성"
          subtitle="실제 여행 경험을 남겨주시면 더올투어를 찾는 분들께 큰 도움이 됩니다."
        />
        <ContentCard>
          <ReviewWriteForm />
        </ContentCard>
      </SectionBody>
    </div>
  );
}
```

### 2-2. 후기 작성 폼 컴포넌트 전체 (제목/내용/별점/이미지/등록 버튼·submit)

**파일:** `src/components/ReviewWriteForm.tsx`

```tsx
"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { uploadReviewImage } from "@/lib/reviewImageUpload";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Button, buttonVariants } from "@/components/ui/Button";

const MAX_REVIEW_IMAGES = 4;

export default function ReviewWriteForm() {
  const router = useRouter();
  const imageInputId = useId();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      for (const previewUrl of imagePreviewUrls) {
        if (previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      }
    };
  }, [imagePreviewUrls]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const imageUrls =
        imageFiles.length > 0 ? await Promise.all(imageFiles.map((file) => uploadReviewImage(file))) : [];

      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, image_urls: imageUrls, rating }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "후기 등록에 실패했습니다.");
        return;
      }

      router.push("/reviews");
      router.refresh();
    } catch {
      setErrorMessage("후기 등록 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Label className="flex flex-col gap-2 text-content-secondary">
        제목
        <Input
          type="text"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Label>
      <Label className="flex flex-col gap-2 text-content-secondary">
        내용
        <Textarea
          required
          rows={8}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
      </Label>
      <fieldset className="flex flex-col gap-2 type-small font-medium text-content-secondary">
        <legend className="type-small font-medium text-content-secondary">별점</legend>
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={`text-2xl leading-none transition ${
                rating !== null && value <= rating ? "text-amber-400" : "text-slate-300 hover:text-amber-300"
              }`}
              aria-label={`${value}점`}
            >
              ★
            </button>
          ))}
          <span className="ml-2 type-caption font-normal text-content-muted">
            {rating ? `${rating}점 / 5점` : "선택하지 않으면 별점 없이 등록됩니다."}
          </span>
        </div>
      </fieldset>
      <Label className="flex flex-col gap-2 type-small font-medium text-content-secondary">
        후기 사진 첨부 (선택, 최대 4장)
        <input
          id={imageInputId}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            const selectedFiles = Array.from(event.target.files ?? []);
            if (selectedFiles.length === 0) {
              setImageFiles([]);
              setImagePreviewUrls([]);
              return;
            }
            if (selectedFiles.length > MAX_REVIEW_IMAGES) {
              setErrorMessage(`이미지는 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.`);
            } else {
              setErrorMessage("");
            }
            const nextFiles = selectedFiles.slice(0, MAX_REVIEW_IMAGES);
            setImageFiles(nextFiles);
            setImagePreviewUrls(nextFiles.map((file) => URL.createObjectURL(file)));
          }}
          className="sr-only"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label
            htmlFor={imageInputId}
            className={buttonVariants({
              variant: "secondary",
              size: "sm",
              className: "cursor-pointer rounded-lg",
            })}
          >
            이미지 첨부
          </label>
          <span
            className="block max-w-full truncate type-caption text-slate-500 sm:max-w-[260px]"
            title={imageFiles.length > 0 ? `${imageFiles.length}개 선택됨` : "첨부된 파일 없음"}
          >
            {imageFiles.length > 0 ? `${imageFiles.length}개 선택됨` : "첨부된 파일 없음"}
          </span>
        </div>
      </Label>
      {imagePreviewUrls.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-4 sm:gap-2">
            {imagePreviewUrls.map((previewUrl, index) => (
              <div key={`${previewUrl}-${index}`} className="relative h-28 overflow-hidden rounded-xl ring-1 ring-slate-200">
                <Image
                  src={previewUrl}
                  alt={`첨부 이미지 미리보기 ${index + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover"
                  unoptimized
                />
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setImageFiles([]);
              setImagePreviewUrls([]);
            }}
            className="rounded-md px-3 py-1.5"
          >
            첨부 이미지 제거
          </Button>
        </div>
      ) : null}
      {errorMessage ? <p className="type-small text-red-500">{errorMessage}</p> : null}
      <Button type="submit" disabled={isSubmitting} className="rounded-lg px-5 py-3">
        {isSubmitting ? "등록 중..." : "후기 등록"}
      </Button>
    </form>
  );
}
```

- **제목/내용:** `Input`/`Textarea` + `title`, `content` state.
- **별점:** 1~5 버튼, `rating` state (선택).
- **이미지:** `type="file"` multiple, 최대 4장, `uploadReviewImage`로 업로드 후 URL 배열 전송.
- **form submit:** `handleSubmit` → 이미지 업로드 → `POST /api/reviews` → 성공 시 `/reviews`로 이동.

### 2-3. 리뷰 목록 카드에서 수정/삭제 액션

**파일:** `src/components/ReviewItemActions.tsx`

- `/reviews` 목록에서 본인 리뷰(`review.member_id === session.memberId`)일 때만 렌더.
- **수정:** 클릭 시 인라인 폼(제목/내용/이미지 input) 표시 → `uploadReviewImage`로 새 이미지 업로드 후 `PATCH /api/reviews/[id]` 호출.
- **삭제:** `useAdminConfirm` 확인 후 `DELETE /api/reviews/[id]` 호출.
- 이미지 input: `type="file"` multiple, 최대 4장, `accept="image/png,image/jpeg,image/webp,image/gif"`, `className="sr-only"` + 라벨로 노출.

---

## 3. 상품 상세 및 상담 신청

### 3-1. 상담 모달 (상담신청 버튼/폼·API 호출)

**파일:** `src/components/ConsultModal.tsx`

- `ConsultModalProvider`로 감싼 하위에서 `useConsultModal()`로 `openModal(params?)`, `closeModal` 사용.
- `openModal({ productId?, productTitle?, sourcePath? })` 호출 시 모달 열림.
- 폼 필드: 이름, 연락처, 문의 내용. (로그인 사용자 user_id 미사용 — 이름/연락처로만 저장.)

**관련 발췌 (폼 제출·API 호출 부분):**

```tsx
const handleSubmit = useCallback(
  async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.content.trim()) {
      showToast("error", "이름, 연락처, 문의 내용을 모두 입력해 주세요.");
      return;
    }

    const selectedOptions = quoteCtx.selectedOptions ?? null;
    const quoteSummary = quoteCtx.quoteSummary ?? null;
    const hasOptionData = ...;

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      content: form.content.trim(),
      product_id: params.productId?.trim() || undefined,
      product_title: params.productTitle?.trim() || undefined,
      source_path: params.sourcePath?.trim() || undefined,
    };
    if (hasOptionData) {
      body.selected_options = selectedOptions;
      body.quote_summary = { ... };
      body.inquired_at = new Date().toISOString();
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        showToast("error", "문의 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setForm(initialFormState);
      closeModal();
      showToast("success", "상담 요청이 접수되었습니다. ...");
    } catch {
      showToast("error", "네트워크 오류가 발생했습니다. ...");
    } finally {
      setIsSubmitting(false);
    }
  },
  [form, params, closeModal, showToast, quoteCtx],
);
```

- **상담 신청 DB/API:** `POST /api/inquiries` 한 번만 호출. body에 `name`, `phone`, `content`, `product_id`, `product_title`, `source_path`, (선택) `selected_options`, `quote_summary`, `inquired_at`.
- **로그인 user_id:** 상담(inquiry)은 사용하지 않음. 이름·연락처·내용만 저장.

### 3-2. 상품 상세 페이지에서 상담 버튼/모달 연결

**파일:** `src/app/products/[id]/page.tsx`

- 상단에서 `ConsultModalProvider`로 감싼 뒤, `ProductDetailV2`·`ProductDetailStickyV2Desktop`·`ProductDetailStickyV2Mobile`에 `productId`, `productTitle`, `sourcePath` 전달.

```tsx
<ConsultModalProvider>
  <ProductQuoteProvider>
    ...
    <ProductDetailV2
      ...
      productId={product.id}
      productTitle={product.title}
      sourcePath={sourcePath}
      ...
    />
    <ProductDetailStickyV2Desktop
      productId={product.id}
      productTitle={product.title}
      sourcePath={sourcePath}
      ...
    />
    <ProductDetailStickyV2Mobile ... />
  </ProductQuoteProvider>
</ConsultModalProvider>
```

**파일:** `src/components/products/ProductDetailV2.tsx`

- `useConsultModal()`로 `openModal` 사용. 상담 문의 버튼 클릭 시:

```tsx
const { openModal } = useConsultModal();
// ...
openModal({ productId, productTitle, sourcePath });
```

**파일:** `src/components/products/ProductDetailStickyV2.tsx`

- 동일하게 `useConsultModal()` → `openModal({ productId, productTitle, sourcePath })` 호출.

---

## 4. Supabase 관련

### 4-1. Supabase client 초기화

**파일:** `src/lib/supabase.ts`

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)가 필요합니다.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 4-2. Reviews — insert/select (lib + API)

**파일:** `src/lib/reviews.ts`

```ts
import { supabase } from "@/lib/supabase";
import type { Review } from "@/types/review";

function normalizeReview(row: Record<string, unknown>): Review {
  const imageUrls = Array.isArray(row.image_urls)
    ? row.image_urls.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  const legacyImageUrl = typeof row.image_url === "string" ? row.image_url : undefined;

  return {
    id: String(row.id ?? ""),
    member_id: typeof row.member_id === "string" ? row.member_id : undefined,
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    image_url: legacyImageUrl,
    image_urls: imageUrls.length > 0 ? imageUrls : legacyImageUrl ? [legacyImageUrl] : [],
    author_name: String(row.author_name ?? ""),
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    rating: typeof row.rating === "number" ? row.rating : undefined,
  };
}

export async function getReviews() {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return [] as Review[];
  }
  return (data ?? []).map((row) => normalizeReview(row as Record<string, unknown>));
}
```

**파일:** `src/app/api/reviews/route.ts` (GET 목록, POST 등록)

- GET: `getReviews()` 호출 후 JSON 반환.
- POST: 쿠키에서 `getMemberSessionFromCookies(cookieStore)`로 세션 확인 → `member_id`, `author_name` 사용. body에서 `title`, `content`, `image_urls`, `rating` 검증 후 `supabase.from("reviews").insert(payload)`.

**파일:** `src/app/api/reviews/[id]/route.ts` (PATCH 수정, DELETE 삭제)

- PATCH/DELETE: 동일하게 `getMemberSessionFromCookies`로 세션 확인 후, 해당 리뷰의 `member_id`와 `session.memberId` 비교. 일치할 때만 `supabase.from("reviews").update(...)` 또는 `.delete()`.

### 4-3. 리뷰 이미지 스토리지 업로드 (클라이언트)

**파일:** `src/lib/reviewImageUpload.ts`

```ts
"use client";

import { supabase } from "@/lib/supabase";

const REVIEW_IMAGE_BUCKET = "review-images";
const MAX_REVIEW_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export async function uploadReviewImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("jpg, png, webp, gif 형식만 업로드할 수 있습니다.");
  }
  if (file.size > MAX_REVIEW_IMAGE_SIZE) {
    throw new Error("이미지 용량은 5MB 이하만 업로드할 수 있습니다.");
  }

  const extension = sanitizeFileName(file.name.split(".").pop() ?? "jpg");
  const filePath = `public/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

  const uploadResult = await supabase.storage.from(REVIEW_IMAGE_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadResult.error) {
    throw new Error("이미지 업로드에 실패했습니다.");
  }

  const publicResult = supabase.storage.from(REVIEW_IMAGE_BUCKET).getPublicUrl(filePath);
  return publicResult.data.publicUrl;
}
```

### 4-4. Inquiries — insert/select/update (API)

**파일:** `src/app/api/inquiries/route.ts`

- GET: `supabase.from("inquiries").select("*")` + 검색/필터/정렬/페이징.
- PATCH: body `ids`, `is_completed`로 여러 건 `is_completed` 업데이트.
- POST: body에서 `name`, `phone`, `content`, `product_id`, `product_title`, `source_path`, (선택) `quote_snapshot` 정규화 후 `supabase.from("inquiries").insert(insertPayload)`.

**파일:** `src/app/api/inquiries/[id]/route.ts`

- PATCH: `supabase.from("inquiries").update({ is_completed: body.is_completed }).eq("id", id)`.

### 4-5. 관리자용 스토리지 업로드 (product-images 등)

**파일:** `src/lib/storage/providers/SupabaseStorageProvider.ts`

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { IStorageProvider } from "../StorageProvider";

const BUCKET = "product-images";
const CACHE_CONTROL = "public, max-age=31536000, immutable";

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SupabaseStorageProvider: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다. (서버 전용)"
    );
  }
  return createClient(url, key);
}

export class SupabaseStorageProvider implements IStorageProvider {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? getSupabaseAdmin();
  }

  async uploadPublicImage(params: {
    file: Blob | File;
    path: string;
    contentType: string;
    bucket?: string;
  }): Promise<{ url: string; path: string }> {
    const { file, path, contentType, bucket = BUCKET } = params;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await this.client.storage.from(bucket).upload(path, buffer, {
      contentType,
      cacheControl: CACHE_CONTROL,
      upsert: false,
    });

    if (error) {
      throw new Error(`스토리지 업로드 실패: ${error.message}`);
    }

    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }
}
```

- products/관리자 업로드는 이 프로바이더와 `/api/admin/uploads/image` 등으로 사용 (버킷 기본값 `product-images`). 리뷰 이미지는 클라이언트에서 `review-images` 버킷에 직접 업로드.

---

## 5. 타입/스키마

### 5-1. Review

**파일:** `src/types/review.ts`

```ts
export type Review = {
  id: string;
  member_id?: string;
  title: string;
  content: string;
  image_url?: string;
  image_urls?: string[];
  author_name: string;
  created_at?: string;
  rating?: number;
};
```

### 5-2. Inquiry

**파일:** `src/types/inquiry.ts`

```ts
export type Inquiry = {
  id: string;
  name: string;
  phone: string;
  content: string;
  product_id?: string;
  product_title?: string;
  source_path?: string;
  is_completed?: boolean;
  created_at?: string;
  quote_snapshot?: QuoteSnapshot | null;
};

export type QuoteSnapshot = {
  selectedOptions?: Record<string, string>;
  quoteSummary?: {
    total: number | null;
    basePrice: number | null;
    breakdown: Array<{ groupLabel: string; optionLabel: string; priceDelta: number }>;
  };
  inquiredAt?: string;
};

export type InquiryInput = {
  name: string;
  phone: string;
  content: string;
  product_id?: string;
  product_title?: string;
  source_path?: string;
  selected_options?: Record<string, string>;
  quote_summary?: {
    total: number | null;
    base_price: number | null;
    breakdown: Array<{ group_label: string; option_label: string; price_delta: number }>;
  };
  inquired_at?: string;
};
```

### 5-3. Product (요약)

**파일:** `src/types/product.ts`

- `Product`: id, title, description, image_url, category, theme, price, duration, status, trust, options, itinerary 관련 필드 등 다수.
- `ProductTrust`, `ProductOptions`, `SelectedOptions`, `ProductOverview` 등 부타입 정의.
- 상담과 직접 연동되는 DB 컬럼은 없고, 상세/스티키에서 `productId`/`productTitle`/`sourcePath`만 API로 전달.

### 5-4. Zod / validation

- 리뷰·문의용 공통 Zod 스키마 파일은 없음. API에서 `typeof body.xxx`, `trim()`, `Array.isArray` 등으로 검증.

---

## 6. 라우팅 구조

| 용도           | 라우트                    | 비고 |
|----------------|---------------------------|------|
| 여행후기 작성  | `/reviews/write`          | `src/app/reviews/write/page.tsx` |
| 여행후기 목록  | `/reviews`                | `src/app/reviews/page.tsx` |
| 마이페이지 리뷰 관리 | `/mypage/reviews`   | `src/app/mypage/reviews/page.tsx` |
| 리뷰 상세     | 없음                      | 상세 전용 라우트 없음. “상세보기 (준비중)”만 존재. |
| API 리뷰 목록/등록 | `GET/POST /api/reviews`   | `src/app/api/reviews/route.ts` |
| API 리뷰 수정/삭제 | `PATCH/DELETE /api/reviews/[id]` | `src/app/api/reviews/[id]/route.ts` |
| API 문의 목록/등록/일괄처리 | `GET/POST/PATCH /api/inquiries` | `src/app/api/inquiries/route.ts` |
| API 문의 단건 상태 | `PATCH /api/inquiries/[id]` | `src/app/api/inquiries/[id]/route.ts` |

---

## 7. 스타일/UI

### 7-1. 후기 작성 페이지용 레이아웃 컴포넌트

**파일:** `src/components/layout/PageHero.tsx`

```tsx
type PageHeroProps = { kicker?: string; title: string; subtitle?: string; rightSlot?: React.ReactNode };
export function PageHero({ kicker, title, subtitle, rightSlot }: PageHeroProps) {
  return (
    <section className="page-hero flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        {kicker ? <p className="section-label text-white/80">{kicker}</p> : null}
        <h1 className="section-title type-h2 md:text-[32px] md:leading-[1.2] text-white">{title}</h1>
        {subtitle ? <p className="type-small text-white/90">{subtitle}</p> : null}
      </div>
      {rightSlot ? <div className="mt-4 md:mt-0">{rightSlot}</div> : null}
    </section>
  );
}
```

**파일:** `src/components/layout/SectionBody.tsx`

```tsx
export function SectionBody({ children, className }: SectionBodyProps) {
  return <main className={`section-body ${className ?? ""}`}>{children}</main>;
}
```

**파일:** `src/components/layout/ContentCard.tsx`

```tsx
export function ContentCard({ children, className }: ContentCardProps) {
  return <section className={`content-card ${className ?? ""}`}>{children}</section>;
}
```

### 7-2. 마이페이지 레이아웃·사이드바

**파일:** `src/components/mypage/MyPageLayout.tsx`

```tsx
import SiteHeader from "@/components/SiteHeader";
import MyPageSidebar from "@/components/mypage/MyPageSidebar";

export default function MyPageLayout({ children, title, description }: MyPageLayoutProps) {
  return (
    <div className="min-h-screen bg-site-bg text-[var(--text-primary)]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4 md:py-8">
        <header className="mb-6 ...">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h1>
          {description ? <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p> : null}
        </header>
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          <aside className="... lg:w-[260px] ...">
            <MyPageSidebar />
          </aside>
          <section className="min-w-0 flex-1 ...">
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}
```

**파일:** `src/components/mypage/MyPageSidebar.tsx`

```tsx
const MENU_ITEMS = [
  { href: "/mypage/dashboard", label: "대시보드" },
  { href: "/mypage/points", label: "포인트" },
  { href: "/mypage/points/request", label: "포인트 적립 요청" },
  { href: "/mypage/rewards", label: "리워드 교환소" },
  { href: "/mypage/reviews", label: "리뷰 관리" },
  { href: "/mypage/notifications", label: "알림" },
  { href: "/mypage/profile", label: "회원정보" },
] as const;

export default function MyPageSidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="마이페이지 메뉴" className="flex gap-2 overflow-x-auto lg:flex-col">
      {MENU_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium ... ${isActive ? "..." : "..."}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

### 7-3. 공용 버튼/업로드

- **리뷰 작성:** `@/components/ui/Button`, `buttonVariants` (ReviewWriteForm), `Label`, `Input`, `Textarea`.
- **관리자 이미지 업로드:** `src/components/admin/ImageUploadField.tsx` — 드래그앤드롭 + 파일 선택, `/api/admin/uploads/image` 호출 후 hero/card URL 반영. (리뷰 이미지는 `ReviewWriteForm` + `reviewImageUpload` 사용.)

---

## 8. 로그인 사용자 식별 (리뷰용)

- **리뷰:** `src/lib/memberSession.ts` — 쿠키 `theall_member_auth`에서 `getMemberSessionFromCookies(cookieStore)`로 세션 조회. `session.memberId`, `session.name` 사용.
- **상담(inquiry):** 로그인 사용자 user_id 미사용. 폼의 이름·연락처·내용만 `/api/inquiries`로 전달.

이 문서만으로도 리뷰/마이페이지/상담/상품상세/스토리지 관련 수정 범위를 파악할 수 있습니다.
