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
