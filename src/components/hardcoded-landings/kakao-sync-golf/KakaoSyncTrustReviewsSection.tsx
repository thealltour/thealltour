import { ShieldCheck, Star } from "lucide-react";
import { kakaoSyncGolfConfig } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";

export function KakaoSyncTrustReviewsSection() {
  const { trust } = kakaoSyncGolfConfig;

  return (
    <section aria-label="안심 보장 및 후기" className="space-y-3">
      <h2 className="text-lg font-bold text-slate-900">{trust.sectionTitle}</h2>

      <ul className="flex flex-wrap gap-1.5">
        {trust.badges.map((badge) => (
          <li
            key={badge}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {badge}
          </li>
        ))}
      </ul>

      <div>
        <p className="text-sm font-bold text-slate-800">{trust.reviewsHeading}</p>
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
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">&ldquo;{review.quote}&rdquo;</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {review.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-md bg-orange-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-orange-700"
                  >
                    🏷️ {tag}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
