"use client";

import { useConsultModal } from "@/components/inquiry/ConsultModal";
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
  /** primary 버튼 문구 override (미전달 시 getProductCtaLabel 사용). Desktop Sticky 등 전환 최적화용 */
  primaryLabel?: string;
  /** section "top"에서 버튼 하단 보조 문구 override (미전달 시 기본 문구 사용) */
  helperText?: string;
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
  primaryLabel: primaryLabelOverride,
  helperText: helperTextOverride,
}: ProductConsultCTAProps) {
  const { openModal } = useConsultModal();
  const primaryLabel = primaryLabelOverride ?? getProductCtaLabel(status);

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
      <div className={`flex h-11 w-full min-w-0 items-center gap-3 sm:gap-4 ${className}`}>
        <div className="flex shrink-0 flex-col justify-center" style={{ minWidth: "6rem" }}>
          {priceFormatted != null && priceFormatted !== "" ? (
            <>
              <span className="font-price-strong text-[1.0625rem] font-bold leading-tight text-[var(--primary)]">
                ₩{priceFormatted}~
              </span>
              <span className="mt-0.5 text-[0.6875rem] text-slate-600">1인 기준</span>
            </>
          ) : (
            <span className="text-sm font-semibold text-slate-600">상담 후 안내</span>
          )}
        </div>
        <div className="flex h-11 min-w-0 shrink flex-1 items-center gap-2">
          <Button variant="accent" size="md" onClick={handlePrimary} className="h-11 min-h-11 flex-1 min-w-0 shrink-0 whitespace-nowrap">
            {isSoldOut ? "대기" : "예약 상담"}
          </Button>
          {kakaoHref && (
            <a href={kakaoHref} target="_blank" rel="noopener noreferrer" onClick={handleKakao} className="min-w-0 shrink">
              <Button variant="kakao" size="md" className="h-11 min-h-11 w-full whitespace-nowrap">
                카카오톡 상담
              </Button>
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
          <Button variant="accent" size="md" onClick={handlePrimary}>
            {primaryLabel}
          </Button>
          {kakaoHref && (
            <a href={kakaoHref} target="_blank" rel="noopener noreferrer" onClick={handleKakao}>
              <Button variant="kakao" size="md">카톡 상담</Button>
            </a>
          )}
        </div>
      </div>
    );
  }

  // section === "top"
  const defaultHelper = "상담 후 확정 · 맞춤 견적 안내";
  const helperText = helperTextOverride ?? defaultHelper;

  return (
    <div className={className}>
      {requiredGroupsMissing && (
        <p className="mb-2 text-sm text-amber-600">필수 옵션을 선택해 주세요.</p>
      )}
      <div className="flex flex-col gap-2">
        <Button variant="accent" size="md" onClick={handlePrimary} className="w-full">
          {primaryLabel}
        </Button>
        {kakaoHref && (
          <a href={kakaoHref} target="_blank" rel="noopener noreferrer" onClick={handleKakao} className="block">
            <Button variant="kakao" size="md" className="w-full">카톡 상담</Button>
          </a>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{helperText}</p>
    </div>
  );
}
