"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { Tabs, TabsTrigger } from "@/components/ui/Tabs";
import AlertCard from "@/components/ui/AlertCard";
import TrustSignals from "@/components/products/TrustSignals";
import { OptionPanel } from "@/components/products/OptionPanel";
import { QuoteSummary } from "@/components/products/QuoteSummary";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { useConsultModal } from "@/components/ConsultModal";
import { ENABLE_PRODUCT_OPTIONS } from "@/config/featureFlags";
import { calcQuote, formatPriceKR } from "@/lib/pricing/calcQuote";
import type { ProductTrust, ProductOptions, SelectedOptions } from "@/types/product";

export type ProductDetailV2StatusTag =
  | "AVAILABLE"
  | "LIMITED"
  | "SOLD_OUT"
  | "CONSULT_REQUIRED";

export type ProductDetailV2Props = {
  title?: string;
  region?: string;
  category?: string;
  statusTag?: ProductDetailV2StatusTag;
  oneLiner?: string;
  priceFormatted?: string | null;
  duration?: string;
  priceMeta?: string;
  fuelIncluded?: boolean;
  includedItems?: string;
  excludedItems?: string;
  detailedSchedule?: string;
  optionalTours?: string;
  minDeparturePeople?: string;
  termsAndNotes?: string;
  onConsultClick?: () => void;
  kakaoHref?: string;
  /** 상담 견적 페이지 링크. productId 등이 있으면 본문 CTA는 모달을 띄우고 이 값은 폼 기본 링크로만 사용 */
  consultHref?: string;
  /** 모달 열 때 전달할 상품 정보 (있으면 본문 상담 버튼이 모달 오픈) */
  productId?: string;
  productTitle?: string;
  sourcePath?: string;
  trust?: ProductTrust | null;
  /** 옵션 정의. ENABLE_PRODUCT_OPTIONS && options 존재 시에만 옵션 UI 노출 */
  options?: ProductOptions;
  /** 기준가(원). 옵션 있을 때 calcQuote에 사용 */
  basePrice?: number;
};

type ScheduleDay = { label: string; content: string };
type MainTab = "schedule" | "included" | "booking" | "refund";

const STATUS_LABELS: Record<ProductDetailV2StatusTag, string> = {
  AVAILABLE: "예약 가능",
  LIMITED: "잔여 한정",
  SOLD_OUT: "마감",
  CONSULT_REQUIRED: "상담 후 안내",
};

function parseScheduleDays(raw?: string): ScheduleDay[] {
  const source = raw?.trim();
  if (!source) return [];
  const lines = source.split(/\r?\n/);
  const days: ScheduleDay[] = [];
  let currentLabel = "";
  let currentContent: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\[(.+)\]\s*$/);
    if (match) {
      if (currentLabel) {
        days.push({ label: currentLabel, content: currentContent.join("\n").trim() });
      }
      currentLabel = match[1].trim();
      currentContent = [];
      continue;
    }
    currentContent.push(line);
  }
  if (currentLabel) {
    days.push({ label: currentLabel, content: currentContent.join("\n").trim() });
  }
  const filtered = days.filter((d) => d.content.length > 0);
  if (filtered.length === 0 && source) return [{ label: "일정", content: source }];
  return filtered;
}

