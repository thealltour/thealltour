import { HomeProductCardRail } from "@/components/products/HomeProductCardRail";
import { LandingFaqAccordion } from "@/components/hardcoded-landings/shared/LandingFaqAccordion";
import { HardcodedLandingShell } from "@/components/hardcoded-landings/shared/HardcodedLandingShell";
import { KakaoSyncTimeline } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncTimeline";
import { KakaoSyncGolfFixedCta } from "@/components/hardcoded-landings/kakao-sync-golf/KakaoSyncGolfFixedCta";
import { kakaoSyncGolfConfig } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";
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
  const { hero, benefit, products: productsCopy, timeline, faq } = kakaoSyncGolfConfig;

  return (
    <>
      <div className="pb-24">
        {/* 히어로 — 전폭 이미지, 셸 밖 */}
        <section aria-label="Hero" className="relative mx-auto w-full max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element -- 외부 히어로 URL */}
          <img
            src={hero.imageUrl}
            alt={hero.imageAlt}
            className="block h-auto w-full"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-6 pb-8 text-white">
            <p className="text-base font-extrabold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
              {hero.title}
            </p>
            <h1 className="mt-2 whitespace-pre-line text-3xl font-extrabold leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              {hero.subtitle}
            </h1>
          </div>
        </section>

        <HardcodedLandingShell className="space-y-10 py-8">
          {/* 혜택 */}
          <section aria-label="Benefit">
            <div className="rounded-2xl bg-[#f8f9fa] px-4 py-5">
              <h2 className="text-base font-bold text-slate-900">{benefit.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
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
                <p className="mt-3 text-xs text-slate-500">{benefit.footnote}</p>
              ) : null}
            </div>
          </section>

          {/* 시스템 안내 타임라인 */}
          <KakaoSyncTimeline
            title={timeline.sectionTitle}
            description={timeline.sectionDescription}
            steps={[...timeline.steps]}
          />

          {/* 추천 상품 — 홈과 동일 레일 */}
          {products.length > 0 ? (
            <section aria-label="추천 골프투어">
              <div className="-mx-2">
                {(productsEyebrow ?? productsCopy.eyebrowFallback) ? (
                  <p className="px-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">
                    {productsEyebrow ?? productsCopy.eyebrowFallback}
                  </p>
                ) : null}
                <h2 className="mt-0.5 px-2 text-lg font-bold text-slate-900">
                  {productsTitle ?? productsCopy.titleFallback}
                </h2>
                {(productsDescription ?? productsCopy.descriptionFallback) ? (
                  <p className="mt-1 px-2 text-sm text-slate-600">
                    {productsDescription ?? productsCopy.descriptionFallback}
                  </p>
                ) : null}
                <div className="mt-4">
                  <HomeProductCardRail
                    products={products}
                    priceDisplay="coinBenefit"
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
