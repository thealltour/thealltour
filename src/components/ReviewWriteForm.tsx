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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
