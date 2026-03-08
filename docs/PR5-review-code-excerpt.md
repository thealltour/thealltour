# PR5 검토용 코드 발췌 (후기 작성 UX 개편 + Draft/임시저장 + 이미지 업로드)

코드 생략 없이 파일 경로 + 전체 코드 기준으로 발췌함.

---

## 1. reviews 관련 migration 전체

### 1-1. supabase/migrations/20260307100000_reviews_eligibility_columns.sql

```sql
-- reviews 테이블에 eligibility 기반 후기 제출을 위한 컬럼 추가
-- PR3 보완: eligibility 기반 후기 제출 완료 처리 연결

-- ============================================
-- 1. 컬럼 추가 (ADD COLUMN IF NOT EXISTS 사용)
-- ============================================

-- rating 컬럼 (별점)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating integer;

-- image_url 컬럼 (단일 이미지, 레거시)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS image_url text;

-- image_urls 컬럼 (복수 이미지)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- eligibility_id 컬럼 (후기 작성 자격 연결)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS eligibility_id uuid;

-- booking_id 컬럼 (여행 예약 연결)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS booking_id uuid;

-- customer_profile_id 컬럼 (고객 프로필 연결)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS customer_profile_id uuid;

-- status 컬럼 (draft, submitted, hidden)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted';

-- ============================================
-- 2. FK 제약조건 추가 (이미 있으면 스킵)
-- ============================================

DO $$
BEGIN
  -- eligibility_id FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_eligibility_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'reviews'
  ) THEN
    ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_eligibility_id_fkey
    FOREIGN KEY (eligibility_id) REFERENCES public.review_eligibilities(id) ON DELETE SET NULL;
  END IF;

  -- booking_id FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_booking_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'reviews'
  ) THEN
    ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_booking_id_fkey
    FOREIGN KEY (booking_id) REFERENCES public.travel_bookings(id) ON DELETE SET NULL;
  END IF;

  -- customer_profile_id FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_customer_profile_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'reviews'
  ) THEN
    ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_customer_profile_id_fkey
    FOREIGN KEY (customer_profile_id) REFERENCES public.customer_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- 3. 인덱스 생성
-- ============================================

-- 하나의 eligibility당 후기 1개만 허용하는 unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_eligibility_unique
ON public.reviews (eligibility_id)
WHERE eligibility_id IS NOT NULL;

-- eligibility_id로 빠른 조회
CREATE INDEX IF NOT EXISTS idx_reviews_eligibility_id
ON public.reviews (eligibility_id)
WHERE eligibility_id IS NOT NULL;

-- status로 필터링
CREATE INDEX IF NOT EXISTS idx_reviews_status
ON public.reviews (status);

-- ============================================
-- 4. 확인 쿼리 (실행 후 주석 해제하여 확인 가능)
-- ============================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'reviews'
-- ORDER BY ordinal_position;
```

### 1-2. supabase/migrations/20260307130000_reviews_draft_fields.sql

```sql
-- reviews 테이블에 draft/여행 후기형 필드 추가
-- PR5: 후기 작성 UX 고도화 + Draft/임시저장 + 이미지 업로드 강화

-- ============================================
-- 1. 새 컬럼 추가
-- ============================================

-- updated_at 컬럼 (수정 시간)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- summary 컬럼 (한줄 요약)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS summary text;

-- content_good 컬럼 (좋았던 점)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS content_good text;

-- content_bad 컬럼 (아쉬웠던 점)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS content_bad text;

-- content_tip 컬럼 (여행 팁)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS content_tip text;

-- rating_schedule 컬럼 (일정 만족도)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating_schedule integer;

-- rating_stay 컬럼 (숙소 만족도)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating_stay integer;

-- rating_guide 컬럼 (가이드 만족도)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating_guide integer;

-- rating_food 컬럼 (식사 만족도)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating_food integer;

-- ============================================
-- 2. 인덱스 추가
-- ============================================

-- updated_at 인덱스 (최근 수정 순 정렬용)
CREATE INDEX IF NOT EXISTS idx_reviews_updated_at
ON public.reviews (updated_at DESC);

-- member_id + status 복합 인덱스 (마이페이지 조회용)
CREATE INDEX IF NOT EXISTS idx_reviews_member_status
ON public.reviews (member_id, status);

-- ============================================
-- 3. 기존 eligibility unique index 정책 확인
-- ============================================
-- 기존: idx_reviews_eligibility_unique (eligibility_id) WHERE eligibility_id IS NOT NULL
-- → 동일 eligibility에 review 1개만 허용
-- → draft → submitted 전환 시 같은 레코드 사용 (문제 없음)

-- ============================================
-- 4. 확인 쿼리
-- ============================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'reviews'
-- ORDER BY ordinal_position;
```

### 1-3. supabase/migrations/20260308120000_reconcile_reviews_columns.sql

```sql
-- =============================================================================
-- PR4: reviews 컬럼 정합성 보정 (비파괴)
-- =============================================================================
--
-- 목적:
--   baseline 목표 컬럼에 맞춰 public.reviews 에 누락된 컬럼만 add column if not exists 로
--   보정하고, FK·인덱스를 없을 때만 추가합니다.
--
-- Destructive change를 하지 않는 이유:
--   기존 컬럼 제거/재정의/타입 변경 없음. image_urls not null 강제·정책 삭제 금지.
--
-- PR2-B / Phase 2:
--   구조만 맞추어 두며, RLS 정책 통일은 이번 PR에서 하지 않습니다.
--
-- =============================================================================

-- 컬럼 추가 (누락된 것만; 이미 있으면 no-op)
alter table public.reviews add column if not exists author_name text;
alter table public.reviews add column if not exists rating integer;
alter table public.reviews add column if not exists image_url text;
alter table public.reviews add column if not exists image_urls text[] default '{}';
alter table public.reviews add column if not exists eligibility_id uuid;
alter table public.reviews add column if not exists booking_id uuid;
alter table public.reviews add column if not exists customer_profile_id uuid;
alter table public.reviews add column if not exists status text default 'submitted';
alter table public.reviews add column if not exists updated_at timestamptz not null default now();
alter table public.reviews add column if not exists summary text;
alter table public.reviews add column if not exists content_good text;
alter table public.reviews add column if not exists content_bad text;
alter table public.reviews add column if not exists content_tip text;
alter table public.reviews add column if not exists rating_schedule integer;
alter table public.reviews add column if not exists rating_stay integer;
alter table public.reviews add column if not exists rating_guide integer;
alter table public.reviews add column if not exists rating_food integer;

-- FK 제약 (없을 때만 추가)
do $$
begin
  if not exists (select 1 from information_schema.table_constraints where table_schema = 'public' and table_name = 'reviews' and constraint_name = 'reviews_eligibility_id_fkey') then
    alter table public.reviews add constraint reviews_eligibility_id_fkey foreign key (eligibility_id) references public.review_eligibilities(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.table_constraints where table_schema = 'public' and table_name = 'reviews' and constraint_name = 'reviews_booking_id_fkey') then
    alter table public.reviews add constraint reviews_booking_id_fkey foreign key (booking_id) references public.travel_bookings(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.table_constraints where table_schema = 'public' and table_name = 'reviews' and constraint_name = 'reviews_customer_profile_id_fkey') then
    alter table public.reviews add constraint reviews_customer_profile_id_fkey foreign key (customer_profile_id) references public.customer_profiles(id) on delete set null;
  end if;
end $$;

-- 인덱스 (없으면 생성)
create unique index if not exists idx_reviews_eligibility_unique on public.reviews(eligibility_id) where eligibility_id is not null;
create index if not exists idx_reviews_eligibility_id on public.reviews(eligibility_id) where eligibility_id is not null;
create index if not exists idx_reviews_status on public.reviews(status);
create index if not exists idx_reviews_updated_at on public.reviews(updated_at desc);
create index if not exists idx_reviews_member_status on public.reviews(member_id, status);
```

**확인 항목 (reviews 테이블 컬럼):**
- status ✓ (20260307100000, 20260308120000)
- updated_at ✓ (20260307130000, 20260308120000)
- summary ✓ (20260307130000, 20260308120000)
- content_good, content_bad, content_tip ✓
- rating_schedule, rating_stay, rating_guide, rating_food ✓
- eligibility_id, booking_id, customer_profile_id ✓
- rating, image_url, image_urls ✓

---

## 2. ReviewWriteForm 전체 코드

**파일:** `src/components/ReviewWriteForm.tsx`

