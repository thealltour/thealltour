"use client";

/**
 * PR12: 리뷰 상세 이미지 갤러리 + lightbox (original 확대).
 */
import Image from "next/image";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import { mediumUrlToOriginalUrl } from "@/lib/reviewImagePolicy";

type Props = {
  images: string[];
  productTitle?: string | null;
};

export default function ReviewDetailImages({ images, productTitle }: Props) {
  if (images.length === 0) return null;
  const altBase = productTitle ? `${productTitle} 여행 후기 사진` : "여행 후기 사진";

  return (
    <PhotoProvider>
      <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-6 sm:grid-cols-3 md:grid-cols-4">
        {images.map((mediumUrl, index) => {
          const originalUrl = mediumUrlToOriginalUrl(mediumUrl);
          const alt = `${altBase} ${index + 1}`;
          return (
            <PhotoView key={`${mediumUrl}-${index}`} src={originalUrl}>
              <div className="relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-slate-100">
                <Image
                  src={mediumUrl}
                  alt={alt}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover transition hover:opacity-95"
                  priority={index === 0}
                  loading={index === 0 ? undefined : "lazy"}
                  unoptimized={mediumUrl.startsWith("blob:")}
                />
              </div>
            </PhotoView>
          );
        })}
      </div>
    </PhotoProvider>
  );
}
