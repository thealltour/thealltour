"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  FormEvent,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import imageCompression from "browser-image-compression";
import { uploadReviewImage } from "@/lib/reviewImageUpload";
import {
  MAX_REVIEW_IMAGES,
  MAX_REVIEW_IMAGE_SIZE_MB,
  REVIEW_IMAGE_ALLOWED_MIME_TYPES,
} from "@/lib/constants/review";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Button, buttonVariants } from "@/components/ui/Button";
import type { Review } from "@/types/review";
import type { ReviewImageItem } from "@/types/review";
import { DEFAULT_REVIEW_WRITE_POINTS } from "@/lib/reviewRewardConstants";

const AUTO_SAVE_DEBOUNCE_MS = 5000;
const CLIENT_IMAGE_MAX_WIDTH = 1600;
const CLIENT_IMAGE_QUALITY = 0.85;

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

const RATING_LABELS: Record<number, string> = {
  1: "많이 아쉬웠어요",
  2: "아쉬웠어요",
  3: "보통이었어요",
  4: "만족했어요",
  5: "정말 만족했어요",
};

function StarRating({
  value,
  onChange,
  label,
  size = "md",
  guideText,
  error,
  showScoreLabels,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  size?: "sm" | "md";
  guideText?: string;
  error?: string;
  showScoreLabels?: boolean;
}) {
  const starSize = size === "sm" ? "text-lg" : "text-3xl";
  const touchClass = "min-h-[48px] min-w-[48px] flex items-center justify-center rounded-lg transition-colors";
  return (
    <div className="flex flex-col gap-1">
      <span className="type-small font-medium text-content-secondary">{label}</span>
      {guideText && (
        <p className="mb-1 type-caption text-content-muted">{guideText}</p>
      )}
      <div className="inline-flex items-center gap-1 sm:gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(value === star ? null : star)}
            className={`${starSize} ${touchClass} leading-none select-none ${
              value !== null && star <= value
                ? "text-amber-400 hover:text-amber-500"
                : "text-slate-300 hover:text-amber-200 hover:bg-amber-50/80 active:text-amber-400"
            }`}
            aria-label={`${star}점`}
          >
            ★
          </button>
        ))}
        {value != null && (
          <span className="ml-2 type-small font-medium text-slate-600 self-center">
            {showScoreLabels ? RATING_LABELS[value] : `${value}점`}
          </span>
        )}
      </div>
      {value == null && showScoreLabels && (
        <p className="mt-0.5 type-caption text-content-muted">별을 눌러 만족도를 선택해 주세요</p>
      )}
      {error && <p className="mt-1 type-caption text-red-600" role="alert">{error}</p>}
    </div>
  );
}

function imageUrlsToItems(urls: string[]): ReviewImageItem[] {
  return urls.map((url, i) => ({ id: `url-${i}-${url.slice(-8)}`, url, file: undefined }));
}

