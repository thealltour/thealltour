"use client";

import { useCallback, useState } from "react";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { useProductQuote, type BookingScrollTarget } from "@/components/products/ProductQuoteContext";
import { ActionPromptToast } from "@/components/ui/ActionPromptToast";
import { Button } from "@/components/ui/Button";
import {
  getProductCtaLabel,
  getProductCtaStickyPrimaryLabel,
  type ProductCtaLabelOptions,
  type ProductCtaStatus,
} from "@/lib/products/getProductCtaLabel";
import { buildProductInquiryPrefill } from "@/lib/products/buildProductInquiryPrefill";
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
  departureSelectionMissing?: boolean;
  scrollToBooking?: (target?: BookingScrollTarget) => void;
  /** @deprecated use scrollToBooking */
  scrollToOptions?: (target?: BookingScrollTarget) => void;
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
  /** section "sticky": 금액 앞 접두 (예: "비수기 기준 ") */
  stickyPricePrefix?: string;
  /** section "sticky": 금액 아래 보조문구. 미전달 시 "1인 기준" */
  stickyPriceSubLabel?: string;
  /** section "sticky": 두 번째 보조 줄 (예: 구간가 변동 힌트) */
  stickyPriceSecondLine?: string;
  /** section "sticky": false면 금액 뒤 ~ 를 붙이지 않음 (선택 출발일 확정 금액) */
  stickyShowRangeSuffix?: boolean;
  /** 고정 출발일 상품 등 CTA 문구 분기 */
  ctaLabelOptions?: ProductCtaLabelOptions;
};

type PendingAction = "primary" | "kakao";

function buildSelectionPromptMessage(
  departureMissing: boolean,
  optionsMissing: boolean,
): string {
  if (departureMissing && optionsMissing) {
    return "출발일·옵션을 선택하면 더 정확한 상담이 가능합니다.";
  }
  if (departureMissing) {
    return "출발일을 선택하면 더 정확한 상담이 가능합니다.";
  }
  return "추가 옵션·할증을 선택하면 더 정확한 상담이 가능합니다.";
}