```tsx
"use client";

import { FormEvent, useCallback, useEffect, useId, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { uploadReviewImage } from "@/lib/reviewImageUpload";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Button, buttonVariants } from "@/components/ui/Button";
import type { Review } from "@/types/review";

const MAX_REVIEW_IMAGES = 10;
const MAX_FILE_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

type Props = {
  eligibilityId?: string;
  reviewId?: string;
  initialData?: Review | null;
  productInfo?: {
    title?: string;
    departureDate?: string;
    returnDate?: string;
  };
};

type FormData = {
  title: string;
  summary: string;
  content: string;
  contentGood: string;
  contentBad: string;
  contentTip: string;
  rating: number | null;
  ratingSchedule: number | null;
  ratingStay: number | null;
  ratingGuide: number | null;
  ratingFood: number | null;
};

function StarRating({
  value,
  onChange,
  label,
  size = "md",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const starSize = size === "sm" ? "text-lg" : "text-2xl";
  return (
    <div className="flex flex-col gap-1">
      <span className="type-small font-medium text-content-secondary">{label}</span>
      <div className="inline-flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(value === star ? null : star)}
            className={`${starSize} leading-none transition ${
              value !== null && star <= value ? "text-amber-400" : "text-slate-300 hover:text-amber-300"
            }`}
            aria-label={`${star}점`}
          >
            ★
          </button>
        ))}
        {value && (
          <span className="ml-2 type-caption text-content-muted">
            {value}점
          </span>
        )}
      </div>
    </div>
  );
}

export default function ReviewWriteForm({ eligibilityId, reviewId, initialData, productInfo }: Props) {
  const router = useRouter();
  const imageInputId = useId();

  const [formData, setFormData] = useState<FormData>({
    title: initialData?.title ?? "",
    summary: initialData?.summary ?? "",
    content: initialData?.content ?? "",
    contentGood: initialData?.content_good ?? "",
    contentBad: initialData?.content_bad ?? "",
    contentTip: initialData?.content_tip ?? "",
    rating: initialData?.rating ?? null,
    ratingSchedule: initialData?.rating_schedule ?? null,
    ratingStay: initialData?.rating_stay ?? null,
    ratingGuide: initialData?.rating_guide ?? null,
    ratingFood: initialData?.rating_food ?? null,
  });

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>(
    initialData?.image_urls ?? [],
  );
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(
    initialData?.image_urls ?? [],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [currentReviewId, setCurrentReviewId] = useState<string | undefined>(reviewId);

  useEffect(() => {
    return () => {
      for (const url of imagePreviewUrls) {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      }
    };
  }, [imagePreviewUrls]);

  const updateFormData = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const validateFiles = (files: File[]): string | null => {
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return `지원하지 않는 파일 형식입니다: ${file.name}`;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        return `파일 크기가 너무 큽니다 (최대 ${MAX_FILE_SIZE_MB}MB): ${file.name}`;
      }
    }
    return null;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) return;

    const totalCount = existingImageUrls.length + imageFiles.length + selectedFiles.length;
    if (totalCount > MAX_REVIEW_IMAGES) {
      setErrorMessage(`이미지는 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.`);
      return;
    }

    const validationError = validateFiles(selectedFiles);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage("");
    const newPreviewUrls = selectedFiles.map((file) => URL.createObjectURL(file));
    setImageFiles((prev) => [...prev, ...selectedFiles]);
    setImagePreviewUrls((prev) => [...prev, ...newPreviewUrls]);
  };

  const removeImage = (index: number) => {
    const isExisting = index < existingImageUrls.length;

    if (isExisting) {
      setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
      setImagePreviewUrls((prev) => prev.filter((_, i) => i !== index));
    } else {
      const fileIndex = index - existingImageUrls.length;
      const previewUrl = imagePreviewUrls[index];
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      setImageFiles((prev) => prev.filter((_, i) => i !== fileIndex));
      setImagePreviewUrls((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const buildPayload = async (isDraft: boolean) => {
    const uploadedUrls =
      imageFiles.length > 0
        ? await Promise.all(imageFiles.map((file) => uploadReviewImage(file)))
        : [];
    const allImageUrls = [...existingImageUrls, ...uploadedUrls];

    return {
      title: formData.title,
      content: formData.content,
      summary: formData.summary,
      content_good: formData.contentGood,
      content_bad: formData.contentBad,
      content_tip: formData.contentTip,
      rating: formData.rating,
      rating_schedule: formData.ratingSchedule,
      rating_stay: formData.ratingStay,
      rating_guide: formData.ratingGuide,
      rating_food: formData.ratingFood,
      image_urls: allImageUrls,
      eligibility_id: eligibilityId || undefined,
      status: isDraft ? "draft" : "submitted",
    };
  };

  const handleSaveDraft = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsSavingDraft(true);

    try {
      const payload = await buildPayload(true);

      const url = currentReviewId ? `/api/reviews/${currentReviewId}` : "/api/reviews";
      const method = currentReviewId ? "PATCH" : "POST";

      if (currentReviewId) {
        Object.assign(payload, { action: "save_draft" });
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { message?: string; review_id?: string };

      if (!response.ok) {
        setErrorMessage(result.message ?? "임시저장에 실패했습니다.");
        return;
      }

      if (result.review_id && !currentReviewId) {
        setCurrentReviewId(result.review_id);
      }

      setSuccessMessage("임시저장되었습니다.");
      setTimeout(() => setSuccessMessage(""), 3000);

      if (imageFiles.length > 0) {
        setExistingImageUrls(imagePreviewUrls.filter((url) => !url.startsWith("blob:")));
        setImageFiles([]);
      }
    } catch {
      setErrorMessage("임시저장 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const payload = await buildPayload(false);

      const url = currentReviewId ? `/api/reviews/${currentReviewId}` : "/api/reviews";
      const method = currentReviewId ? "PATCH" : "POST";

      if (currentReviewId) {
        Object.assign(payload, { action: "submit" });
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { message?: string; eligibility_based?: boolean };

      if (!response.ok) {
        setErrorMessage(result.message ?? "후기 등록에 실패했습니다.");
        return;
      }

      if (eligibilityId || result.eligibility_based) {
        router.push("/mypage/reviews");
      } else {
        router.push("/reviews");
      }
      router.refresh();
    } catch {
      setErrorMessage("후기 등록 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEligibilityBased = !!eligibilityId;
  const totalImageCount = imagePreviewUrls.length;

  return (
    <div className="space-y-6">
      {productInfo?.title && (
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4">
          <p className="type-small font-medium text-blue-600">여행 후기 작성</p>
          <h3 className="mt-1 text-lg font-bold text-content-primary">{productInfo.title}</h3>
          {(productInfo.departureDate || productInfo.returnDate) && (
            <p className="mt-1 type-small text-content-secondary">
              여행 일정: {formatDate(productInfo.departureDate)} ~ {formatDate(productInfo.returnDate)}
            </p>
          )}
          <p className="mt-3 type-small text-content-muted">
            이 여행은 어떠셨나요? 다른 여행자들에게 도움이 될 소중한 경험을 남겨주세요.
          </p>
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <section className="space-y-4">
          <h4 className="font-semibold text-content-primary">기본 정보</h4>

          <Label className="flex flex-col gap-2 text-content-secondary">
            제목
            <Input
              type="text"
              value={formData.title}
              onChange={(e) => updateFormData("title", e.target.value)}
              placeholder="후기 제목을 입력해주세요"
            />
          </Label>

          <Label className="flex flex-col gap-2 text-content-secondary">
            한줄 요약
            <Input
              type="text"
              value={formData.summary}
              onChange={(e) => updateFormData("summary", e.target.value)}
              placeholder="이 여행을 한 문장으로 표현한다면?"
            />
          </Label>

          <div className="rounded-lg bg-slate-50 p-4">
            <StarRating
              value={formData.rating}
              onChange={(v) => updateFormData("rating", v)}
              label="전체 만족도"
              size="md"
            />
            {!formData.rating && isEligibilityBased && (
              <p className="mt-1 type-caption text-amber-600">* 필수 항목</p>
            )}
          </div>
        </section>

        {isEligibilityBased && (
          <section className="space-y-4">
            <h4 className="font-semibold text-content-primary">세부 평점</h4>
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-4">
              <StarRating
                value={formData.ratingSchedule}
                onChange={(v) => updateFormData("ratingSchedule", v)}
                label="일정"
                size="sm"
              />
              <StarRating
                value={formData.ratingStay}
                onChange={(v) => updateFormData("ratingStay", v)}
                label="숙소"
                size="sm"
              />
              <StarRating
                value={formData.ratingGuide}
                onChange={(v) => updateFormData("ratingGuide", v)}
                label="가이드"
                size="sm"
              />
              <StarRating
                value={formData.ratingFood}
                onChange={(v) => updateFormData("ratingFood", v)}
                label="식사"
                size="sm"
              />
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h4 className="font-semibold text-content-primary">후기 내용</h4>

          {isEligibilityBased ? (
            <>
              <Label className="flex flex-col gap-2 text-content-secondary">
                좋았던 점
                <Textarea
                  rows={4}
                  value={formData.contentGood}
                  onChange={(e) => updateFormData("contentGood", e.target.value)}
                  placeholder="일정, 숙소, 가이드, 식사 등 만족스러웠던 점을 적어주세요."
                />
              </Label>

              <Label className="flex flex-col gap-2 text-content-secondary">
                아쉬웠던 점
                <Textarea
                  rows={4}
                  value={formData.contentBad}
                  onChange={(e) => updateFormData("contentBad", e.target.value)}
                  placeholder="개선되면 좋을 점이 있었다면 적어주세요."
                />
              </Label>

              <Label className="flex flex-col gap-2 text-content-secondary">
                여행 팁
                <Textarea
                  rows={4}
                  value={formData.contentTip}
                  onChange={(e) => updateFormData("contentTip", e.target.value)}
                  placeholder="다른 여행자에게 도움이 될 팁을 남겨주세요."
                />
              </Label>

              <details className="group rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-content-secondary type-small font-medium hover:bg-slate-50">
                  자유 형식으로 작성하기 (클릭하여 펼치기)
                </summary>
                <div className="px-4 pb-4">
                  <Textarea
                    rows={6}
                    value={formData.content}
                    onChange={(e) => updateFormData("content", e.target.value)}
                    placeholder="형식에 구애받지 않고 자유롭게 후기를 작성하실 수 있습니다."
                  />
                </div>
              </details>
            </>
          ) : (
            <Label className="flex flex-col gap-2 text-content-secondary">
              내용
              <Textarea
                required
                rows={8}
                value={formData.content}
                onChange={(e) => updateFormData("content", e.target.value)}
                placeholder="여행 경험을 자유롭게 적어주세요."
              />
            </Label>
          )}
        </section>

        <section className="space-y-4">
          <h4 className="font-semibold text-content-primary">
            사진 첨부
            <span className="ml-2 type-small font-normal text-content-muted">
              (선택, 최대 {MAX_REVIEW_IMAGES}장)
            </span>
          </h4>

          <input
            id={imageInputId}
            type="file"
            multiple
            accept={ALLOWED_TYPES.join(",")}
            onChange={handleFileSelect}
            className="sr-only"
          />

          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={imageInputId}
              className={buttonVariants({
                variant: "secondary",
                size: "sm",
                className: "cursor-pointer rounded-lg",
              })}
            >
              + 사진 추가
            </label>
            <span className="type-caption text-content-muted">
              {totalImageCount > 0
                ? `${totalImageCount}장 선택됨 (최대 ${MAX_REVIEW_IMAGES}장)`
                : "첨부된 사진 없음"}
            </span>
          </div>

          {imagePreviewUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {imagePreviewUrls.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-slate-200"
                >
                  {index === 0 && (
                    <span className="absolute left-1 top-1 z-10 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      대표
                    </span>
                  )}
                  <Image
                    src={url}
                    alt={`첨부 이미지 ${index + 1}`}
                    fill
                    sizes="(max-width: 640px) 33vw, 20vw"
                    className="object-cover"
                    unoptimized={url.startsWith("blob:")}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label={`이미지 ${index + 1} 삭제`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="type-caption text-content-muted">
            * 첫 번째 이미지가 대표 이미지로 표시됩니다.
            {/* TODO: drag & drop, 이미지 순서 변경, webp 변환, EXIF 회전 처리 */}
          </p>
        </section>

        {errorMessage && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-red-600 type-small">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-green-600 type-small">
            {successMessage}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={isSavingDraft || isSubmitting}
            onClick={handleSaveDraft}
            className="rounded-lg px-5 py-3"
          >
            {isSavingDraft ? "저장 중..." : "임시저장"}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isSavingDraft}
            className="rounded-lg px-5 py-3"
          >
            {isSubmitting ? "등록 중..." : "후기 등록"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
```

