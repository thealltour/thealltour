"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { uploadReviewImage } from "@/lib/reviewImageUpload";

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
        body: JSON.stringify({ title, content, image_urls: imageUrls }),
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
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        제목
        <input
          type="text"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        내용
        <textarea
          required
          rows={8}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
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
            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            이미지 첨부
          </label>
          <span
            className="block max-w-full truncate text-xs text-slate-500 sm:max-w-[260px]"
            title={imageFiles.length > 0 ? `${imageFiles.length}개 선택됨` : "첨부된 파일 없음"}
          >
            {imageFiles.length > 0 ? `${imageFiles.length}개 선택됨` : "첨부된 파일 없음"}
          </span>
        </div>
      </label>
      {imagePreviewUrls.length > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {imagePreviewUrls.map((previewUrl, index) => (
              <div key={`${previewUrl}-${index}`} className="relative h-28 overflow-hidden rounded-xl ring-1 ring-slate-200">
                <Image src={previewUrl} alt={`첨부 이미지 미리보기 ${index + 1}`} fill className="object-cover" unoptimized />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setImageFiles([]);
              setImagePreviewUrls([]);
            }}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
          >
            첨부 이미지 제거
          </button>
        </div>
      ) : null}
      {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-[#1d4ed8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:bg-[#93c5fd]"
      >
        {isSubmitting ? "등록 중..." : "후기 등록"}
      </button>
    </form>
  );
}
