/**
 * 문의 페이지 상단 요약 카드. 어떤 상품을 문의 중인지 컨텍스트 유지.
 * ProductSummaryInfo보다 단순한 정보만 표시.
 */

type QuoteSummaryCardProps = {
  productTitle: string;
  duration?: string | null;
  region?: string | null;
  price?: number | null;
};

export function QuoteSummaryCard({
  productTitle,
  duration,
  region,
  price,
}: QuoteSummaryCardProps) {
  const parts: string[] = [];
  if (duration?.trim()) parts.push(`여행기간 ${duration}`);
  if (region?.trim()) parts.push(`출발지역 ${region}`);
  const subtitle = parts.length > 0 ? parts.join(" · ") : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm">
      <p className="font-medium text-slate-900">{productTitle}</p>
      {subtitle && <p className="mt-1 text-slate-600">{subtitle}</p>}
      {typeof price === "number" && price > 0 && (
        <p className="mt-1 font-medium text-slate-900">{price.toLocaleString()}원~</p>
      )}
    </div>
  );
}