---

## 3. 후기 작성 페이지 전체 코드

**파일:** `src/app/reviews/write/page.tsx`

```tsx
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import ReviewWriteForm from "@/components/ReviewWriteForm";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { ContentCard } from "@/components/layout/ContentCard";
import { getEligibilityWithBookingById } from "@/lib/reviewEligibilities";
import { getReviewByEligibilityId, getReviewById } from "@/lib/reviews";
import type { Review } from "@/types/review";

type Props = {
  searchParams: Promise<{ eligibility?: string; review?: string }>;
};

export default async function ReviewWritePage({ searchParams }: Props) {
  const params = await searchParams;
  const eligibilityId = params.eligibility;
  const reviewIdParam = params.review;

  let eligibilityInfo: {
    productTitle: string | null;
    departureDate: string | null;
    returnDate: string | null;
    isValid: boolean;
    alreadySubmitted: boolean;
  } | null = null;

  let initialReview: Review | null = null;
  let effectiveReviewId: string | undefined = reviewIdParam;

  if (reviewIdParam) {
    const review = await getReviewById(reviewIdParam);
    if (review && review.status === "draft") {
      initialReview = review;
      if (review.eligibility_id && !eligibilityId) {
        const eligibility = await getEligibilityWithBookingById(review.eligibility_id);
        if (eligibility) {
          eligibilityInfo = {
            productTitle: eligibility.product_title,
            departureDate: eligibility.departure_date,
            returnDate: eligibility.return_date,
            isValid: true,
            alreadySubmitted: false,
          };
        }
      }
    }
  }

  if (eligibilityId) {
    const eligibility = await getEligibilityWithBookingById(eligibilityId);
    if (eligibility) {
      const existingReview = await getReviewByEligibilityId(eligibilityId);

      if (existingReview && existingReview.status === "draft") {
        initialReview = existingReview;
        effectiveReviewId = existingReview.id;
      }

      eligibilityInfo = {
        productTitle: eligibility.product_title,
        departureDate: eligibility.departure_date,
        returnDate: eligibility.return_date,
        isValid: true,
        alreadySubmitted: !!(existingReview && existingReview.status === "submitted"),
      };
    } else {
      eligibilityInfo = {
        productTitle: null,
        departureDate: null,
        returnDate: null,
        isValid: false,
        alreadySubmitted: false,
      };
    }
  }

  const showInvalidWarning = eligibilityId && eligibilityInfo && !eligibilityInfo.isValid;
  const showAlreadySubmittedWarning = eligibilityId && eligibilityInfo?.alreadySubmitted;

  const pageTitle = eligibilityInfo?.productTitle
    ? `${eligibilityInfo.productTitle} 후기 작성`
    : "여행후기 작성";

  const productInfo = eligibilityInfo?.isValid
    ? {
        title: eligibilityInfo.productTitle ?? undefined,
        departureDate: eligibilityInfo.departureDate ?? undefined,
        returnDate: eligibilityInfo.returnDate ?? undefined,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="reviews" />
      <SectionBody className="flex flex-col gap-[var(--space-5)]">
        <PageHero
          kicker="THEALL TOUR REVIEWS"
          title={pageTitle}
          subtitle="실제 여행 경험을 남겨주시면 더올투어를 찾는 분들께 큰 도움이 됩니다."
        />
        <ContentCard>
          {showInvalidWarning ? (
            <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-red-700">유효하지 않은 후기 작성 링크입니다.</p>
                <p className="mt-1 text-sm text-red-600">마이페이지에서 작성 가능한 후기를 확인해주세요.</p>
              </div>
              <Link
                href="/mypage/reviews"
                className="inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800"
              >
                마이페이지로 이동 →
              </Link>
            </div>
          ) : showAlreadySubmittedWarning ? (
            <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-amber-700">이미 작성 완료된 후기입니다.</p>
                <p className="mt-1 text-sm text-amber-600">마이페이지에서 작성한 후기를 확인할 수 있습니다.</p>
              </div>
              <Link
                href="/mypage/reviews"
                className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
              >
                내 후기 보기 →
              </Link>
            </div>
          ) : (
            <ReviewWriteForm
              eligibilityId={eligibilityId}
              reviewId={effectiveReviewId}
              initialData={initialReview}
              productInfo={productInfo}
            />
          )}
        </ContentCard>
      </SectionBody>
    </div>
  );
}
```

