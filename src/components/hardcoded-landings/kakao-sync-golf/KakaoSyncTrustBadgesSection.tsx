import { ShieldCheck } from "lucide-react";
import { kakaoSyncGolfConfig } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";

/** 안심 보장 뱃지만 — 상품 노출 직전(구매 장벽 낮추기)에 배치 */
export function KakaoSyncTrustBadgesSection() {
  const { trust } = kakaoSyncGolfConfig;

  return (
    <section aria-label="안심 보장" className="space-y-3">
      <h2 className="text-lg font-bold text-slate-900">{trust.badgesSectionTitle}</h2>
      <ul className="grid grid-cols-2 gap-1.5">
        {trust.badges.map((badge, index) => (
          <li
            key={badge}
            className={`inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800${
              index === 2 ? " col-span-2" : ""
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {badge}
          </li>
        ))}
      </ul>
    </section>
  );
}
