import { MessageCircle, Star } from "lucide-react";
import { kakaoSyncGolfConfig } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";

/** 고객 후기만 — 상품 노출 직후(확신 부여)에 배치 */
export function KakaoSyncReviewsSection() {
  const { trust } = kakaoSyncGolfConfig;

  return (
    <section aria-label="고객 후기" className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
        <MessageCircle className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden />
        {trust.reviewsHeading}
      </p>
      <ul className="mt-2 space-y-2.5">
        {trust.reviews.map((review) => (
          <li
            key={`${review.name}-${review.persona}`}
            className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-[0_1px_4px_rgba(15,23,42,0.06)]"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label="별점 5점">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden />
                ))}
              </span>
              <span className="text-sm font-bold text-slate-900">{review.name} 님</span>
              <span className="text-xs text-slate-500">({review.persona})</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{review.productLine}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">&ldquo;{review.quote}&rdquo;</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {review.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-md bg-[var(--accent)]/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--accent)]"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