**확인 포인트:**
- searchParams: eligibility, review 처리 ✓
- getEligibilityWithBookingById 사용 ✓
- draft 로딩: reviewIdParam → getReviewById → status === "draft" 시 initialReview; eligibilityId → getReviewByEligibilityId → draft면 initialReview, effectiveReviewId 설정 ✓
- eligibility 제출 차단: showAlreadySubmittedWarning 시 "이미 작성 완료된 후기" 안내 및 폼 비노출 ✓

---

## 4. reviews API 전체 코드

**파일:** `src/app/api/reviews/route.ts`

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getReviews, getReviewByEligibilityId } from "@/lib/reviews";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { createNewReviewNotification } from "@/lib/adminNotifications";
import { getEligibilityById, updateEligibilityStatus } from "@/lib/reviewEligibilities";

type ReviewBody = {
  title?: string;
  content?: string;
  image_url?: string | null;
  image_urls?: string[];
  rating?: number;
  eligibility_id?: string;
  status?: "draft" | "submitted";
  summary?: string;
  content_good?: string;
  content_bad?: string;
  content_tip?: string;
  rating_schedule?: number;
  rating_stay?: number;
  rating_guide?: number;
  rating_food?: number;
};

const MAX_REVIEW_IMAGES = 10;

export async function GET() {
  const reviews = await getReviews();
  return NextResponse.json(reviews);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return NextResponse.json({ message: "회원 로그인 후 작성할 수 있습니다." }, { status: 401 });
  }

  const body = (await request.json()) as ReviewBody;
  const title = body.title?.trim() ?? "";
  const content = body.content?.trim() ?? "";
  const summary = body.summary?.trim() ?? "";
  const contentGood = body.content_good?.trim() ?? "";
  const contentBad = body.content_bad?.trim() ?? "";
  const contentTip = body.content_tip?.trim() ?? "";
  const rawImageUrls = (Array.isArray(body.image_urls) ? body.image_urls : [])
    .map((url) => String(url).trim())
    .filter((url) => url.length > 0);
  const imageUrls = rawImageUrls.slice(0, MAX_REVIEW_IMAGES);
  const imageUrl = imageUrls[0] ?? body.image_url?.trim() ?? null;
  const rating =
    typeof body.rating === "number" && Number.isFinite(body.rating)
      ? Math.round(body.rating)
      : undefined;
  const eligibilityId = typeof body.eligibility_id === "string" ? body.eligibility_id.trim() : null;
  const isDraft = body.status === "draft";

  const parseDetailRating = (val: unknown): number | null => {
    if (typeof val === "number" && Number.isFinite(val) && val >= 1 && val <= 5) {
      return Math.round(val);
    }
    return null;
  };

  const ratingSchedule = parseDetailRating(body.rating_schedule);
  const ratingStay = parseDetailRating(body.rating_stay);
  const ratingGuide = parseDetailRating(body.rating_guide);
  const ratingFood = parseDetailRating(body.rating_food);

  if (!isDraft) {
    if (eligibilityId) {
      const hasTitleOrSummary = title || summary;
      const hasContent = content || contentGood || contentBad || contentTip;
      if (!hasTitleOrSummary) {
        return NextResponse.json({ message: "제목 또는 한줄 요약을 입력해 주세요." }, { status: 400 });
      }
      if (!hasContent) {
        return NextResponse.json({ message: "후기 내용을 입력해 주세요." }, { status: 400 });
      }
      if (rating === undefined) {
        return NextResponse.json({ message: "전체 만족도를 선택해 주세요." }, { status: 400 });
      }
    } else {
      if (!title || !content) {
        return NextResponse.json({ message: "제목과 내용을 입력해 주세요." }, { status: 400 });
      }
    }
  }

  if (rating !== undefined && (rating < 1 || rating > 5)) {
    return NextResponse.json({ message: "별점은 1점에서 5점 사이로 선택해 주세요." }, { status: 400 });
  }
  if (rawImageUrls.length > MAX_REVIEW_IMAGES) {
    return NextResponse.json(
      { message: `이미지는 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.` },
      { status: 400 },
    );
  }
  if (imageUrls.some((url) => url.length > 2000) || (imageUrl && imageUrl.length > 2000)) {
    return NextResponse.json({ message: "이미지 URL이 너무 깁니다." }, { status: 400 });
  }

  let bookingId: string | null = null;
  let customerProfileId: string | null = null;

  if (eligibilityId) {
    const eligibility = await getEligibilityById(eligibilityId);

    if (!eligibility) {
      return NextResponse.json({ message: "유효하지 않은 후기 작성 권한입니다." }, { status: 404 });
    }

    if (eligibility.claimed_by_member_id !== session.memberId) {
      return NextResponse.json({ message: "본인에게 부여된 후기 작성 권한이 아닙니다." }, { status: 403 });
    }

    if (!["eligible", "claimed"].includes(eligibility.status)) {
      if (eligibility.status === "submitted") {
        return NextResponse.json({ message: "이미 후기를 작성한 여행건입니다." }, { status: 409 });
      }
      if (eligibility.status === "expired") {
        return NextResponse.json({ message: "후기 작성 기한이 만료되었습니다." }, { status: 400 });
      }
      if (eligibility.status === "blocked") {
        return NextResponse.json({ message: "후기 작성이 차단된 상태입니다." }, { status: 400 });
      }
      return NextResponse.json({ message: "후기를 작성할 수 없는 상태입니다." }, { status: 400 });
    }

    const existingReview = await getReviewByEligibilityId(eligibilityId);
    if (existingReview) {
      if (existingReview.status === "submitted" && !isDraft) {
        return NextResponse.json({ message: "이미 후기를 작성한 여행건입니다." }, { status: 409 });
      }

      if (existingReview.status === "draft") {
        const updatePayload: Record<string, unknown> = {
          title,
          content: content || buildFallbackContent(contentGood, contentBad, contentTip),
          summary: summary || null,
          content_good: contentGood || null,
          content_bad: contentBad || null,
          content_tip: contentTip || null,
          image_url: imageUrl,
          image_urls: imageUrls,
          rating: rating ?? null,
          rating_schedule: ratingSchedule,
          rating_stay: ratingStay,
          rating_guide: ratingGuide,
          rating_food: ratingFood,
          status: isDraft ? "draft" : "submitted",
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from("reviews")
          .update(updatePayload)
          .eq("id", existingReview.id);

        if (updateError) {
          return NextResponse.json({ message: "후기 수정에 실패했습니다." }, { status: 500 });
        }

        if (!isDraft) {
          await updateEligibilityStatus(eligibilityId, "submitted");
          await createNewReviewNotification({
            reviewId: existingReview.id,
            authorName: session.name,
            title: title || summary || "후기",
          });
        }

        return NextResponse.json({
          message: isDraft ? "임시저장되었습니다." : "후기가 등록되었습니다.",
          review_id: existingReview.id,
          eligibility_based: true,
        }, { status: isDraft ? 200 : 201 });
      }
    }

    bookingId = eligibility.booking_id;
    customerProfileId = eligibility.customer_profile_id;
  }

  const finalContent = content || buildFallbackContent(contentGood, contentBad, contentTip);

  const payload: Record<string, unknown> = {
    member_id: session.memberId,
    author_name: session.name,
    title,
    content: finalContent,
    summary: summary || null,
    content_good: contentGood || null,
    content_bad: contentBad || null,
    content_tip: contentTip || null,
    image_url: imageUrl,
    image_urls: imageUrls,
    rating: rating ?? null,
    rating_schedule: ratingSchedule,
    rating_stay: ratingStay,
    rating_guide: ratingGuide,
    rating_food: ratingFood,
    status: isDraft ? "draft" : "submitted",
    updated_at: new Date().toISOString(),
  };

  if (eligibilityId) {
    payload.eligibility_id = eligibilityId;
    payload.booking_id = bookingId;
    payload.customer_profile_id = customerProfileId;
  }

  const insertResult = await supabase
    .from("reviews")
    .insert(payload)
    .select("id,title,author_name")
    .maybeSingle();

  if (insertResult.error) {
    if (insertResult.error.code === "23505" && insertResult.error.message?.includes("eligibility")) {
      return NextResponse.json({ message: "이미 후기를 작성한 여행건입니다." }, { status: 409 });
    }

    const insertLegacy = await supabase
      .from("reviews")
      .insert({
        member_id: session.memberId,
        author_name: session.name,
        title,
        content: finalContent,
        image_url: imageUrl,
      })
      .select("id,title,author_name")
      .maybeSingle();

    if (insertLegacy.error || !insertLegacy.data) {
      return NextResponse.json({ message: "후기 등록에 실패했습니다." }, { status: 500 });
    }

    if (!isDraft) {
      await createNewReviewNotification({
        reviewId: String(insertLegacy.data.id),
        authorName: String(insertLegacy.data.author_name),
        title: String(insertLegacy.data.title),
      });
    }

    return NextResponse.json({
      message: isDraft ? "임시저장되었습니다." : "후기가 등록되었습니다.",
      review_id: String(insertLegacy.data.id),
    }, { status: isDraft ? 200 : 201 });
  }

  if (!isDraft && eligibilityId) {
    await updateEligibilityStatus(eligibilityId, "submitted");
  }

  if (!isDraft && insertResult.data) {
    await createNewReviewNotification({
      reviewId: String(insertResult.data.id),
      authorName: String(insertResult.data.author_name),
      title: String(insertResult.data.title),
    });
  }

  return NextResponse.json({
    message: isDraft ? "임시저장되었습니다." : "후기가 등록되었습니다.",
    review_id: insertResult.data ? String(insertResult.data.id) : undefined,
    eligibility_based: !!eligibilityId,
  }, { status: isDraft ? 200 : 201 });
}

