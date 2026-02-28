"use client";

import { useConsultModal } from "@/components/ConsultModal";

type ProductDetailStickyProps = {
  priceFormatted: string | null;
  productId: string;
  productTitle: string;
  sourcePath: string;
  kakaoHref: string;
};

export function ProductDetailStickyDesktop({
  priceFormatted,
  productId,
  productTitle,
  sourcePath,
  kakaoHref,
}: ProductDetailStickyProps) {
  const { openModal } = useConsultModal();
  return (
    <aside
      className="hidden lg:block sticky top-24 w-full max-w-[280px] shrink-0 rounded-2xl border border-[#dbeafe] bg-white p-5 shadow-lg ring-1 ring-[#dbeafe]"
      aria-label="상품 요약"
    >
      <p className="text-sm font-semibold text-slate-500">예상가</p>
      {priceFormatted ? (
        <p className="font-price-strong mt-1 text-xl font-bold text-[#1E3A8A]">
          ₩{priceFormatted}~
        </p>
      ) : (
        <p className="mt-1 text-base font-semibold text-slate-600">상담 후 안내</p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => openModal({ productId, productTitle, sourcePath })}
          className="type-btn inline-flex items-center justify-center rounded-xl bg-[#1E3A8A] px-4 py-3 text-white transition hover:bg-[#1d4ed8]"
        >
          상담 문의하기
        </button>
        <a
          href={kakaoHref}
          target="_blank"
          rel="noopener noreferrer"
          className="type-btn inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 transition hover:bg-slate-50"
        >
          카톡 상담
        </a>
      </div>
    </aside>
  );
}

export function ProductDetailStickyMobile({
  priceFormatted,
  productId,
  productTitle,
  sourcePath,
  kakaoHref,
}: ProductDetailStickyProps) {
  const { openModal } = useConsultModal();
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden">
      {priceFormatted ? (
        <span className="font-price-strong text-sm font-bold text-[#1E3A8A]">
          ₩{priceFormatted}~
        </span>
      ) : null}
      <div className="flex flex-1 gap-2">
        <button
          type="button"
          onClick={() => openModal({ productId, productTitle, sourcePath })}
          className="type-btn flex-1 rounded-xl bg-[#1d4ed8] px-4 py-3 text-center text-sm font-semibold text-white"
        >
          상담 문의
        </button>
        <a
          href={kakaoHref}
          target="_blank"
          rel="noopener noreferrer"
          className="type-btn shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
        >
          카톡
        </a>
      </div>
    </div>
  );
}
