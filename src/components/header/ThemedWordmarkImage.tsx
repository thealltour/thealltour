import Image from "next/image";
import {
  THEALL_WORDMARK_DARK_SRC,
  THEALL_WORDMARK_LIGHT_SRC,
} from "@/lib/brandAssets";

/** `brandAssets` 워드마크 PNG와 동기화 (import 바인딩 이슈·캐시 꼬임 시 런타임 ReferenceError 방지) */
const WORDMARK_INTRINSIC_LIGHT = { width: 1024, height: 184 } as const;
const WORDMARK_INTRINSIC_DARK = { width: 1024, height: 189 } as const;

export type ThemedWordmarkImageProps = {
  /** `next/image` sizes (헤더 variant·사이드바 폭에 맞게) */
  sizes: string;
  /** 로고에만 붙는 클래스 (높이·max-width 등) */
  imgClassName: string;
  priority?: boolean;
  alt?: string;
};

/**
 * 라이트: 흰 배경 워드마크 / 다크: 납품 다크 워드마크 (`dark:hidden` · `hidden dark:inline-flex` 래퍼).
 */
export function ThemedWordmarkImage({
  sizes,
  imgClassName,
  priority,
  alt = "thealltour",
}: ThemedWordmarkImageProps) {
  const L = WORDMARK_INTRINSIC_LIGHT;
  const D = WORDMARK_INTRINSIC_DARK;
  return (
    <>
      {/* 래퍼에만 표시/숨김: img의 .header-brand-logo-img { display:block } 이 Tailwind hidden 을 덮어쓸 수 있음 */}
      <span className="inline-flex shrink-0 items-center dark:hidden">
        <Image
          alt={alt}
          width={L.width}
          height={L.height}
          sizes={sizes}
          priority={priority}
          src={THEALL_WORDMARK_LIGHT_SRC}
          className={imgClassName}
        />
      </span>
      <span className="hidden shrink-0 items-center dark:inline-flex">
        <Image
          alt={alt}
          width={D.width}
          height={D.height}
          sizes={sizes}
          priority={priority}
          src={THEALL_WORDMARK_DARK_SRC}
          className={imgClassName}
        />
      </span>
    </>
  );
}