function buildFallbackContent(good?: string, bad?: string, tip?: string): string {
  const parts: string[] = [];
  if (good) parts.push(`[좋았던 점]\n${good}`);
  if (bad) parts.push(`[아쉬웠던 점]\n${bad}`);
  if (tip) parts.push(`[여행 팁]\n${tip}`);
  return parts.join("\n\n");
}
```

---

## 5. reviews PATCH API (전체 코드)

**파일:** `src/app/api/reviews/[id]/route.ts`

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getReviewById } from "@/lib/reviews";
import { updateEligibilityStatus } from "@/lib/reviewEligibilities";
import { createNewReviewNotification } from "@/lib/adminNotifications";

type ReviewPatchBody = {
  action?: "save_draft" | "submit";
  title?: string;
  content?: string;
  summary?: string;
  content_good?: string;
  content_bad?: string;
  content_tip?: string;
  image_urls?: string[];
  rating?: number;
  rating_schedule?: number;
  rating_stay?: number;
  rating_guide?: number;
  rating_food?: number;
};

const MAX_REVIEW_IMAGES = 10;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const review = await getReviewById(id);
  if (!review) {
    return NextResponse.json({ message: "후기를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(review);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const review = await getReviewById(id);
  if (!review) {
    return NextResponse.json({ message: "후기를 찾을 수 없습니다." }, { status: 404 });
  }

  if (review.member_id !== session.memberId) {
    return NextResponse.json({ message: "본인의 후기만 수정할 수 있습니다." }, { status: 403 });
  }

  if (review.status === "submitted") {
    return NextResponse.json({ message: "이미 제출된 후기는 수정할 수 없습니다." }, { status: 400 });
  }

  const body = (await request.json()) as ReviewPatchBody;
  const action = body.action ?? "save_draft";

  const title = body.title?.trim() ?? review.title;
  const content = body.content?.trim() ?? review.content;
  const summary = body.summary?.trim() ?? review.summary ?? "";
  const contentGood = body.content_good?.trim() ?? review.content_good ?? "";
  const contentBad = body.content_bad?.trim() ?? review.content_bad ?? "";
  const contentTip = body.content_tip?.trim() ?? review.content_tip ?? "";

  const rawImageUrls = (Array.isArray(body.image_urls) ? body.image_urls : review.image_urls ?? [])
    .map((url: unknown) => String(url).trim())
    .filter((url: string) => url.length > 0);
  const imageUrls = rawImageUrls.slice(0, MAX_REVIEW_IMAGES);
  const imageUrl = imageUrls[0] ?? null;

  const parseRating = (val: unknown, fallback?: number): number | null => {
    if (typeof val === "number" && Number.isFinite(val) && val >= 1 && val <= 5) {
      return Math.round(val);
    }
    if (typeof fallback === "number") return fallback;
    return null;
  };

  const rating = parseRating(body.rating, review.rating);
  const ratingSchedule = parseRating(body.rating_schedule, review.rating_schedule);
  const ratingStay = parseRating(body.rating_stay, review.rating_stay);
  const ratingGuide = parseRating(body.rating_guide, review.rating_guide);
  const ratingFood = parseRating(body.rating_food, review.rating_food);

  if (action === "submit") {
    const hasTitleOrSummary = title || summary;
    const hasContent = content || contentGood || contentBad || contentTip;

    if (review.eligibility_id) {
      if (!hasTitleOrSummary) {
        return NextResponse.json({ message: "제목 또는 한줄 요약을 입력해 주세요." }, { status: 400 });
      }
      if (!hasContent) {
        return NextResponse.json({ message: "후기 내용을 입력해 주세요." }, { status: 400 });
      }
      if (rating === null) {
        return NextResponse.json({ message: "전체 만족도를 선택해 주세요." }, { status: 400 });
      }
    } else {
      if (!title || !content) {
        return NextResponse.json({ message: "제목과 내용을 입력해 주세요." }, { status: 400 });
      }
    }
  }

  if (rawImageUrls.length > MAX_REVIEW_IMAGES) {
    return NextResponse.json(
      { message: `이미지는 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.` },
      { status: 400 },
    );
  }

  const finalContent = content || buildFallbackContent(contentGood, contentBad, contentTip);
  const newStatus = action === "submit" ? "submitted" : "draft";

  const payload: Record<string, unknown> = {
    title,
    content: finalContent,
    summary: summary || null,
    content_good: contentGood || null,
    content_bad: contentBad || null,
    content_tip: contentTip || null,
    image_url: imageUrl,
    image_urls: imageUrls,
    rating,
    rating_schedule: ratingSchedule,
    rating_stay: ratingStay,
    rating_guide: ratingGuide,
    rating_food: ratingFood,
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("reviews").update(payload).eq("id", id);

  if (error) {
    return NextResponse.json({ message: "후기 수정에 실패했습니다." }, { status: 500 });
  }

  if (action === "submit") {
    if (review.eligibility_id) {
      await updateEligibilityStatus(review.eligibility_id, "submitted");
    }
    await createNewReviewNotification({
      reviewId: id,
      authorName: review.author_name,
      title: title || summary || "후기",
    });
  }

  return NextResponse.json({
    message: action === "submit" ? "후기가 등록되었습니다." : "임시저장되었습니다.",
    review_id: id,
  });
}

function buildFallbackContent(good?: string, bad?: string, tip?: string): string {
  const parts: string[] = [];
  if (good) parts.push(`[좋았던 점]\n${good}`);
  if (bad) parts.push(`[아쉬웠던 점]\n${bad}`);
  if (tip) parts.push(`[여행 팁]\n${tip}`);
  return parts.join("\n\n");
}
```

---

## 6. reviews lib 계층 전체 코드

**파일:** `src/lib/reviews.ts`

