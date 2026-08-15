import { Flame, ShieldCheck, Users } from "lucide-react";
import { HomeTrustSection } from "@/components/home/HomeTrustSection";
import { HomeProductCardRail } from "@/components/products/HomeProductCardRail";
import { LandingFaqAccordion } from "@/components/hardcoded-landings/shared/LandingFaqAccordion";
import { HardcodedLandingShell } from "@/components/hardcoded-landings/shared/HardcodedLandingShell";
import { KakaoSyncCouponVisual } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncCouponVisual";
import { KakaoSyncGolfViewTracker } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncGolfViewTracker";
import { KakaoSyncSectionViewTracker } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncSectionViewTracker";
import { KakaoSyncTrustBadgesSection } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncTrustBadgesSection";
import { KakaoSyncReviewsSection } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncReviewsSection";
import {
  KAKAO_SYNC_HERO_ACCENT,
  kakaoSyncGolfConfig,
} from "@/lib/hardcodedLandings/kakaoSyncGolf/config";
import { getKakaoSyncDailySocialProofCount } from "@/lib/hardcodedLandings/kakaoSyncGolf/dailySocialProofCount";
import type { Product } from "@/types/product";

export type KakaoSyncGolfLandingPageProps = {
  products: Product[];
  tourismRegNo?: string;
};

/**
 * 스크롤 흐름: 히어로(흥미) → 쿠폰·할인표(혜택 이해) → 안심 뱃지(신뢰)
 * → 상품(증거) → 후기(확신) → FAQ(이탈 방지) → 홈 신뢰 카드(재확인).
 * 3·5·7번은 전폭 muted 배경 띠로 감싸 4·6번(흰 배경)과 교대 대비를 줌.
 */
