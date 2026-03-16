type ProductSummaryInfoProps = {
  duration?: string;
  departure?: string;
  airline?: string;
  hotel?: string;
  travelStyle?: string;
  price?: number;
};

export default function ProductSummaryInfo({
  duration,
  departure,
  airline,
  hotel,
  travelStyle,
  price,
}: ProductSummaryInfoProps) {
  const hasAny = duration || departure || airline || hotel || travelStyle || (typeof price === "number" && price > 0);
  if (!hasAny) return null;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
      aria-label="상품 핵심 요약"
    >
      <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
        {duration && (
          <>
            <span className="text-slate-500">여행기간</span>
            <span className="text-slate-900">{duration}</span>
          </>
        )}

        {departure && (
          <>
            <span className="text-slate-500">출발지역</span>
            <span className="text-slate-900">{departure}</span>
          </>
        )}

        {airline && (
          <>
            <span className="text-slate-500">항공</span>
            <span className="text-slate-900">{airline}</span>
          </>
        )}

        {hotel && (
          <>
            <span className="text-slate-500">숙소</span>
            <span className="text-slate-900">{hotel}</span>
          </>
        )}

        {travelStyle && (
          <>
            <span className="text-slate-500">여행스타일</span>
            <span className="text-slate-900">{travelStyle}</span>
          </>
        )}
      </div>

      {typeof price === "number" && price > 0 && (
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-sm text-slate-500">가격</span>
          <span className="text-lg font-semibold text-slate-900">
            {price.toLocaleString()}원~
          </span>
        </div>
      )}
    </section>
  );
}