```ts
import { supabase } from "@/lib/supabase";
import type { Review, ReviewStatus } from "@/types/review";

function normalizeReview(row: Record<string, unknown>): Review {
  const imageUrls = Array.isArray(row.image_urls)
    ? row.image_urls.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  const legacyImageUrl = typeof row.image_url === "string" ? row.image_url : undefined;

  const status = typeof row.status === "string" ? row.status : undefined;
  const validStatuses = ["draft", "submitted", "hidden"];

  const parseRating = (val: unknown): number | undefined => {
    if (typeof val === "number" && Number.isFinite(val) && val >= 1 && val <= 5) {
      return Math.round(val);
    }
    return undefined;
  };

  return {
    id: String(row.id ?? ""),
    member_id: typeof row.member_id === "string" ? row.member_id : undefined,
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    image_url: legacyImageUrl,
    image_urls: imageUrls.length > 0 ? imageUrls : legacyImageUrl ? [legacyImageUrl] : [],
    author_name: String(row.author_name ?? ""),
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
    rating: parseRating(row.rating),
    status: status && validStatuses.includes(status) ? (status as Review["status"]) : undefined,
    eligibility_id: typeof row.eligibility_id === "string" ? row.eligibility_id : undefined,
    booking_id: typeof row.booking_id === "string" ? row.booking_id : undefined,
    customer_profile_id: typeof row.customer_profile_id === "string" ? row.customer_profile_id : undefined,
    summary: typeof row.summary === "string" ? row.summary : undefined,
    content_good: typeof row.content_good === "string" ? row.content_good : undefined,
    content_bad: typeof row.content_bad === "string" ? row.content_bad : undefined,
    content_tip: typeof row.content_tip === "string" ? row.content_tip : undefined,
    rating_schedule: parseRating(row.rating_schedule),
    rating_stay: parseRating(row.rating_stay),
    rating_guide: parseRating(row.rating_guide),
    rating_food: parseRating(row.rating_food),
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

/** 마이페이지용: 특정 회원이 작성한 리뷰만 조회 (member_id 일치) */
export async function getReviewsByMemberId(memberId: string): Promise<Review[]> {
  if (!memberId) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) return [];
  return (data ?? []).map((row) => normalizeReview(row as Record<string, unknown>));
}

/**
 * 마이페이지용: 작성 완료(submitted) 리뷰 조회.
 * status 컬럼이 있으면 submitted만 조회, 없으면 전체 조회(하위호환).
 */
export async function getSubmittedReviewsByMemberId(memberId: string): Promise<Review[]> {
  if (!memberId) return [];

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("member_id", memberId)
    .eq("status", "submitted")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return getReviewsByMemberId(memberId);
  }

  return (data ?? []).map((row) => normalizeReview(row as Record<string, unknown>));
}

/**
 * 마이페이지용: 임시저장(draft) 리뷰 조회.
 * status 컬럼이 있으면 draft만 조회, 없으면 빈 배열(하위호환).
 */
export async function getDraftReviewsByMemberId(memberId: string): Promise<Review[]> {
  if (!memberId) return [];

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("member_id", memberId)
    .eq("status", "draft")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => normalizeReview(row as Record<string, unknown>));
}

/** 리뷰 ID로 단건 조회 */
export async function getReviewById(reviewId: string): Promise<Review | null> {
  if (!reviewId) return null;
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("id", reviewId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeReview(data as Record<string, unknown>);
}

/** 특정 eligibility_id로 제출된 리뷰가 있는지 조회 */
export async function getReviewByEligibilityId(eligibilityId: string): Promise<Review | null> {
  if (!eligibilityId) return null;
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("eligibility_id", eligibilityId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeReview(data as Record<string, unknown>);
}

/** 특정 eligibility_id로 draft 또는 submitted 상태인 리뷰 조회 */
export async function getDraftOrReviewByEligibilityId(eligibilityId: string): Promise<Review | null> {
  if (!eligibilityId) return null;
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("eligibility_id", eligibilityId)
    .in("status", ["draft", "submitted"])
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeReview(data as Record<string, unknown>);
}

/** Draft 리뷰 입력 타입 */
export type DraftReviewInput = {
  memberId: string;
  authorName: string;
  eligibilityId?: string;
  bookingId?: string;
  customerProfileId?: string;
  title?: string;
  content?: string;
  summary?: string;
  contentGood?: string;
  contentBad?: string;
  contentTip?: string;
  rating?: number;
  ratingSchedule?: number;
  ratingStay?: number;
  ratingGuide?: number;
  ratingFood?: number;
  imageUrls?: string[];
};

/**
 * Draft 리뷰 저장 (신규 생성 또는 기존 업데이트).
 * eligibility 기반일 경우 기존 draft가 있으면 업데이트, 없으면 생성.
 */
export async function saveDraftReview(
  input: DraftReviewInput,
): Promise<{ success: boolean; reviewId?: string; error?: string }> {
  const { memberId, authorName, eligibilityId } = input;

  if (!memberId || !authorName) {
    return { success: false, error: "invalid_member" };
  }

  const payload: Record<string, unknown> = {
    member_id: memberId,
    author_name: authorName,
    status: "draft" as ReviewStatus,
    title: input.title?.trim() || "",
    content: input.content?.trim() || "",
    summary: input.summary?.trim() || null,
    content_good: input.contentGood?.trim() || null,
    content_bad: input.contentBad?.trim() || null,
    content_tip: input.contentTip?.trim() || null,
    rating: input.rating ?? null,
    rating_schedule: input.ratingSchedule ?? null,
    rating_stay: input.ratingStay ?? null,
    rating_guide: input.ratingGuide ?? null,
    rating_food: input.ratingFood ?? null,
    image_urls: input.imageUrls ?? [],
    image_url: input.imageUrls?.[0] ?? null,
    updated_at: new Date().toISOString(),
  };

  if (eligibilityId) {
    payload.eligibility_id = eligibilityId;
    payload.booking_id = input.bookingId ?? null;
    payload.customer_profile_id = input.customerProfileId ?? null;

    const existing = await getReviewByEligibilityId(eligibilityId);
    if (existing) {
      if (existing.status === "submitted") {
        return { success: false, error: "already_submitted" };
      }
      const { error } = await supabase
        .from("reviews")
        .update(payload)
        .eq("id", existing.id);

      if (error) {
        return { success: false, error: "update_failed" };
      }
      return { success: true, reviewId: existing.id };
    }
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: "insert_failed" };
  }

  return { success: true, reviewId: String(data.id) };
}

/**
 * Draft 리뷰를 submitted로 전환하여 제출 완료 처리.
 */
export async function submitReview(
  reviewId: string,
  updateData?: Partial<DraftReviewInput>,
): Promise<{ success: boolean; error?: string }> {
  if (!reviewId) {
    return { success: false, error: "invalid_review_id" };
  }

  const existing = await getReviewById(reviewId);
  if (!existing) {
    return { success: false, error: "not_found" };
  }

  if (existing.status === "submitted") {
    return { success: false, error: "already_submitted" };
  }

  const payload: Record<string, unknown> = {
    status: "submitted" as ReviewStatus,
    updated_at: new Date().toISOString(),
  };

  if (updateData) {
    if (updateData.title !== undefined) payload.title = updateData.title.trim();
    if (updateData.content !== undefined) payload.content = updateData.content.trim();
    if (updateData.summary !== undefined) payload.summary = updateData.summary.trim() || null;
    if (updateData.contentGood !== undefined) payload.content_good = updateData.contentGood.trim() || null;
    if (updateData.contentBad !== undefined) payload.content_bad = updateData.contentBad.trim() || null;
    if (updateData.contentTip !== undefined) payload.content_tip = updateData.contentTip.trim() || null;
    if (updateData.rating !== undefined) payload.rating = updateData.rating ?? null;
    if (updateData.ratingSchedule !== undefined) payload.rating_schedule = updateData.ratingSchedule ?? null;
    if (updateData.ratingStay !== undefined) payload.rating_stay = updateData.ratingStay ?? null;
    if (updateData.ratingGuide !== undefined) payload.rating_guide = updateData.ratingGuide ?? null;
    if (updateData.ratingFood !== undefined) payload.rating_food = updateData.ratingFood ?? null;
    if (updateData.imageUrls !== undefined) {
      payload.image_urls = updateData.imageUrls;
      payload.image_url = updateData.imageUrls[0] ?? null;
    }
  }

  const { error } = await supabase
    .from("reviews")
    .update(payload)
    .eq("id", reviewId);

  if (error) {
    return { success: false, error: "update_failed" };
  }

  return { success: true };
}

/** 리뷰 업데이트 (draft 상태에서만 가능) */
export async function updateDraftReview(
  reviewId: string,
  memberId: string,
  updateData: Partial<DraftReviewInput>,
): Promise<{ success: boolean; error?: string }> {
  if (!reviewId || !memberId) {
    return { success: false, error: "invalid_params" };
  }

  const existing = await getReviewById(reviewId);
  if (!existing) {
    return { success: false, error: "not_found" };
  }

  if (existing.member_id !== memberId) {
    return { success: false, error: "unauthorized" };
  }

  if (existing.status === "submitted") {
    return { success: false, error: "already_submitted" };
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updateData.title !== undefined) payload.title = updateData.title.trim();
  if (updateData.content !== undefined) payload.content = updateData.content.trim();
  if (updateData.summary !== undefined) payload.summary = updateData.summary.trim() || null;
  if (updateData.contentGood !== undefined) payload.content_good = updateData.contentGood.trim() || null;
  if (updateData.contentBad !== undefined) payload.content_bad = updateData.contentBad.trim() || null;
  if (updateData.contentTip !== undefined) payload.content_tip = updateData.contentTip.trim() || null;
  if (updateData.rating !== undefined) payload.rating = updateData.rating ?? null;
  if (updateData.ratingSchedule !== undefined) payload.rating_schedule = updateData.ratingSchedule ?? null;
  if (updateData.ratingStay !== undefined) payload.rating_stay = updateData.ratingStay ?? null;
  if (updateData.ratingGuide !== undefined) payload.rating_guide = updateData.ratingGuide ?? null;
  if (updateData.ratingFood !== undefined) payload.rating_food = updateData.ratingFood ?? null;
  if (updateData.imageUrls !== undefined) {
    payload.image_urls = updateData.imageUrls;
    payload.image_url = updateData.imageUrls[0] ?? null;
  }

  const { error } = await supabase
    .from("reviews")
    .update(payload)
    .eq("id", reviewId);

  if (error) {
    return { success: false, error: "update_failed" };
  }

  return { success: true };
}
```