function parseBulletLines(raw?: string): string[] {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default function ProductDetailV2({
  title = "",
  region = "",
  category = "",
  statusTag,
  oneLiner = "",
  priceFormatted = null,
  duration = "",
  priceMeta = "1인 기준",
  fuelIncluded,
  includedItems = "",
  excludedItems = "",
  detailedSchedule = "",
  optionalTours = "",
  minDeparturePeople = "",
  termsAndNotes = "",
  onConsultClick,
  kakaoHref = "",
  consultHref = "",
  productId,
  productTitle,
  sourcePath,
  trust,
  options,
  basePrice,
}: ProductDetailV2Props) {
  const [activeTab, setActiveTab] = useState<MainTab>("schedule");
  const [openAccordionIndex, setOpenAccordionIndex] = useState<number | null>(0);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>({});
  const isSoldOut = statusTag === "SOLD_OUT";
  const optionsPanelRef = useRef<HTMLDivElement>(null);
  const { setQuoteSummary, setRequiredGroupsMissing, setSelectedOptions: syncSelectedOptionsToQuote, registerScrollToOptions } = useProductQuote();

  const hasOptions = ENABLE_PRODUCT_OPTIONS && options?.groups != null && options.groups.length > 0;
  const quote = useMemo(
    () => calcQuote(options, selectedOptions),
    [options, selectedOptions],
  );
  const { openModal } = useConsultModal();
  const displayPrice = hasOptions && quote.total != null
    ? formatPriceKR(quote.total)
    : priceFormatted;
  const displayDuration = hasOptions && quote.durationLabel ? quote.durationLabel : duration;

  const requiredGroupsMissing = useMemo(() => {
    if (!hasOptions || !options?.requiredGroups?.length) return false;
    return options.requiredGroups.some((key) => !selectedOptions[key]);
  }, [hasOptions, options, selectedOptions]);

  useEffect(() => {
    setQuoteSummary(hasOptions ? quote : null);
    setRequiredGroupsMissing(hasOptions ? requiredGroupsMissing : false);
    syncSelectedOptionsToQuote(hasOptions && Object.keys(selectedOptions).length > 0 ? selectedOptions : null);
  }, [hasOptions, quote, requiredGroupsMissing, selectedOptions, setQuoteSummary, setRequiredGroupsMissing, syncSelectedOptionsToQuote]);

  useEffect(() => {
    registerScrollToOptions(() => {
      optionsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [registerScrollToOptions]);

  const handleOptionChange = useCallback((groupId: string, optionId: string) => {
    setSelectedOptions((prev) => ({ ...prev, [groupId]: optionId }));
  }, []);

  const handlePrimaryCta = () => {
    if (requiredGroupsMissing) {
      optionsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (isSoldOut && typeof window !== "undefined") {
      window.alert("마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.");
    }
    if (productId != null) {
      openModal({ productId, productTitle, sourcePath });
      return;
    }
    if (consultHref) {
      window.location.href = consultHref;
      return;
    }
    onConsultClick?.();
  };

  const scheduleDays = useMemo(() => parseScheduleDays(detailedSchedule), [detailedSchedule]);
  const includedLines = useMemo(() => parseBulletLines(includedItems), [includedItems]);
  const excludedLines = useMemo(() => parseBulletLines(excludedItems), [excludedItems]);
  const optionalLines = useMemo(() => parseBulletLines(optionalTours), [optionalTours]);
  const termsLines = useMemo(() => parseBulletLines(termsAndNotes), [termsAndNotes]);

  const hasSchedule = scheduleDays.length > 0;
  const listClass = "space-y-2 text-sm leading-[1.7] text-slate-700";
  const bulletClass = "mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb]";

  return (
    <div className="space-y-8">
      {/* DetailHero */}
      <section className="space-y-5">
        {/* TagRow: 지역/카테고리/상태 */}
        <div className="flex flex-wrap items-center gap-2">
          {region ? (
            <Tag variant="accent" size="sm">
              {region}
            </Tag>
          ) : null}
          {category ? (
            <Tag variant="accent" size="sm">
              {category}
            </Tag>
          ) : null}
          {statusTag != null && (
            <Tag variant={statusTag === "AVAILABLE" ? "accent" : statusTag === "LIMITED" ? "gold" : "muted"} size="sm">
              {STATUS_LABELS[statusTag]}
            </Tag>
          )}
        </div>

        <h1 className="font-card-title text-2xl font-bold leading-tight text-[#0f172a] md:text-3xl">
          {title || "상품명"}
        </h1>

        {oneLiner ? (
          <p className="text-sm leading-[1.75] text-slate-600 md:text-base">{oneLiner}</p>
        ) : null}

        {/* Price Summary Card (옵션 선택 시 quote 반영) */}
        <Card variant="default" className="border-[#dbeafe] bg-[#f8fbff] p-5 ring-[#dbeafe]">
          {displayPrice ? (
            <p className="font-price-strong text-xl font-bold text-[#1E3A8A] md:text-2xl">
              ₩{displayPrice}~
            </p>
          ) : (
            <p className="font-price-strong text-xl font-semibold text-slate-600 md:text-2xl">
              상담 후 견적 안내
            </p>
          )}
          {(displayDuration || priceMeta) && (
            <p className="mt-1 text-sm text-slate-500">
              {[displayDuration, priceMeta].filter(Boolean).join(" · ")}
            </p>
          )}
          {typeof fuelIncluded === "boolean" && (
            <p className="mt-0.5 text-xs text-slate-500">
              {fuelIncluded ? "유류할증료 포함" : "유류할증료 별도"}
            </p>
          )}
          <p className="mt-0.5 text-xs text-slate-500">유류할증료는 상담 시 안내</p>
        </Card>

        {hasOptions && (
          <div id="product-options-panel" ref={optionsPanelRef}>
            <OptionPanel
              options={options}
              selected={selectedOptions}
              onSelectionChange={handleOptionChange}
            />
          </div>
        )}

        {hasOptions && (quote.total != null || quote.basePrice != null || quote.breakdown.length > 0) && (
          <QuoteSummary quote={quote} />
        )}

        {/* Trust Signals: 데이터 있을 때만 */}
        <TrustSignals trust={trust} />

        {/* CTA 2개 (SOLD_OUT 시 대기 문의). 필수 옵션 미선택 시 인라인 안내 */}
        {requiredGroupsMissing && (
          <p className="text-sm text-amber-600">
            필수 옵션을 선택해 주세요.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {productId != null || isSoldOut || !consultHref ? (
            <Button variant="primary" size="md" onClick={handlePrimaryCta}>
              {isSoldOut ? "대기 문의" : "상담 문의"}
            </Button>
          ) : (
            <a href={consultHref}>
              <Button variant="primary" size="md">
                상담 문의
              </Button>
            </a>
          )}
          {kakaoHref ? (
            <a href={kakaoHref} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="md">
                카톡 상담
              </Button>
            </a>
          ) : null}
        </div>
      </section>

      {/* Tabs */}
      <section>
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v as MainTab)} className="mb-4 flex flex-wrap gap-2">
          <TabsTrigger value="schedule">일정 안내</TabsTrigger>
          <TabsTrigger value="included">포함/불포함</TabsTrigger>
          <TabsTrigger value="booking">예약 조건</TabsTrigger>
          <TabsTrigger value="refund">환불/취소 규정</TabsTrigger>
        </Tabs>

        {activeTab === "schedule" && (
          <div className="space-y-2">
            {hasSchedule ? (
              scheduleDays.map((day, index) => {
                const isOpen = openAccordionIndex === index;
                return (
                  <Card key={`${day.label}-${index}`} variant="default" className="overflow-hidden border-[#dbeafe] bg-[#f8fbff] ring-[#dbeafe]">
                    <button
                      type="button"
                      onClick={() => setOpenAccordionIndex(isOpen ? null : index)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#eff6ff]"
                    >
                      <span className="flex-1 font-semibold text-[#0f172a]">{day.label}</span>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-slate-500 transition ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="border-t border-[#dbeafe] px-4 pb-4 pt-2">
                        <p className="whitespace-pre-line text-sm leading-[1.7] text-slate-700">
                          {day.content}
                        </p>
                      </div>
                    )}
                  </Card>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">일정 정보 준비 중입니다.</p>
            )}
          </div>
        )}

        {activeTab === "included" && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-bold text-[#1e3a8a]">포함 사항</h3>
              {includedLines.length > 0 ? (
                <ul className={listClass}>
                  {includedLines.map((line, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={bulletClass} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">등록된 포함 사항이 없습니다.</p>
              )}
            </div>
            <AlertCard variant="warning" title="불포함 사항">
              {excludedLines.length > 0 ? (
                <ul className={listClass}>
                  {excludedLines.map((line, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">등록된 불포함 사항이 없습니다.</p>
              )}
            </AlertCard>
            {optionalLines.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-bold text-[#1e3a8a]">선택 관광</h3>
                <ul className={listClass}>
                  {optionalLines.map((line, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={bulletClass} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "booking" && (
          <div className="space-y-5">
            <ul className="space-y-3">
              {minDeparturePeople?.trim() && (
                <li className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <span className="text-sm leading-[1.7] text-slate-700">
                    출발 인원: {minDeparturePeople.trim()}명 이상 확정 시 출발
                  </span>
                </li>
              )}
              <li className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <span className="text-sm leading-[1.7] text-slate-700">
                  최종 일정·가격은 상담 후 확정됩니다.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <span className="text-sm leading-[1.7] text-slate-700">
                  문의 주시면 맞춤 견적과 예약 절차를 안내해 드립니다.
                </span>
              </li>
            </ul>
            {termsLines.length > 0 && (
              <AlertCard variant="info" title="예약 시 유의사항">
                <ul className="mt-2 space-y-1">
                  {termsLines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </AlertCard>
            )}
          </div>
        )}

        {activeTab === "refund" && (
          <div>
            {termsLines.length > 0 ? (
              <AlertCard variant="neutral" title="환불 및 취소 규정">
                <ul className="mt-2 space-y-2 leading-[1.7]">
                  {termsLines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </AlertCard>
            ) : (
              <AlertCard variant="info" title="환불 규정">
                <p>
                  상품별 상세 환불·취소 규정은 상담 시 안내해 드립니다. 문의해 주시면 기간별 취소 수수료와
                  절차를 안내해 드립니다.
                </p>
              </AlertCard>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
