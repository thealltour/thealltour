import { Flame } from "lucide-react";
import { HomeProductCard } from "@/components/products/HomeProductCard";
import { HomeProductCardRail } from "@/components/products/HomeProductCardRail";
import { LandingFaqAccordion } from "@/components/hardcoded-landings/shared/LandingFaqAccordion";
import { HardcodedLandingShell } from "@/components/hardcoded-landings/shared/HardcodedLandingShell";
import { KakaoSyncGolfFixedCta } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncGolfFixedCta";
import { KakaoSyncGolfViewTracker } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncGolfViewTracker";
import { kakaoSyncGolfConfig } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";
import { getKakaoSyncDailySocialProofCount } from "@/lib/hardcodedLandings/kakaoSyncGolf/dailySocialProofCount";
import type { Product } from "@/types/product";

export type KakaoSyncGolfLandingPageProps = {
  products: Product[];
  productsEyebrow?: string | null;
  productsTitle?: string | null;
  productsDescription?: string | null;
};

export function KakaoSyncGolfLandingPage({
  products,
  productsEyebrow,
  productsTitle,
  productsDescription,
}: KakaoSyncGolfLandingPageProps) {
  const { hero, benefit, valueProof, products: productsCopy, faq } = kakaoSyncGolfConfig;
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
              <h1 className="mt-2 whitespace-pre-line text-3xl font-extrabold leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
                {hero.subtitle}
              </h1>
              {/* 소셜프루프 — 헤드라인과 같은 시야에서 즉시 인지되도록 Hero 오버레이 안에 배치.
                  실 가입 수 조회 없이 KST 날짜 기준 결정론적 값(75~150), 매일 00시 전환 */}
              <p className="mt-2.5 flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden />
                오늘 {dailySocialProofCount}명이 3만 포인트를 받았어요
              </p>
            </div>
          </div>
        </section>

        <HardcodedLandingShell className="space-y-3 py-2.5">
          {/* 혜택 — 광고 소재(3만 포인트)와 동일 문구를 첫 스크롤에서 확인 가능하도록 강조 */}
          <section aria-label="Benefit">
            <div className="rounded-2xl bg-[#f8f9fa] px-3 py-3">
              <h2 className="text-base font-bold text-slate-900">{benefit.title}</h2>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-orange-500">
                {benefit.amountLabel}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">{benefit.amountSubLabel}</p>
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
                <p className="mt-1 text-xs text-slate-500">{benefit.footnote}</p>
              ) : null}
            </div>
          </section>

          {/* 실물 가치 증거 — 타임라인 대신 대표 상품 1건의 정가→회원가(−3만원)를 그대로 보여줌 */}
          {products[0] ? (
            <section aria-label="포인트 가치 예시">
              <p className="text-sm font-bold text-slate-900">{valueProof.title}</p>
              <div className="mt-2 max-w-[220px]">
                <HomeProductCard
                  product={products[0]}
                  variant="rail"
                  priceDisplay="coinBenefit"
                  analyticsSection="kakao_sync_golf_landing_value_proof"
                />
              </div>
            </section>
          ) : null}

          {/* 추천 상품 — 홈과 동일 레일 */}
          {products.length > 0 ? (
            <section aria-label="추천 골프투어">
              <div>
                {(productsEyebrow ?? productsCopy.eyebrowFallback) ? (
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">
                    {productsEyebrow ?? productsCopy.eyebrowFallback}
                  </p>
                ) : null}
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                  {productsTitle ?? productsCopy.titleFallback}
                </h2>
                {(productsDescription ?? productsCopy.descriptionFallback) ? (
                  <p className="mt-0.5 text-sm text-slate-600">
                    {productsDescription ?? productsCopy.descriptionFallback}
                  </p>
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