---

## 7. 마이페이지 리뷰 페이지 전체 코드

**파일:** `src/app/mypage/reviews/page.tsx`

```tsx
import { cookies } from "next/headers";
import Link from "next/link";
import MyPageLayout from "@/components/mypage/MyPageLayout";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getMyPageReviewSections } from "@/lib/mypageReviews";
import type {
  MyPageWritableReviewItem,
  MyPageDraftReviewItem,
  MyPageSubmittedReviewItem,
} from "@/types/review";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

function formatDateRange(departure?: string | null, returnDate?: string | null) {
  if (!departure && !returnDate) return null;
  const from = formatDate(departure);
  const to = formatDate(returnDate);
  if (from === "-" && to === "-") return null;
  return `${from} ~ ${to}`;
}

function StatusBadge({ label, variant }: { label: string; variant: "writable" | "draft" | "submitted" }) {
  const colors = {
    writable: "bg-blue-100 text-blue-700",
    draft: "bg-amber-100 text-amber-700",
    submitted: "bg-green-100 text-green-700",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[variant]}`}>
      {label}
    </span>
  );
}

function WritableReviewCard({ item }: { item: MyPageWritableReviewItem }) {
  const dateRange = formatDateRange(item.departure_date, item.return_date);
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <StatusBadge label="작성 가능" variant="writable" />
        </div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {item.product_title || "상품명 없음"}
        </p>
        {dateRange && (
          <p className="text-xs text-[var(--text-secondary)]">여행일정: {dateRange}</p>
        )}
        <p className="text-xs text-[var(--text-muted)]">
          후기 가능일: {formatDate(item.review_open_at)}
        </p>
      </div>
      <Link
        href={`/reviews/write?eligibility=${item.eligibility_id}`}
        className="inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--primary-dark)]"
      >
        후기 작성
      </Link>
    </article>
  );
}

function DraftReviewCard({ item }: { item: MyPageDraftReviewItem }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <StatusBadge label="작성 중" variant="draft" />
        </div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {item.title || "제목 없는 임시저장 후기"}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          마지막 저장: {formatDate(item.updated_at || item.created_at)}
        </p>
      </div>
      <Link
        href={item.eligibility_id ? `/reviews/write?eligibility=${item.eligibility_id}` : `/reviews/write?review=${item.review_id}`}
        className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
      >
        이어쓰기
      </Link>
    </article>
  );
}

function SubmittedReviewCard({ item }: { item: MyPageSubmittedReviewItem }) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <StatusBadge label="작성 완료" variant="submitted" />
            {typeof item.rating === "number" && (
              <span className="text-xs text-amber-500">
                {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            작성일: {formatDate(item.created_at)}
          </p>
          <p className="mt-2 line-clamp-2 text-xs text-[var(--text-secondary)]">
            {item.content}
          </p>
        </div>
        <Link
          href={`/mypage/reviews/${item.id}`}
          className="shrink-0 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
        >
          보기
        </Link>
      </div>
    </article>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
      <p className="text-xs text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-center">
      <p className="text-xs text-[var(--text-muted)]">{message}</p>
    </div>
  );
}

export default async function MyPageReviewsPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  const sections = session
    ? await getMyPageReviewSections(session.memberId)
    : { writable: [], drafts: [], submitted: [] };

  const hasAnyData =
    sections.writable.length > 0 ||
    sections.drafts.length > 0 ||
    sections.submitted.length > 0;

  return (
    <MyPageLayout title="리뷰 관리" description="내 후기를 작성하고 관리할 수 있습니다.">
      {!hasAnyData ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            아직 연결된 후기 항목이 없습니다.
          </p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            여행 완료 후 후기를 남길 수 있는 상품이 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 작성 가능한 후기 */}
          <section>
            <SectionHeader
              title="작성 가능한 후기"
              description="여행을 마친 상품의 후기를 작성할 수 있습니다."
            />
            {sections.writable.length === 0 ? (
              <EmptyMessage message="현재 작성 가능한 후기가 없습니다." />
            ) : (
              <div className="space-y-3">
                {sections.writable.map((item) => (
                  <WritableReviewCard key={item.eligibility_id} item={item} />
                ))}
              </div>
            )}
          </section>

          {/* 작성 중인 후기 */}
          <section>
            <SectionHeader
              title="작성 중인 후기"
              description="임시저장된 후기를 이어서 작성하세요."
            />
            {sections.drafts.length === 0 ? (
              <EmptyMessage message="임시저장된 후기가 없습니다." />
            ) : (
              <div className="space-y-3">
                {sections.drafts.map((item) => (
                  <DraftReviewCard key={item.review_id} item={item} />
                ))}
              </div>
            )}
          </section>

          {/* 작성 완료 후기 */}
          <section>
            <SectionHeader
              title="작성 완료 후기"
              description="이미 등록한 후기를 확인할 수 있습니다."
            />
            {sections.submitted.length === 0 ? (
              <EmptyMessage message="아직 작성 완료한 후기가 없습니다." />
            ) : (
              <div className="space-y-3">
                {sections.submitted.map((item) => (
                  <SubmittedReviewCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </MyPageLayout>
  );
}
```

---

## 8. mypageReviews helper 전체 코드

**파일:** `src/lib/mypageReviews.ts`

```ts
/**
 * 마이페이지 리뷰 섹션 데이터 조회.
 * writable / drafts / submitted 3섹션 데이터를 한 번에 조회.
 * 서버 컴포넌트에서 사용.
 */
import "server-only";

import { getWritableEligibilitiesByMemberId } from "@/lib/reviewEligibilities";
import {
  getDraftReviewsByMemberId,
  getSubmittedReviewsByMemberId,
  getReviewByEligibilityId,
} from "@/lib/reviews";
import type {
  MyPageWritableReviewItem,
  MyPageDraftReviewItem,
  MyPageSubmittedReviewItem,
} from "@/types/review";

export type MyPageReviewSections = {
  writable: MyPageWritableReviewItem[];
  drafts: MyPageDraftReviewItem[];
  submitted: MyPageSubmittedReviewItem[];
};

/**
 * 마이페이지 리뷰 3섹션 데이터 조회.
 * - writable: 작성 가능한 후기 (eligibility 기반, 아직 제출 안 된 것)
 * - drafts: 작성 중인 후기 (현재 DB에 status 컬럼 없어서 항상 빈 배열)
 * - submitted: 작성 완료 후기 (기존 member_id 기준 리뷰)
 */
export async function getMyPageReviewSections(
  memberId: string,
): Promise<MyPageReviewSections> {
  if (!memberId) {
    return { writable: [], drafts: [], submitted: [] };
  }

  const [eligibilities, draftReviews, submittedReviews] = await Promise.all([
    getWritableEligibilitiesByMemberId(memberId),
    getDraftReviewsByMemberId(memberId),
    getSubmittedReviewsByMemberId(memberId),
  ]);

  const writableItems: MyPageWritableReviewItem[] = [];
  for (const elig of eligibilities) {
    const existingReview = await getReviewByEligibilityId(elig.id);
    if (!existingReview) {
      writableItems.push({
        eligibility_id: elig.id,
        booking_id: elig.booking_id,
        customer_profile_id: elig.customer_profile_id,
        product_id: elig.product_id,
        product_title: elig.product_title,
        departure_date: elig.departure_date,
        return_date: elig.return_date,
        review_open_at: elig.review_open_at,
        has_submitted_review: false,
      });
    }
  }

  const draftItems: MyPageDraftReviewItem[] = draftReviews.map((r) => ({
    review_id: r.id,
    eligibility_id: r.eligibility_id,
    title: r.title || null,
    updated_at: r.created_at,
    created_at: r.created_at,
  }));

  const submittedItems: MyPageSubmittedReviewItem[] = submittedReviews.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    created_at: r.created_at,
    rating: r.rating,
    image_urls: r.image_urls,
  }));

  return {
    writable: writableItems,
    drafts: draftItems,
    submitted: submittedItems,
  };
}
```

---

## 9. 이미지 업로드 처리 코드

**파일:** `src/lib/reviewImageUpload.ts` (전체)

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

**ReviewWriteForm 내 이미지 처리 (요약):**
- 최대 개수: MAX_REVIEW_IMAGES = 10
- 썸네일: imagePreviewUrls (blob + 기존 URL), grid 3~5열, 첫 장에 "대표" 뱃지
- 개별 삭제: removeImage(index) — existingImageUrls / imageFiles 구분 제거
- 저장: buildPayload에서 imageFiles는 uploadReviewImage 후 URL 배열에 합쳐 image_urls로 전달

---

## 10. 리뷰 상세 페이지 전체 코드

**파일:** `src/app/mypage/reviews/[id]/page.tsx`

```tsx
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import MyPageLayout from "@/components/mypage/MyPageLayout";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getReviewById } from "@/lib/reviews";

type Props = {
  params: Promise<{ id: string }>;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StarDisplay({ rating, label }: { rating?: number; label: string }) {
  if (typeof rating !== "number") return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="text-amber-500">
        {"★".repeat(rating)}{"☆".repeat(5 - rating)}
      </span>
    </div>
  );
}

function ContentSection({ title, content }: { title: string; content?: string }) {
  if (!content) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{content}</p>
    </div>
  );
}

