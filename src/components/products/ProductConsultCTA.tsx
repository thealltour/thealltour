"use client";

import { useConsultModal } from "@/components/ConsultModal";
import { Button } from "@/components/ui/Button";
import { getProductCtaLabel, type ProductCtaStatus } from "@/lib/products/getProductCtaLabel";
import { trackProductCtaClick } from "@/lib/analytics/trackProductClick";

export type ProductConsultCTASection = "top" | "sticky" | "itinerary";

export type ProductConsultCTAProps = {
  productId: string;
  productTitle: string;
  sourcePath?: string;
  status?: ProductCtaStatus;
  kakaoHref?: string;
  section: ProductConsultCTASection;
  /** sticky 섹션에서 가격 표시 */
  priceFormatted?: string | null;
  /** true면 주 CTA 클릭 시 옵션 영역으로 스크롤만 함 */
  requiredGroupsMissing?: boolean;
  scrollToOptions?: () => void;
  isSoldOut?: boolean;
  /** itinerary: 보조 문구 */
  copy?: string;
  subCopy?: string;
  className?: string;
  /** sticky에서 버튼만 compact 표시 */
  compact?: boolean;
  /** 주 CTA 클릭 시 추가 콜백 (예: 리뷰 전환 계측) */
  onPrimaryClick?: () => void;
};

export function ProductConsultCTA({
  productId,
  productTitle,
  sourcePath = "",
  status,
  kakaoHref,
  section,
  priceFormatted,
  requiredGroupsMissing,
  scrollToOptions,
  isSoldOut,
  copy,
  subCopy,
  className = "",
  compact = false,
  onPrimaryClick,
}: ProductConsultCTAProps) {
  const { openModal } = useConsultModal();
  const primaryLabel = getProductCtaLabel(status);

  const handlePrimary = () => {
    if (requiredGroupsMissing && scrollToOptions) {
      scrollToOptions();
      return;
    }
    if (isSoldOut && typeof window !== "undefined") {
      window.alert("마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.");
      return;
    }
    trackProductCtaClick({ productId, ctaType: "primary", section });
    onPrimaryClick?.();
    openModal({ productId, productTitle, sourcePath });
  };

  const handleKakao = () => {
    trackProductCtaClick({ productId, ctaType: "kakao", section });
  };

  if (section === "sticky") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {priceFormatted != null && priceFormatted !== "" && (
          <span className="font-price-strong text-sm font-bold text-[#1E3A8A]">₩{priceFormatted}~</span>
        )}
        {!priceFormatted && (
          <span className="text-sm font-semibold text-slate-600">상담 후 안내</span>
        )}
        <div className="flex flex-1 gap-2">
          <Button variant="primary" size="md" onClick={handlePrimary} className="flex-1">
            {compact ? (isSoldOut ? "대기" : "상담") : primaryLabel}
          </Button>
          {kakaoHref && (
            <a href={kakaoHref} target="_blank" rel="noopener noreferrer" onClick={handleKakao}>
              <Button variant="outline" size="md">카톡</Button>
            </a>
          )}
        </div>
      </div>
    );
  }

  if (section === "itinerary") {
    return (
      <div className={className}>
        {copy && <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">{copy}</p>}
        {subCopy && <p className="mb-4 text-xs text-[var(--text-muted)]">{subCopy}</p>}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="md" onClick={handlePrimary}>
            {primaryLabel}
          </Button>
          {kakaoHref && (
            <a href={kakaoHref} target="_blank" rel="noopener noreferrer" onClick={handleKakao}>
              <Button variant="outline" size="md">카톡 상담</Button>
            </a>
          )}
        </div>
      </div>
    );
  }

  // section === "top"
  return (
    <div className={className}>
      {requiredGroupsMissing && (
        <p className="mb-2 text-sm text-amber-600">필수 옵션을 선택해 주세요.</p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="md" onClick={handlePrimary}>
          {primaryLabel}
        </Button>
        {kakaoHref && (
          <a href={kakaoHref} target="_blank" rel="noopener noreferrer" onClick={handleKakao}>
            <Button variant="outline" size="md">카톡 상담</Button>
          </a>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">상담 후 확정 · 맞춤 견적 안내</p>
    </div>
  );
}
