import Image from "next/image";
import { Gift } from "lucide-react";
import { THEALL_WORDMARK_DARK_SRC } from "@/lib/brandAssets";

/** 다크 워드마크 원본 비율(1024x189)과 동기화 */
const WORDMARK_INTRINSIC_DARK = { width: 1024, height: 189 } as const;

/**
 * 혜택 박스 상단 장식용 쿠폰 비주얼 — 네이비 + 프리미엄 골드, 사이트 워드마크 삽입.
 */
export function KakaoSyncCouponVisual() {
  return (
    <div
      className="relative mx-auto mb-3 w-full max-w-[18rem] select-none"
      aria-hidden
    >
      <div
        className="relative overflow-hidden rounded-xl px-4 py-3.5 shadow-[var(--shadow-soft-strong)]"
        style={{
          background: "#0f172a",
          border: "2px solid #b8962e",
        }}
      >
        {/* 좌우 반원 컷아웃 */}
        <span
          className="absolute left-0 top-1/2 h-5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-r-full bg-[#f8f9fa]"
          aria-hidden
        />
        <span
          className="absolute right-0 top-1/2 h-5 w-2.5 translate-x-1/2 -translate-y-1/2 rounded-l-full bg-[#f8f9fa]"
          aria-hidden
        />
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Image
              alt="thealltour"
              width={WORDMARK_INTRINSIC_DARK.width}
              height={WORDMARK_INTRINSIC_DARK.height}
              src={THEALL_WORDMARK_DARK_SRC}
              className="h-3.5 w-auto opacity-90"
            />
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-white tabular-nums">
              ₩50,000
            </p>
            <p className="mt-0.5 text-xs font-semibold text-[#e8d9a8]">1인당 · 무제한</p>
          </div>
          <div
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{ background: "#b8962e" }}
          >
            <Gift className="relative h-6 w-6 text-[#0f172a]" strokeWidth={1.75} aria-hidden />
          </div>
        </div>
        <div
          className="mt-2.5 border-t border-dashed border-[#b8962e]/50 pt-1.5 text-center text-[0.625rem] font-medium text-[#e8d9a8]"
        >
          카카오 간편가입 즉시 발급
        </div>
      </div>
    </div>
  );
}
