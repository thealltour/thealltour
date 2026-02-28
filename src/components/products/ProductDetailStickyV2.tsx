"use client";

import { useConsultModal } from "@/components/ConsultModal";
import { Button } from "@/components/ui/Button";
import TrustSignals from "@/components/products/TrustSignals";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import type { ProductTrust } from "@/types/product";

export type ProductDetailStickyV2Status =
  | "AVAILABLE"
  | "LIMITED"
  | "SOLD_OUT"
  | "CONSULT_REQUIRED";

type ProductDetailStickyV2Props = {
  priceFormatted: string | null;
  productId: string;
  productTitle: string;
  sourcePath: string;
  kakaoHref: string;
  status?: ProductDetailStickyV2Status;
  trust?: ProductTrust | null;
};

export function ProductDetailStickyV2Desktop({
  priceFormatted,
  productId,
  productTitle,
  sourcePath,
  kakaoHref,
  status = "AVAILABLE",
  trust,
}: ProductDetailStickyV2Props) {
  const { openModal } = useConsultModal();
  const { quoteSummary, requiredGroupsMissing, scrollToOptions } = useProductQuote();
  const isSoldOut = status === "SOLD_OUT";

  const displayPrice = quoteSummary?.total != null
    ? formatPriceKR(quoteSummary.total)
    : priceFormatted;

  const handlePrimaryClick = () => {
    if (requiredGroupsMissing) {
      scrollToOptions();
      return;
    }
    if (isSoldOut && typeof window !== "undefined") {
      window.alert("마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.");
    }
    openModal({ productId, productTitle, sourcePath });
  };

  return (
    <aside
      className="hidden md:block sticky top-24 w-full max-w-[280px] shrink-0 rounded-2xl border border-[#dbeafe] bg-white p-5 shadow-lg ring-1 ring-[#dbeafe]"
      aria-label="상품 요약"
    >
      <p className="text-sm font-semibold text-slate-500">예상가</p>
      {displayPrice ? (
        <p className="font-price-strong mt-1 text-xl font-bold text-[#1E3A8A]">
          ₩{displayPrice}~
        </p>
      ) : (
        <p className="mt-1 text-base font-semibold text-slate-600">상담 후 안내</p>
      )}
      <TrustSignals trust={trust} className="mt-3" />
      <div className="mt-4 flex flex-col gap-2">
        <Button variant="primary" size="md" onClick={handlePrimaryClick}>
          {isSoldOut ? "대기 문의" : "상담 문의하기"}
        </Button>
        <a href={kakaoHref} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="md" className="w-full">
            카톡 상담
          </Button>
        </a>
      </div>
    </aside>
  );
}

export function ProductDetailStickyV2Mobile({
  priceFormatted,
  productId,
  productTitle,
  sourcePath,
  kakaoHref,
  status = "AVAILABLE",
}: ProductDetailStickyV2Props) {
  const { openModal } = useConsultModal();
  const { quoteSummary, requiredGroupsMissing, scrollToOptions } = useProductQuote();
  const isSoldOut = status === "SOLD_OUT";

  const displayPrice = quoteSummary?.total != null
    ? formatPriceKR(quoteSummary.total)
    : priceFormatted;

  const handlePrimaryClick = () => {
    if (requiredGroupsMissing) {
      scrollToOptions();
      return;
    }
    if (isSoldOut && typeof window !== "undefined") {
      window.alert("마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.");
    }
    openModal({ productId, productTitle, sourcePath });
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden">
      {displayPrice ? (
        <span className="font-price-strong text-sm font-bold text-[#1E3A8A]">
          ₩{displayPrice}~
        </span>
      ) : (
        <span className="text-sm font-semibold text-slate-600">상담 후 안내</span>
      )}
      <div className="flex flex-1 gap-2">
        <Button variant="primary" size="md" onClick={handlePrimaryClick} className="flex-1">
          {isSoldOut ? "대기 문의" : "상담 문의"}
        </Button>
        <a href={kakaoHref} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="md">
            카톡
          </Button>
        </a>
      </div>
    </div>
  );
}