export function KakaoSyncGolfLandingPage({ products, tourismRegNo }: KakaoSyncGolfLandingPageProps) {
  const { hero, benefit, products: productsCopy, faq } = kakaoSyncGolfConfig;
  const dailySocialProofCount = getKakaoSyncDailySocialProofCount();

  return (
    <>
      <KakaoSyncGolfViewTracker />
      <div className="hardcoded-landing-page">
        {/* 1. 히어로 — Hierarchy: 핵심 혜택 → 대표 1명 편의 → 사회적 증거 */}
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
            {/* 밝은 골프장 배경 대비: 전면 어둡기 + 하단 텍스트 가독성 보강 */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(0,0,0,0.42), rgba(0,0,0,0.58) 45%, rgba(0,0,0,0.78))",
              }}
              aria-hidden
            />
            <div className="absolute inset-x-0 bottom-0 px-4 pb-3 text-white">
              {hero.eyebrow ? (
                <p className="text-[0.6875rem] font-semibold tracking-wide text-white/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]">
                  {hero.eyebrow}
                </p>
              ) : null}
              <h1 className="heading-display-hero mt-1.5 text-[1.5rem] font-extrabold leading-[1.25] [word-break:keep-all] drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:text-3xl sm:leading-tight">
                {hero.titleSegments.map((segment, index) =>
                  segment.type === "break" ? (
                    <br key={index} />
                  ) : segment.type === "accent" ? (
                    <span key={index} style={{ color: KAKAO_SYNC_HERO_ACCENT }}>
                      {segment.value}
                    </span>
                  ) : (
                    <span key={index}>{segment.value}</span>
                  ),
                )}
              </h1>
              <p className="mt-1.5 text-sm font-semibold leading-snug text-white/95 [word-break:keep-all] drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] sm:text-base">
                {hero.subtitleLines.map((line, index) => (
                  <span key={line}>
                    {index > 0 ? <br /> : null}
                    {line}
                  </span>
                ))}
              </p>
              {/* 소셜프루프 — 실 가입 수 조회 없이 KST 날짜 기준 결정론적 값(75~150) */}
              <p className="mt-2.5 flex w-fit items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
                <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden />
                오늘 {dailySocialProofCount}
                {hero.socialProofSuffix}
              </p>
            </div>
          </div>
        </section>

        {/* 2. 쿠폰 그래픽 & 인원별 할인표 — 중복 설명 삭제, 압축 고지문만 유지 */}
        <HardcodedLandingShell className="py-4">
          <KakaoSyncSectionViewTracker sectionName="kakao_sync_benefit" />
          <section aria-label="Benefit">
            <div className="rounded-2xl bg-[var(--surface-muted)] px-3 py-4">
              {/* 핵심 후킹 — 1·2·4·8인 티어를 먼저 보여줘 혜택 크기를 이해시키고,
                  바로 아래 실물 쿠폰 그래픽으로 "이렇게 지급된다"는 증거를 이어 붙임 */}
              {benefit.tiers?.length ? (
                <div className="rounded-2xl border-2 border-orange-200 bg-gradient-to-b from-orange-50 to-white p-3.5 shadow-[0_2px_14px_rgba(249,115,22,0.1)]">
                  {benefit.tiersTitle ? (
                    <h3 className="flex items-center gap-1.5 text-base font-extrabold text-slate-900">
                      <Users className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
                      {benefit.tiersTitle}
                    </h3>
                  ) : null}
                  <ul className="mt-2.5 space-y-2">
                    {benefit.tiers.map((tier) =>
                      tier.best ? (
                        <li
                          key={tier.headcountLabel}
                          className="rounded-xl bg-orange-500 px-3.5 py-3 shadow-[0_4px_16px_rgba(249,115,22,0.35)]"
                        >
                          <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                            {tier.headcountLabel}
                            <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[0.625rem] font-extrabold tracking-tight text-orange-600">
                              {tier.badgeLabel ?? "BEST"}
                            </span>
                          </span>
                          <p className="mt-1 text-right text-xl font-extrabold tracking-tight text-white">
                            {tier.amountLabel}
                          </p>
                        </li>
                      ) : tier.emphasize ? (
                        <li
                          key={tier.headcountLabel}
                          className="rounded-xl bg-orange-600 px-3.5 py-3 shadow-[0_4px_16px_rgba(234,88,12,0.35)]"
                        >
                          <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                            {tier.headcountLabel}
                            {tier.badgeLabel ? (
                              <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[0.625rem] font-extrabold tracking-tight text-orange-700">
                                {tier.badgeLabel}
                              </span>
                            ) : null}
                          </span>
                          <p className="mt-1 text-right text-lg font-extrabold tracking-tight text-white">
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
                    <p className="mt-2.5 text-xs leading-relaxed text-slate-600">{benefit.tiersNote}</p>
                  ) : null}
                </div>
              ) : null}

              {/* 실물 쿠폰 그래픽 — 티어표로 이해한 혜택이 실제 지급되는 형태를 보여주는 증거 */}
              <div className="mt-4">
                <KakaoSyncCouponVisual />
                <p className="mt-2 text-center text-[0.6875rem] text-slate-400">
                  {benefit.amountLabel} · {benefit.amountSubLabel}
                </p>
              </div>

              {benefit.eligibilityNote ? (
                <p className="mt-2 text-center text-[0.6875rem] text-slate-400">
                  {benefit.eligibilityNote}
                </p>
              ) : null}

              {benefit.reassurance ? (
                <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    {benefit.reassurance.title}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {benefit.reassurance.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex gap-2 text-[13px] leading-snug text-slate-600"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-600" aria-hidden />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        </HardcodedLandingShell>

        {/* 3. 안심 보장 — 상품 보기 전 신뢰 구축, muted 배경 띠로 구분 */}
        <section aria-label="안심 보장 배경" className="w-full bg-[var(--surface-muted)] py-5">
          <HardcodedLandingShell>
            <KakaoSyncSectionViewTracker sectionName="kakao_sync_trust" />
            <KakaoSyncTrustBadgesSection />
          </HardcodedLandingShell>
        </section>

        {/* 4. 할인 적용 대표 상품 — 팀(4인) 총할인 가치 증거 */}
        <HardcodedLandingShell className="py-5">
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
                    priceDisplay="teamCouponBenefit"
                    edgeInset="compact"
                    analyticsSection="kakao_sync_golf_landing"
                    listAriaLabel="추천 골프투어"
                  />
                </div>
              </div>
            </section>
          ) : null}
        </HardcodedLandingShell>

        {/* 5. 고객 후기 — muted 배경 띠로 구분, 확신 부여 */}
        <section aria-label="고객 후기 배경" className="w-full bg-[var(--surface-muted)] py-5">
          <HardcodedLandingShell>
            <KakaoSyncSectionViewTracker sectionName="kakao_sync_reviews" />
            <KakaoSyncReviewsSection />
          </HardcodedLandingShell>
        </section>

        {/* 6. FAQ — 이탈 방지 */}
        <HardcodedLandingShell className="py-5">
          <KakaoSyncSectionViewTracker sectionName="kakao_sync_faq" />
          <LandingFaqAccordion
            sectionTitle={faq.sectionTitle}
            items={[...faq.items]}
          />
        </HardcodedLandingShell>

        {/* 7. 홈과 동일한 신뢰 카드 — FAQ 아래·고정 CTA 위 */}
        <section aria-label="신뢰 배경" className="w-full bg-[var(--surface-muted)] py-5">
          <HardcodedLandingShell>
            <KakaoSyncSectionViewTracker sectionName="kakao_sync_home_trust" />
            <HomeTrustSection stackCards tourismRegNo={tourismRegNo} />
          </HardcodedLandingShell>
        </section>
      </div>
    </>
  );
}
