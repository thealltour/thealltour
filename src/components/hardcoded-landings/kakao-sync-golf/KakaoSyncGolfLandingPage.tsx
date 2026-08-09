import { Flame, Users } from "lucide-react";
import { HomeProductCardRail } from "@/components/products/HomeProductCardRail";
import { LandingFaqAccordion } from "@/components/hardcoded-landings/shared/LandingFaqAccordion";
import { HardcodedLandingShell } from "@/components/hardcoded-landings/shared/HardcodedLandingShell";
import { KakaoSyncGolfFixedCta } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncGolfFixedCta";
import { KakaoSyncGolfInlineCta } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncGolfInlineCta";
import { KakaoSyncGolfViewTracker } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncGolfViewTracker";
import { KakaoSyncSectionViewTracker } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncSectionViewTracker";
import { kakaoSyncGolfConfig } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";
import { getKakaoSyncDailySocialProofCount } from "@/lib/hardcodedLandings/kakaoSyncGolf/dailySocialProofCount";
import type { Product } from "@/types/product";

export type KakaoSyncGolfLandingPageProps = {
  products: Product[];
};

export function KakaoSyncGolfLandingPage({ products }: KakaoSyncGolfLandingPageProps) {
  const { hero, benefit, products: productsCopy, faq } = kakaoSyncGolfConfig;
  const dailySocialProofCount = getKakaoSyncDailySocialProofCount();

  return (
    <>
      <KakaoSyncGolfViewTracker />
      <div className="hardcoded-landing-page pb-24">
        {/* 히어로 — 셸과 동일 px-4 거터 + 라운드 (홈 히어로·섹션 래퍼와 톤 맞춤) */}
        <section aria-label="Hero" className="relative w-full px-4 pt-2">
          <div className="relative overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- 외부 히어로 URL */}
            <img
              src={hero.imageUrl}
              alt={hero.imageAlt}
              className="block h-auto w-full"
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 px-4 pb-2.5 text-white">
              <p className="text-base font-extrabold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
                {hero.title}
              </p>
              <h1 className="heading-display-hero mt-2 whitespace-pre-line text-3xl font-extrabold leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
                {hero.subtitle}
              </h1>
              {/* 소셜프루프 — 헤드라인과 같은 시야에서 즉시 인지되도록 Hero 오버레이 안에 배치.
                  실 가입 수 조회 없이 KST 날짜 기준 결정론적 값(75~150), 매일 00시 전환 */}
              <p className="mt-2.5 flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden />
                오늘 {dailySocialProofCount}명이 5만원 쿠폰팩을 받았어요
              </p>
            </div>
          </div>
        </section>

        <HardcodedLandingShell className="space-y-5 py-3">
          {/* 혜택 — 광고 소재(5만원 쿠폰팩)와 동일 문구를 첫 스크롤에서 확인 가능하도록 강조 */}
          <KakaoSyncSectionViewTracker sectionName="kakao_sync_benefit" />
          <section aria-label="Benefit">
            <div className="rounded-2xl bg-[#f8f9fa] px-3 py-4">
              {/* 기본 혜택 카피 — 티어 섹션(핵심 후킹)에 시선을 넘겨주는 보조 인트로로 축소 */}
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{benefit.title}</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <p className="text-2xl font-extrabold tracking-tight text-orange-500">
                  {benefit.amountLabel}
                </p>
                <p className="text-sm font-semibold text-slate-600">{benefit.amountSubLabel}</p>
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {benefit.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  >
                    {highlight}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                {benefit.segments.map((segment, index) =>
                  segment.type === "highlight" ? (
                    <span key={index} className="font-bold text-orange-500">
                      {segment.value}
                    </span>
                  ) : (
                    <span key={index} className="whitespace-pre-line">
                      {segment.value}
                    </span>
                  ),
                )}
              </p>
              {benefit.footnote ? (
                <p className="mt-1 text-[0.6875rem] text-slate-400">{benefit.footnote}</p>
              ) : null}

              {/* 핵심 후킹 포인트 — 인원수별 할인 티어. 이번 캠페인의 주인공이므로 카드/보더/그림자로
                  분리해 다른 정보보다 눈에 먼저 들어오게 하고, BEST(4인 1팀) 행은 한 단계 더 강조 */}
              {benefit.tiers?.length ? (
                <div className="mt-4 rounded-2xl border-2 border-orange-200 bg-gradient-to-b from-orange-50 to-white p-3.5 shadow-[0_2px_14px_rgba(249,115,22,0.1)]">
                  {benefit.tiersTitle ? (
                    <h3 className="flex items-center gap-1.5 text-base font-extrabold text-slate-900">
                      <Users className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
                      {benefit.tiersTitle}
                    </h3>
                  ) : null}
                  <ul className="mt-2.5 space-y-2">
                    {benefit.tiers.map((tier) =>
                      tier.best ? (
                        // BEST 티어는 라벨(헤드카운트+뱃지)과 금액을 한 줄에 나란히 두면 375px 모바일에서
                        // 폭이 부족해 잘리므로, 금액을 별도 줄에 크게(text-xl) 배치해 안전하게 표시
                        <li
                          key={tier.headcountLabel}
                          className="rounded-xl bg-orange-500 px-3.5 py-3 shadow-[0_4px_16px_rgba(249,115,22,0.35)]"
                        >
                          <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                            {tier.headcountLabel}
                            <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[0.625rem] font-extrabold tracking-tight text-orange-600">
                              BEST
                            </span>
                          </span>
                          <p className="mt-1 text-right text-xl font-extrabold tracking-tight text-white">
                            {tier.amountLabel}
                          </p>
                        </li>
                      ) : (
                        <li
                          key={tier.headcountLabel}
                          className="flex items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm"
                        >
                          <span className="min-w-0 flex-1 font-medium text-slate-500">
                            {tier.headcountLabel}
                          </span>
                          <span className="shrink-0 whitespace-nowrap font-bold text-slate-800">
                            {tier.amountLabel}
                          </span>
                        </li>
                      ),
                    )}
                  </ul>
                  {benefit.tiersNote ? (
                    <p className="mt-2.5 text-xs leading-relaxed text-slate-500">{benefit.tiersNote}</p>
                  ) : null}
                </div>
              ) : null}

              <KakaoSyncGolfInlineCta />

              {/* 안심 보조 정보 — CTA 하위, 폰트/톤을 낮춰 후순위로 표시 */}
              {benefit.trustFlow ? (
                <p className="mt-2 flex w-full items-center justify-center rounded-full bg-white px-3 py-1.5 text-center text-[0.6875rem] font-medium text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                  {benefit.trustFlow}
                </p>
              ) : null}
            </div>
          </section>

          {/* 추천 상품 — 가치 증거(정가→회원가)와 브라우징을 한 섹션으로 병합, 홈 레일과 동일 컴포넌트 재사용 */}
          <KakaoSyncSectionViewTracker sectionName="kakao_sync_products" />
          {products.length > 0 ? (
            <section aria-label="추천 골프투어">
              <div>
                {productsCopy.eyebrowFallback ? (
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">
                    {productsCopy.eyebrowFallback}
                  </p>
                ) : null}
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">{productsCopy.titleFallback}</h2>
                {productsCopy.descriptionFallback ? (
                  <p className="mt-0.5 text-sm text-slate-600">{productsCopy.descriptionFallback}</p>
                ) : null}
                <div className="mt-1.5">
                  <HomeProductCardRail
                    products={products}
                    priceDisplay="coinBenefit"
                    edgeInset="compact"
                    analyticsSection="kakao_sync_golf_landing"
                    listAriaLabel="추천 골프투어"
                  />
                </div>
              </div>
            </section>
          ) : null}

          {/* FAQ */}
          <KakaoSyncSectionViewTracker sectionName="kakao_sync_faq" />
          <LandingFaqAccordion
            sectionTitle={faq.sectionTitle}
            items={[...faq.items]}
          />
        </HardcodedLandingShell>
      </div>

      <KakaoSyncGolfFixedCta />
    </>
  );
}
