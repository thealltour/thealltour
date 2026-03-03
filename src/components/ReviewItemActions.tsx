"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { useAdminConfirm } from "@/components/admin/AdminConfirmProvider";
import { uploadReviewImage } from "@/lib/reviewImageUpload";

const MAX_REVIEW_IMAGES = 4;

type ReviewItemActionsProps = {
  reviewId: string;
  defaultTitle: string;
  defaultContent: string;
  defaultImageUrls?: string[];
};

export default function ReviewItemActions({
  reviewId,
  defaultTitle,
  defaultContent,
  defaultImageUrls = [],
}: ReviewItemActionsProps) {
  const router = useRouter();
  const { showToast } = useAdminToast();
  const { confirm } = useAdminConfirm();
  const imageInputId = useId();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [content, setContent] = useState(defaultContent);
  const [imageUrls, setImageUrls] = useState<string[]>(defaultImageUrls);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    return () => {
      for (const previewUrl of imagePreviewUrls) {
        if (previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      }
    };
  }, [imagePreviewUrls]);

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const nextImageUrls =
        imageFiles.length > 0 ? await Promise.all(imageFiles.map((file) => uploadReviewImage(file))) : imageUrls;

      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, image_urls: nextImageUrls }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "후기 수정에 실패했습니다.");
        return;
      }
      setIsEditing(false);
      router.refresh();
    } catch {
      setErrorMessage("후기 수정 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "후기 삭제",
      description: "정말 이 후기를 삭제하시겠습니까?",
      confirmLabel: "삭제",
      cancelLabel: "취소",
    });
    if (!ok) return;
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "후기 삭제에 실패했습니다.");
        showToast("error", result.message ?? "후기 삭제에 실패했습니다.");
        return;
      }
      router.refresh();
      showToast("success", "후기를 삭제했습니다.");
    } catch {
      setErrorMessage("후기 삭제 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isEditing) {
    return (
      <form className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleUpdate}>
        <input
          type="text"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
        <textarea
          required
          rows={6}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
        <label className="flex flex-col gap-2 text-xs font-medium text-slate-700">
          사진 변경 (선택)
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
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              이미지 첨부
            </label>
            <span
              className="block max-w-full truncate text-[11px] text-slate-500 sm:max-w-[220px]"
              title={
                imageFiles.length > 0
                  ? `${imageFiles.length}개 선택됨`
                  : imageUrls.length > 0
                    ? `기존 이미지 ${imageUrls.length}장`
                    : "첨부된 파일 없음"
              }
            >
              {imageFiles.length > 0
                ? `${imageFiles.length}개 선택됨`
                : imageUrls.length > 0
                  ? `기존 이미지 ${imageUrls.length}장`
                  : "첨부된 파일 없음"}
            </span>
          </div>
        </label>
        {imagePreviewUrls.length > 0 || imageUrls.length > 0 ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(imagePreviewUrls.length > 0 ? imagePreviewUrls : imageUrls).map((url, index) => (
                <div key={`${url}-${index}`} className="relative h-24 overflow-hidden rounded-lg ring-1 ring-slate-200">
                  <Image
                    src={url}
                    alt={`후기 이미지 ${index + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover"
                    unoptimized={imagePreviewUrls.length > 0}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setImageFiles([]);
                setImagePreviewUrls([]);
                setImageUrls([]);
              }}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              이미지 제거
            </button>
          </div>
        ) : null}
        {errorMessage ? <p className="text-xs text-red-500">{errorMessage}</p> : null}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-[#1d4ed8] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:bg-[#93c5fd]"
          >
            {isSubmitting ? "저장 중..." : "저장"}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setTitle(defaultTitle);
              setContent(defaultContent);
              setImageUrls(defaultImageUrls);
              setImageFiles([]);
              setImagePreviewUrls([]);
              setErrorMessage("");
              setIsEditing(false);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => setIsEditing(true)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        수정
      </button>
      <button
        type="button"
        disabled={isSubmitting}
        onClick={handleDelete}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        삭제
      </button>
      {errorMessage ? <p className="text-xs text-red-500">{errorMessage}</p> : null}
    </div>
  );
}