export default function ReviewWriteForm({
  eligibilityId,
  reviewId,
  initialData,
  productInfo,
}: Props) {
  const router = useRouter();
  const imageInputId = useId();
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

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

  const [imageItems, setImageItems] = useState<ReviewImageItem[]>(() =>
    imageUrlsToItems(initialData?.image_urls ?? []),
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [currentReviewId, setCurrentReviewId] = useState<string | undefined>(reviewId);
  const [submitSuccessModal, setSubmitSuccessModal] = useState<{ reviewId: string; pointsAwarded?: number } | null>(null);

  const formDataRef = useRef(formData);
  const imageItemsRef = useRef(imageItems);
  const currentReviewIdRef = useRef(currentReviewId);
  formDataRef.current = formData;
  imageItemsRef.current = imageItems;
  currentReviewIdRef.current = currentReviewId;

  const isEligibilityBased = !!eligibilityId;
  const hasAnyContent =
    formData.summary.trim() !== "" ||
    formData.contentGood.trim() !== "" ||
    formData.contentBad.trim() !== "" ||
    formData.contentTip.trim() !== "" ||
    formData.content.trim() !== "" ||
    imageItems.length > 0;

  const progress = useMemo(() => {
    const hasRating = formData.rating != null;
    const hasSummary = formData.summary.trim().length > 0;
    const hasContent =
      formData.contentGood.trim() !== "" ||
      formData.contentBad.trim() !== "" ||
      formData.contentTip.trim() !== "" ||
      formData.content.trim() !== "";
    const hasImages = imageItems.length > 0;
    const filled = [hasRating, hasSummary, hasContent, hasImages].filter(Boolean).length;
    const percent = Math.round((filled / 4) * 100);
    return { hasRating, hasSummary, hasContent, hasImages, percent };
  }, [formData.rating, formData.summary, formData.contentGood, formData.contentBad, formData.contentTip, formData.content, imageItems.length]);

  useEffect(() => {
    return () => {
      const items = imageItemsRef.current;
      if (Array.isArray(items)) {
        items.forEach((item) => {
          if (item?.url?.startsWith("blob:")) URL.revokeObjectURL(item.url);
        });
      }
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const buildPayload = useCallback(async (reviewId: string | null, isDraft: boolean) => {
    const urls = await Promise.all(
      imageItems.map((item, i) =>
        item.file
          ? (reviewId
              ? uploadReviewImage(item.file, reviewId, i)
              : Promise.reject(new Error("이미지 업로드를 위해 먼저 임시저장해 주세요.")))
          : Promise.resolve(item.url),
      ),
    );
    return {
      title: formData.title || formData.summary?.slice(0, 50) || "후기",
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
      image_urls: urls,
      eligibility_id: eligibilityId || undefined,
      status: isDraft ? "draft" : "submitted",
    };
  }, [formData, imageItems, eligibilityId]);

  const validateForSubmit = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (isEligibilityBased) {
      if (formData.rating == null) errors.rating = "전체 만족도를 선택해 주세요.";
      const hasContent =
        formData.contentGood.trim() !== "" ||
        formData.contentBad.trim() !== "" ||
        formData.contentTip.trim() !== "" ||
        formData.content.trim() !== "";
      if (!formData.summary.trim() && !formData.title?.trim() && !hasContent) {
        errors.content = "여행 경험을 조금만 더 남겨주세요.";
      }
    } else {
      if (!formData.title.trim()) errors.title = "제목을 입력해 주세요.";
      if (!formData.content.trim()) errors.content = "내용을 입력해 주세요.";
    }
    setFieldErrors(errors);
    setErrorMessage(Object.values(errors)[0] ?? "");
    return Object.keys(errors).length === 0;
  }, [isEligibilityBased, formData]);

  useEffect(() => {
    if (!hasAnyContent || isSubmitting || isSavingDraft) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      autoSaveTimerRef.current = null;
      const fd = formDataRef.current;
      const items = imageItemsRef.current;
      const payloadKey = JSON.stringify({
        title: fd.title,
        summary: fd.summary,
        content: fd.content,
        contentGood: fd.contentGood,
        contentBad: fd.contentBad,
        contentTip: fd.contentTip,
        rating: fd.rating,
        imageCount: items.length,
      });
      if (payloadKey === lastSavedRef.current) return;
      setDraftStatus("saving");
      try {
        let reviewId = currentReviewIdRef.current ?? null;
        if (items.some((i) => i.file) && !reviewId) {
          const createRes = await fetch("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: fd.title || fd.summary?.slice(0, 50) || "후기",
              content: fd.content,
              summary: fd.summary,
              content_good: fd.contentGood,
              content_bad: fd.contentBad,
              content_tip: fd.contentTip,
              rating: fd.rating,
              rating_schedule: fd.ratingSchedule,
              rating_stay: fd.ratingStay,
              rating_guide: fd.ratingGuide,
              rating_food: fd.ratingFood,
              image_urls: [],
              eligibility_id: eligibilityId || undefined,
              status: "draft",
            }),
          });
          const createData = (await createRes.json()) as { review_id?: string };
          if (createData.review_id) {
            reviewId = createData.review_id;
            currentReviewIdRef.current = createData.review_id;
            setCurrentReviewId(createData.review_id);
          } else {
            setDraftStatus("idle");
            return;
          }
        }
        const urls = await Promise.all(
          items.map((item, i) =>
            item.file
              ? (reviewId
                  ? uploadReviewImage(item.file, reviewId, i)
                  : Promise.resolve(item.url))
              : Promise.resolve(item.url),
          ),
        );
        const payload = {
          title: fd.title || fd.summary?.slice(0, 50) || "후기",
          content: fd.content,
          summary: fd.summary,
          content_good: fd.contentGood,
          content_bad: fd.contentBad,
          content_tip: fd.contentTip,
          rating: fd.rating,
          rating_schedule: fd.ratingSchedule,
          rating_stay: fd.ratingStay,
          rating_guide: fd.ratingGuide,
          rating_food: fd.ratingFood,
          image_urls: urls,
          eligibility_id: eligibilityId || undefined,
          status: "draft" as const,
        };
        const url = reviewId ? `/api/reviews/${reviewId}` : "/api/reviews";
        const method = reviewId ? "PATCH" : "POST";
        if (reviewId) Object.assign(payload, { action: "save_draft" });
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const result = (await res.json()) as { message?: string; review_id?: string };
        if (!res.ok) return;
        if (result.review_id && !reviewId) {
          currentReviewIdRef.current = result.review_id;
          setCurrentReviewId(result.review_id);
        }
        lastSavedRef.current = payloadKey;
        setDraftStatus("saved");
        setTimeout(() => setDraftStatus("idle"), 2000);
        items.forEach((item) => { if (item.url.startsWith("blob:")) URL.revokeObjectURL(item.url); });
        setImageItems(imageUrlsToItems(payload.image_urls ?? []));
      } catch {
        setDraftStatus("idle");
      }
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [hasAnyContent, isSubmitting, isSavingDraft, eligibilityId]);

  const handleSaveDraft = async () => {
    setErrorMessage("");
    setFieldErrors({});
    setIsSavingDraft(true);
    setDraftStatus("saving");
    try {
      let reviewId = currentReviewId ?? null;
      if (imageItems.some((i) => i.file) && !reviewId) {
        const createRes = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title || formData.summary?.slice(0, 50) || "후기",
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
            image_urls: [],
            eligibility_id: eligibilityId || undefined,
            status: "draft",
          }),
        });
        const createData = (await createRes.json()) as { review_id?: string };
        if (createData.review_id) {
          reviewId = createData.review_id;
          setCurrentReviewId(createData.review_id);
        }
      }
      const payload = await buildPayload(reviewId, true);
      const finalUrl = reviewId ? `/api/reviews/${reviewId}` : "/api/reviews";
      if (reviewId) Object.assign(payload, { action: "save_draft" });
      const response = await fetch(finalUrl, {
        method: reviewId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string; review_id?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "임시저장에 실패했습니다.");
        return;
      }
      if (result.review_id && !currentReviewId) setCurrentReviewId(result.review_id);
      lastSavedRef.current = JSON.stringify({ title: formData.title, summary: formData.summary, imageCount: imageItems.length });
      setDraftStatus("saved");
      setTimeout(() => setDraftStatus("idle"), 3000);
      const finalImageUrls = payload.image_urls ?? [];
      imageItems.forEach((item) => {
        if (item.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
      });
      setImageItems(imageUrlsToItems(finalImageUrls));
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "임시저장 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setFieldErrors({});
    if (!validateForSubmit()) return;
    setIsSubmitting(true);
    try {
      let reviewId = currentReviewId ?? null;
      if (imageItems.some((i) => i.file) && !reviewId) {
        const createRes = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title || formData.summary?.slice(0, 50) || "후기",
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
            image_urls: [],
            eligibility_id: eligibilityId || undefined,
            status: "draft",
          }),
        });
        const createData = (await createRes.json()) as { review_id?: string };
        if (createData.review_id) {
          reviewId = createData.review_id;
          setCurrentReviewId(createData.review_id);
        }
      }
      const payload = await buildPayload(reviewId, false);
      const finalUrl = reviewId ? `/api/reviews/${reviewId}` : "/api/reviews";
      if (reviewId) Object.assign(payload, { action: "submit" });
      const response = await fetch(finalUrl, {
        method: reviewId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        message?: string;
        eligibility_based?: boolean;
        review_id?: string;
        rewardCreated?: boolean;
        pointsAwarded?: number;
      };
      if (!response.ok) {
        setErrorMessage(result.message ?? "후기 등록에 실패했습니다.");
        return;
      }
      const rid = result.review_id;
      const pointsAwarded =
        result.pointsAwarded ?? (result.rewardCreated ? DEFAULT_REVIEW_WRITE_POINTS : undefined);
      if (rid) {
        setSubmitSuccessModal({ reviewId: rid, pointsAwarded });
        return;
      }
      if (eligibilityId || result.eligibility_based) router.push("/mypage/reviews");
      else router.push("/reviews");
      router.refresh();
    } catch {
      setErrorMessage("후기 등록 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateFiles = (files: File[]): string | null => {
    for (const file of files) {
      if (!REVIEW_IMAGE_ALLOWED_MIME_TYPES.includes(file.type)) return `지원하지 않는 파일 형식입니다: ${file.name}`;
      if (file.size > MAX_REVIEW_IMAGE_SIZE_MB * 1024 * 1024) return `파일 크기가 너무 큽니다 (최대 ${MAX_REVIEW_IMAGE_SIZE_MB}MB): ${file.name}`;
    }
    return null;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;
    if (imageItems.length + selected.length > MAX_REVIEW_IMAGES) {
      setErrorMessage(`이미지는 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.`);
      return;
    }
    const err = validateFiles(selected);
    if (err) {
      setErrorMessage(err);
      return;
    }
    setErrorMessage("");
    const compressed = await Promise.all(
      selected.map(async (file, i) => {
        try {
          return await imageCompression(file, {
            maxWidthOrHeight: CLIENT_IMAGE_MAX_WIDTH,
            initialQuality: CLIENT_IMAGE_QUALITY,
            useWebWorker: true,
          });
        } catch {
          return file;
        }
      }),
    );
    const newItems: ReviewImageItem[] = compressed.map((file, i) => ({
      id: `file-${Date.now()}-${i}`,
      url: URL.createObjectURL(file),
      file,
    }));
    setImageItems((prev) => [...prev, ...newItems]);
    event.target.value = "";
  };

  const removeImage = (index: number) => {
    const item = imageItems[index];
    if (item?.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
    setImageItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over == null || active.id === over.id) return;
    const oldIndex = imageItems.findIndex((i) => i.id === active.id);
    const newIndex = imageItems.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setImageItems((prev) => arrayMove(prev, oldIndex, newIndex));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: () => ({ x: 0, y: 0 }) }),
  );

  useEffect(() => {
    const key = "beforeunload";
    const handler = (e: BeforeUnloadEvent) => {
      if (hasAnyContent) e.preventDefault();
    };
    window.addEventListener(key, handler);
    return () => window.removeEventListener(key, handler);
  }, [hasAnyContent]);

  const updateFormData = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }, []);

  return (
    <div className="space-y-5 pb-24 md:pb-8">
      {productInfo?.title && (
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
          <p className="text-sm font-medium text-blue-600">이번 여행 후기</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">{productInfo.title}</h2>
          {(productInfo.departureDate || productInfo.returnDate) && (
            <p className="mt-1 text-sm text-slate-600">
              여행 일정: {formatDate(productInfo.departureDate)} ~ {formatDate(productInfo.returnDate)}
            </p>
          )}
          <p className="mt-3 text-sm text-slate-600">
            이번 여행은 어떠셨나요? 여행 경험을 공유하면 다른 여행자에게 큰 도움이 됩니다.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium text-slate-500">작성 진행률</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-slate-700">{progress.percent}%</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className={progress.hasRating ? "text-green-600" : ""}>★ 만족도</span>
          <span className={progress.hasSummary ? "text-green-600" : ""}>한줄 요약</span>
          <span className={progress.hasContent ? "text-green-600" : ""}>여행 경험</span>
          <span className={progress.hasImages ? "text-green-600" : ""}>사진</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          별점, 한줄 요약, 여행 경험은 필수입니다. 사진은 선택 항목입니다. 지금 작성한 내용은 임시저장할 수 있습니다.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">STEP 1</p>
          <h3 className="text-lg font-bold text-slate-900">전체 만족도</h3>
          <div className="mt-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/60">
            <StarRating
              value={formData.rating}
              onChange={(v) => updateFormData("rating", v)}
              label="전체 여행 만족도를 평가해 주세요"
              size="md"
              guideText="별을 탭하여 선택하세요."
              showScoreLabels
              error={fieldErrors.rating}
            />
          </div>
          {isEligibilityBased && (
            <div className="mt-3 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-4">
              <StarRating value={formData.ratingSchedule} onChange={(v) => updateFormData("ratingSchedule", v)} label="일정" size="sm" />
              <StarRating value={formData.ratingStay} onChange={(v) => updateFormData("ratingStay", v)} label="숙소" size="sm" />
              <StarRating value={formData.ratingGuide} onChange={(v) => updateFormData("ratingGuide", v)} label="가이드" size="sm" />
              <StarRating value={formData.ratingFood} onChange={(v) => updateFormData("ratingFood", v)} label="식사" size="sm" />
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">STEP 2</p>
          <h3 className="text-lg font-bold text-slate-900">한줄 요약</h3>
          <p className="mt-1 text-xs text-slate-500">한줄 요약은 다른 여행자에게 후기를 빠르게 이해시키는 데 도움이 됩니다.</p>
          <Label className="mt-3 flex flex-col gap-2 text-content-secondary">
            <Input
              type="text"
              value={formData.summary}
              onChange={(e) => updateFormData("summary", e.target.value)}
              placeholder="이번 여행을 한 문장으로 표현해 주세요 (예: 부모님과 함께한 만족도 높은 효도여행이었어요)"
              className="rounded-xl"
            />
          </Label>
          {!isEligibilityBased && (
            <Label className="mt-3 flex flex-col gap-2 text-content-secondary">
              제목 (선택)
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => updateFormData("title", e.target.value)}
                placeholder="후기 제목을 입력해 주세요 (예: 치앙마이 골프 여행, 기대 이상이었습니다)"
                className="rounded-xl"
              />
            </Label>
          )}
          {isEligibilityBased && (
            <p className="mt-2 text-xs text-slate-500">제목은 선택 항목입니다.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">STEP 3</p>
          <h3 className="text-lg font-bold text-slate-900">여행 경험 작성</h3>
          <p className="mt-1 text-xs text-slate-500">
            일정, 숙소, 음식, 가이드, 이동 편의성 등을 자유롭게 적어주세요. 실제 경험이 담긴 후기는 다른 여행자에게 큰 도움이 됩니다.
          </p>

          {isEligibilityBased ? (
            <div className="mt-3 space-y-4">
              <div>
                <Label className="flex flex-col gap-2 text-content-secondary">
                  좋았던 점
                  <Textarea
                    rows={4}
                    value={formData.contentGood}
                    onChange={(e) => updateFormData("contentGood", e.target.value)}
                    placeholder="일정, 숙소, 가이드, 음식 등 좋았던 경험을 자유롭게 적어주세요."
                    className="min-h-[100px] rounded-xl"
                    error={!!fieldErrors.contentGood}
                  />
                </Label>
                <p className="mt-1 text-xs text-slate-500">특히 기억에 남는 경험을 적어주시면 다른 여행자에게 도움이 됩니다.</p>
              </div>
              <div>
                <Label className="flex flex-col gap-2 text-content-secondary">
                  아쉬웠던 점
                  <Textarea
                    rows={4}
                    value={formData.contentBad}
                    onChange={(e) => updateFormData("contentBad", e.target.value)}
                    placeholder="개선되면 더 좋을 점이 있었다면 알려주세요."
                    className="min-h-[100px] rounded-xl"
                    error={!!fieldErrors.contentBad}
                  />
                </Label>
                <p className="mt-1 text-xs text-slate-500">솔직한 의견은 더 좋은 여행 상품을 만드는 데 도움이 됩니다.</p>
              </div>
              <div>
                <Label className="flex flex-col gap-2 text-content-secondary">
                  여행 팁
                  <Textarea
                    rows={4}
                    value={formData.contentTip}
                    onChange={(e) => updateFormData("contentTip", e.target.value)}
                    placeholder="앞으로 여행할 분들에게 도움이 될 팁을 남겨주세요. (예: 준비물, 일정 팁, 현지 정보 등)"
                    className="min-h-[100px] rounded-xl"
                    error={!!fieldErrors.contentTip}
                  />
                </Label>
              </div>
              <details className="rounded-xl border border-slate-200 bg-slate-50">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100">자유 형식으로 더 쓰기</summary>
                <div className="border-t border-slate-200 px-4 pb-4 pt-3">
                  <Textarea
                    rows={4}
                    value={formData.content}
                    onChange={(e) => updateFormData("content", e.target.value)}
                    placeholder="형식에 구애받지 않고 자유롭게 적어주세요."
                    className="min-h-[80px] rounded-xl"
                  />
                </div>
              </details>
            </div>
          ) : (
            <div className="mt-3">
              <Label className="flex flex-col gap-2 text-content-secondary">
                내용
                <Textarea
                  required
                  rows={8}
                  value={formData.content}
                  onChange={(e) => updateFormData("content", e.target.value)}
                  placeholder="여행 경험을 자유롭게 적어주세요. 좋았던 점, 아쉬웠던 점, 팁 등을 함께 남겨주시면 더 도움이 됩니다."
                  className="min-h-[180px] rounded-xl"
                  error={!!fieldErrors.content}
                />
              </Label>
              {fieldErrors.content && <p className="mt-1 text-sm text-red-600" role="alert">{fieldErrors.content}</p>}
            </div>
          )}
          {fieldErrors.content && isEligibilityBased && (
            <p className="mt-2 text-sm text-red-600" role="alert">{fieldErrors.content}</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">STEP 4</p>
          <h3 className="text-lg font-bold text-slate-900">사진 업로드</h3>
          <p className="mt-1 text-sm text-slate-600">
            사진을 추가하면 더 생생한 후기가 됩니다. 최대 {MAX_REVIEW_IMAGES}장까지 업로드할 수 있으며, 사진은 선택 항목입니다.
          </p>
          <input
            id={imageInputId}
            type="file"
            multiple
            accept={REVIEW_IMAGE_ALLOWED_MIME_TYPES.join(",")}
            onChange={handleFileSelect}
            className="sr-only"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label
              htmlFor={imageInputId}
              className={buttonVariants({ variant: "secondary", size: "md", className: "cursor-pointer rounded-xl gap-2" })}
            >
              <span aria-hidden>📷</span>
              사진 추가 (최대 {MAX_REVIEW_IMAGES}장)
            </label>
            <span className="text-sm text-slate-500">
              {imageItems.length > 0 ? `${imageItems.length}장 선택됨` : "첨부된 사진이 없습니다. 사진을 추가하면 더 생생한 후기가 됩니다."}
            </span>
          </div>

          {imageItems.length > 0 && (
            <div className="mt-3">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={imageItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {imageItems.map((item, index) => (
                      <SortableImageThumb
                        key={item.id}
                        item={item}
                        index={index}
                        isFirst={index === 0}
                        onRemove={() => removeImage(index)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <p className="mt-2 text-xs text-slate-500">첫 번째 사진이 대표 이미지입니다. 드래그하여 순서를 바꿀 수 있습니다.</p>
            </div>
          )}
        </section>

        {errorMessage && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">{errorMessage}</div>
        )}
        {draftStatus === "saved" && (
          <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">임시 저장됨</div>
        )}

        <p className="text-center text-xs text-slate-500 sm:text-left">
          필수 항목: 별점, 한줄 요약, 여행 경험 · 사진은 선택입니다
        </p>
        <div className="hidden flex-col gap-3 sm:flex sm:flex-row sm:justify-end md:flex">
          <Button type="button" variant="secondary" disabled={isSavingDraft || isSubmitting} onClick={handleSaveDraft} className="rounded-xl px-6 py-3">
            {isSavingDraft || draftStatus === "saving" ? "저장 중..." : "임시저장"}
          </Button>
          <Button type="submit" disabled={isSubmitting || isSavingDraft} className="rounded-xl px-6 py-3">
            {isSubmitting ? "등록 중..." : "후기 등록"}
          </Button>
        </div>
      </form>

      <div className="fixed bottom-0 left-0 right-0 z-10 flex gap-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:hidden">
        <Button type="button" variant="secondary" disabled={isSavingDraft || isSubmitting} onClick={handleSaveDraft} className="flex-1 rounded-xl py-3">
          {isSavingDraft || draftStatus === "saving" ? "저장 중..." : "임시저장"}
        </Button>
        <Button
          type="button"
          disabled={isSubmitting || isSavingDraft}
          className="flex-1 rounded-xl py-3"
          onClick={() => {
            if (validateForSubmit()) {
              const form = document.querySelector("form");
              if (form) form.requestSubmit();
            }
          }}
        >
          {isSubmitting ? "등록 중..." : "후기 등록"}
        </Button>
      </div>

      {submitSuccessModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-success-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="submit-success-title" className="text-center text-xl font-bold text-slate-900">
              🎉 후기 등록 완료
            </h2>
            <p className="mt-3 text-center text-sm text-slate-600">
              여행 경험을 공유해주셔서 감사합니다.
            </p>
            {submitSuccessModal.pointsAwarded != null && submitSuccessModal.pointsAwarded > 0 && (
              <p className="mt-2 text-center text-sm font-semibold text-amber-600">
                {submitSuccessModal.pointsAwarded.toLocaleString()} 포인트가 지급되었습니다.
              </p>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                type="button"
                className="rounded-xl px-5 py-2.5"
                onClick={() => {
                  router.push(`/reviews/${submitSuccessModal.reviewId}`);
                  setSubmitSuccessModal(null);
                  router.refresh();
                }}
              >
                작성한 후기 보기
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl px-5 py-2.5"
                onClick={() => {
                  router.push(eligibilityId ? "/mypage/reviews" : "/reviews");
                  setSubmitSuccessModal(null);
                  router.refresh();
                }}
              >
                다른 후기 보기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableImageThumb({
  item,
  index,
  isFirst,
  onRemove,
}: {
  item: ReviewImageItem;
  index: number;
  isFirst: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${isDragging ? "z-10 shadow-lg ring-2 ring-blue-400" : ""}`}
    >
      {isFirst && (
        <span className="absolute left-1.5 top-1.5 z-10 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">대표</span>
      )}
      <button
        type="button"
        className="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 touch-manipulation"
        onClick={(e) => { e.preventDefault(); onRemove(); }}
        aria-label={`이미지 ${index + 1} 삭제`}
      >
        ×
      </button>
      <button
        type="button"
        className="absolute bottom-1.5 left-1.5 z-10 rounded bg-black/50 p-1.5 text-white opacity-0 group-hover:opacity-100 touch-manipulation"
        aria-label="드래그하여 순서 변경"
        {...attributes}
        {...listeners}
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M8 6h2v2H8V6zm0 4h2v2H8v-2zm0 4h2v2H8v-2zm4-8h2v2h-2V6zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/></svg>
      </button>
      <Image src={item.url} alt="" fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" unoptimized={item.url.startsWith("blob:")} />
    </div>
  );
}