export default async function MyPageReviewDetailPage({ params }: Props) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  if (!session) {
    notFound();
  }

  const review = await getReviewById(id);

  if (!review) {
    notFound();
  }

  if (review.member_id !== session.memberId) {
    notFound();
  }

  const images = review.image_urls ?? (review.image_url ? [review.image_url] : []);
  const hasStructuredContent = review.content_good || review.content_bad || review.content_tip;
  const hasDetailRatings =
    review.rating_schedule || review.rating_stay || review.rating_guide || review.rating_food;

  return (
    <MyPageLayout title="후기 상세" description="작성한 후기의 상세 내용입니다.">
      <div className="space-y-6">
        <Link
          href="/mypage/reviews"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <span>←</span>
          <span>목록으로</span>
        </Link>

        <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <header className="mb-4 border-b border-[var(--border)] pb-4">
            <h1 className="text-lg font-bold text-[var(--text-primary)]">{review.title}</h1>
            {review.summary && (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{review.summary}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
              <span>작성자: {review.author_name}</span>
              <span>작성일: {formatDate(review.created_at)}</span>
              {typeof review.rating === "number" && (
                <span className="text-amber-500">
                  {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                  <span className="ml-1 text-[var(--text-muted)]">({review.rating}점)</span>
                </span>
              )}
            </div>
          </header>

          {hasDetailRatings && (
            <div className="mb-4 rounded-lg bg-slate-50 p-4">
              <h3 className="mb-2 text-xs font-medium text-[var(--text-muted)]">세부 평점</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StarDisplay rating={review.rating_schedule} label="일정" />
                <StarDisplay rating={review.rating_stay} label="숙소" />
                <StarDisplay rating={review.rating_guide} label="가이드" />
                <StarDisplay rating={review.rating_food} label="식사" />
              </div>
            </div>
          )}

          {images.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {images.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className="relative aspect-square overflow-hidden rounded-lg ring-1 ring-[var(--border)]"
                >
                  <Image
                    src={url}
                    alt={`후기 이미지 ${index + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {hasStructuredContent ? (
            <div className="space-y-4">
              <ContentSection title="좋았던 점" content={review.content_good} />
              <ContentSection title="아쉬웠던 점" content={review.content_bad} />
              <ContentSection title="여행 팁" content={review.content_tip} />
              {review.content && !isGeneratedContent(review.content, review) && (
                <ContentSection title="추가 내용" content={review.content} />
              )}
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-[var(--text-primary)]">
              <p className="whitespace-pre-wrap">{review.content}</p>
            </div>
          )}
        </article>
      </div>
    </MyPageLayout>
  );
}

function isGeneratedContent(
  content: string,
  review: { content_good?: string; content_bad?: string; content_tip?: string },
): boolean {
  const parts: string[] = [];
  if (review.content_good) parts.push(`[좋았던 점]\n${review.content_good}`);
  if (review.content_bad) parts.push(`[아쉬웠던 점]\n${review.content_bad}`);
  if (review.content_tip) parts.push(`[여행 팁]\n${review.content_tip}`);
  const generated = parts.join("\n\n");
  return content.trim() === generated.trim();
}
```

---

## 11. 수정/추가 파일 목록 (PR5 관련)

**추가된 파일**
- (migration) supabase/migrations/20260307100000_reviews_eligibility_columns.sql
- (migration) supabase/migrations/20260307130000_reviews_draft_fields.sql
- (migration) supabase/migrations/20260308120000_reconcile_reviews_columns.sql
- src/lib/reviewImageUpload.ts

**수정된 파일**
- src/components/ReviewWriteForm.tsx
- src/app/reviews/write/page.tsx
- src/app/api/reviews/route.ts
- src/app/api/reviews/[id]/route.ts
- src/lib/reviews.ts
- src/app/mypage/reviews/page.tsx
- src/lib/mypageReviews.ts
- src/app/mypage/reviews/[id]/page.tsx
- src/types/review.ts (Review 타입 확장)

(실제 PR 커밋 범위는 저장소 이력으로 확인 필요.)

---

## 12. Cursor 구현 설명 (요약)

- **draft 저장 방식:** POST /api/reviews (status: "draft") 또는 PATCH /api/reviews/[id] (action: "save_draft"). 동일 eligibility에 draft가 있으면 PATCH로 같은 행 갱신.
- **draft → submitted 전환:** PATCH /api/reviews/[id] (action: "submit") 시 payload.status = "submitted", eligibility 있으면 updateEligibilityStatus(eligibilityId, "submitted"), 알림 생성.
- **이미지 업로드 UX:** ReviewWriteForm에서 File 선택 → uploadReviewImage(file)로 Supabase storage에 업로드 후 public URL을 image_urls에 추가. 최대 10장, 5MB/파일, jpeg/png/webp/gif. 첫 장이 대표 이미지.
- **eligibility 기반 제출 흐름:** /reviews/write?eligibility= 로 진입 → getEligibilityWithBookingById로 상품 정보·일정 표시, getReviewByEligibilityId로 기존 draft 있으면 이어쓰기. 제출 시 eligibility당 1건만 허용(unique index), 제출 완료 시 eligibility status를 submitted로 변경.
- **기존 리뷰 하위호환:** normalizeReview에서 image_url 단일 → image_urls 배열 보강, status 없으면 undefined(제출된 것으로 간주). 상세 페이지에서 content 단일 필드·image_url 단일 필드 fallback 유지.

---

## 13. 테스트 시나리오 제안

1. **eligibility 기반 draft 저장**
   - 마이페이지에서 "작성 가능한 후기" → "후기 작성" → 제목·요약·만족도·좋았던 점만 입력 후 "임시저장"
   - 응답에 review_id 있음, 같은 eligibility로 다시 진입 시 이어쓰기 폼 로드

2. **draft 이어쓰기**
   - /reviews/write?review=[draft_id] 또는 /reviews/write?eligibility=[id] 로 진입
   - initialData에 draft 내용·image_urls 반영되는지 확인
   - 추가 수정 후 다시 "임시저장" → PATCH로 동일 id 갱신

3. **draft → submitted 전환**
   - draft 상태에서 필수 항목 채운 뒤 "후기 등록" → PATCH action: "submit"
   - status가 submitted로 변경, eligibility status가 submitted로 변경, 마이페이지 "작성 완료 후기"에 노출

4. **이미지 여러 장 업로드**
   - "사진 추가"로 2~10장 선택, 썸네일·대표 뱃지·개별 삭제 동작 확인
   - 임시저장 또는 제출 후 DB image_urls 및 상세 페이지 갤러리 확인

5. **마이페이지 반영**
   - 작성 가능한 후기: eligibility 있고 아직 리뷰 없음
   - 작성 중인 후기: status=draft 리뷰, "이어쓰기" 링크
   - 작성 완료 후기: status=submitted 리뷰, summary/rating/image_urls 표시

6. **유효하지 않은 eligibility / 이미 제출된 경우**
   - /reviews/write?eligibility=invalid → "유효하지 않은 후기 작성 링크" 안내
   - 이미 제출된 eligibility → "이미 작성 완료된 후기" 안내, 폼 비노출