export function ProductConsultCTA({
  productId,
  productTitle,
  sourcePath = "",
  status,
  kakaoHref,
  section,
  priceFormatted,
  requiredGroupsMissing: requiredGroupsMissingProp,
  departureSelectionMissing: departureSelectionMissingProp,
  scrollToBooking: scrollToBookingProp,
  scrollToOptions,
  isSoldOut,
  copy,
  subCopy,
  className = "",
  compact = false,
  onPrimaryClick,
  primaryLabel: primaryLabelOverride,
  helperText: helperTextOverride,
  stickyPricePrefix,
  stickyPriceSubLabel,
  stickyPriceSecondLine,
  stickyShowRangeSuffix = true,
  ctaLabelOptions,
}: ProductConsultCTAProps) {
  const { openModal } = useConsultModal();
  const quoteCtx = useProductQuote();
  const [kakaoToast, setKakaoToast] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const requiredGroupsMissing = requiredGroupsMissingProp ?? quoteCtx.requiredGroupsMissing;
  const departureSelectionMissing =
    departureSelectionMissingProp ?? quoteCtx.departureSelectionMissing;
  const scrollToBooking = scrollToBookingProp ?? scrollToOptions ?? quoteCtx.scrollToBooking;

  const primaryLabel = primaryLabelOverride ?? getProductCtaLabel(status, ctaLabelOptions);
  const stickyPrimaryLabel =
    primaryLabelOverride ?? getProductCtaStickyPrimaryLabel(status, ctaLabelOptions);

  const buildPrefill = () =>
    buildProductInquiryPrefill({
      productTitle,
      selectedDeparture: quoteCtx.selectedDeparture,
      travelerCount: quoteCtx.travelerCount,
      quoteSummary: quoteCtx.quoteSummary,
      selectedOptions: quoteCtx.selectedOptions,
    });

  const selectionMissing = departureSelectionMissing || requiredGroupsMissing;

  const proceedPrimary = useCallback(() => {
    if (isSoldOut && typeof window !== "undefined") {
      window.alert("마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.");
      return;
    }
    trackProductCtaClick({ productId, ctaType: "primary", section });
    onPrimaryClick?.();
    const prefill = buildPrefill();
    openModal({
      productId,
      productTitle,
      sourcePath,
      prefillContent: prefill || undefined,
    });
  }, [
    isSoldOut,
    productId,
    section,
    onPrimaryClick,
    productTitle,
    sourcePath,
    openModal,
    quoteCtx.selectedDeparture,
    quoteCtx.quoteSummary,
    quoteCtx.selectedOptions,
    quoteCtx.travelerCount,
  ]);

  const proceedKakao = useCallback(async () => {
    trackProductCtaClick({ productId, ctaType: "kakao", section });
    const summary = buildProductInquiryPrefill({
      productTitle,
      selectedDeparture: quoteCtx.selectedDeparture,
      travelerCount: quoteCtx.travelerCount,
      quoteSummary: quoteCtx.quoteSummary,
      selectedOptions: quoteCtx.selectedOptions,
    });
    if (summary && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(summary);
        setKakaoToast("문의 내용이 복사되었습니다. 카톡 채팅에 붙여넣어 주세요.");
        setTimeout(() => setKakaoToast(null), 2800);
      } catch {
        setKakaoToast("복사에 실패했습니다. 상품명과 선택 내용을 직접 입력해 주세요.");
        setTimeout(() => setKakaoToast(null), 2800);
      }
    }
    if (kakaoHref && typeof window !== "undefined") {
      window.open(kakaoHref, "_blank", "noopener,noreferrer");
    }
  }, [
    productId,
    section,
    kakaoHref,
    productTitle,
    quoteCtx.selectedDeparture,
    quoteCtx.quoteSummary,
    quoteCtx.selectedOptions,
    quoteCtx.travelerCount,
  ]);

  const dismissPrompt = useCallback(() => {
    setPromptOpen(false);
    setPendingAction(null);
  }, []);

  const handleScrollToSelection = useCallback(() => {
    const target: BookingScrollTarget = departureSelectionMissing
      ? "departure"
      : requiredGroupsMissing
        ? "options"
        : "panel";
    scrollToBooking(target);
    dismissPrompt();
  }, [departureSelectionMissing, requiredGroupsMissing, scrollToBooking, dismissPrompt]);

  const handleProceedWithoutSelection = useCallback(() => {
    const action = pendingAction;
    dismissPrompt();
    if (action === "kakao") {
      void proceedKakao();
    } else {
      proceedPrimary();
    }
  }, [pendingAction, dismissPrompt, proceedKakao, proceedPrimary]);

  const handlePrimary = () => {
    if (selectionMissing) {
      setPendingAction("primary");
      setPromptOpen(true);
      return;
    }
    proceedPrimary();
  };

  const handleKakao = (event: React.MouseEvent) => {
    event.preventDefault();
    if (selectionMissing) {
      setPendingAction("kakao");
      setPromptOpen(true);
      return;
    }
    void proceedKakao();
  };

  const kakaoButton = kakaoHref ? (
    <Button
      type="button"
      variant="kakao"
      size="md"
      className={section === "sticky" ? "h-11 min-h-11 w-full whitespace-nowrap" : "w-full"}
      onClick={handleKakao}
    >
      카톡 견적 문의
    </Button>
  ) : null;

  const selectionHint =
    departureSelectionMissing || requiredGroupsMissing ? (
      <p className="mb-2 text-sm text-amber-600">
        {departureSelectionMissing ? "출발일을 선택해 주세요." : "필수 옵션을 선택해 주세요."}
      </p>
    ) : null;

  const actionPrompt = (
    <ActionPromptToast
      open={promptOpen}
      message={buildSelectionPromptMessage(departureSelectionMissing, requiredGroupsMissing)}
      primaryLabel={
        departureSelectionMissing && requiredGroupsMissing
          ? "출발일·옵션 선택하기"
          : departureSelectionMissing
            ? "출발일 선택하기"
            : "옵션 선택하기"
      }
      secondaryLabel="선택 없이 문의"
      onPrimary={handleScrollToSelection}
      onSecondary={handleProceedWithoutSelection}
      onDismiss={dismissPrompt}
    />
  );

  if (section === "sticky") {
    return (
      <div className={`w-full min-w-0 ${className}`}>
        {kakaoToast ? (
          <p className="mb-2 rounded-lg bg-slate-800 px-2 py-1.5 text-center text-[11px] text-white">
            {kakaoToast}
          </p>
        ) : null}
        <div className="flex h-11 w-full min-w-0 items-center gap-3 sm:gap-4">
          <div
            className="flex shrink-0 flex-col justify-center"
            style={{ minWidth: "6.5rem", maxWidth: "10rem" }}
          >
            {priceFormatted != null && priceFormatted !== "" ? (
              <>
                <span className="font-price-strong text-[1.0625rem] font-bold leading-tight text-[var(--primary)]">
                  {stickyPricePrefix ?? ""}₩{priceFormatted}{stickyShowRangeSuffix ? "~" : ""}
                </span>
                <span className="mt-0.5 block text-[0.6875rem] leading-snug text-slate-600 break-words">
                  {stickyPriceSubLabel ?? "1인 기준"}
                </span>
                {stickyPriceSecondLine ? (
                  <span className="mt-0.5 block text-[0.625rem] leading-snug text-slate-500">
                    {stickyPriceSecondLine}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-sm font-semibold text-slate-600">상담 후 안내</span>
            )}
          </div>
          <div className="flex h-11 min-w-0 shrink flex-1 items-center gap-2">
            <Button
              variant="accent"
              size="md"
              onClick={handlePrimary}
              className="h-11 min-h-11 flex-1 min-w-0 shrink-0 whitespace-nowrap"
            >
              {isSoldOut ? "대기" : stickyPrimaryLabel}
            </Button>
            {kakaoButton ? <div className="min-w-0 shrink">{kakaoButton}</div> : null}
          </div>
        </div>
        {actionPrompt}
      </div>
    );
  }

  if (section === "itinerary") {
    return (
      <div className={className}>
        {copy && <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">{copy}</p>}
        {subCopy && <p className="mb-4 text-xs text-[var(--text-muted)]">{subCopy}</p>}
        {selectionHint}
        <div className="flex flex-col gap-2">
          <Button variant="accent" size="md" onClick={handlePrimary} className="w-full">
            {primaryLabel}
          </Button>
          {kakaoButton}
        </div>
        {kakaoToast ? (
          <p className="mt-2 text-center text-xs text-slate-600">{kakaoToast}</p>
        ) : null}
        {actionPrompt}
      </div>
    );
  }

  // section === "top"
  const defaultHelper = "일정과 요금은 상담을 통해 개별 안내됩니다.";
  const helperText = helperTextOverride ?? defaultHelper;

  return (
    <div className={className}>
      {selectionHint}
      <div className="flex flex-col gap-2">
        <Button variant="accent" size="md" onClick={handlePrimary} className="w-full">
          {primaryLabel}
        </Button>
        {kakaoButton}
      </div>
      {kakaoToast ? <p className="mt-2 text-xs text-slate-600">{kakaoToast}</p> : null}
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{helperText}</p>
      {actionPrompt}
    </div>
  );
}
