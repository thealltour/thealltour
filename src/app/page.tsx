import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, Users, Route, CheckCircle2 } from "lucide-react";
import InquiryForm from "@/components/InquiryForm";
import SiteHeader from "@/components/SiteHeader";
import HomeTopBanner from "@/components/HomeTopBanner";
import { getFeaturedProducts } from "@/lib/products";
import { getHomeBanners } from "@/lib/homeBanners";
import { getProductBadges } from "@/lib/productCategory";

export default async function Home() {
  const [featuredProducts, topBanners] = await Promise.all([getFeaturedProducts(), getHomeBanners()]);
  const categories = Array.from(
    new Set(featuredProducts.map((product) => product.category?.trim()).filter(Boolean)),
  ) as string[];

  const usedIds = new Set<string>();

  function pickProducts(
    matcher: (category?: string | null, theme?: string | null) => boolean,
    fallbackCount: number,
  ) {
    const primary = featuredProducts.filter((product) =>
      matcher(product.category, product.theme ?? null),
    );
    const picked: typeof featuredProducts = [];

    for (const product of primary) {
      if (picked.length >= fallbackCount) break;
      if (usedIds.has(product.id)) continue;
      picked.push(product);
      usedIds.add(product.id);
    }

    if (picked.length < fallbackCount) {
      for (const product of featuredProducts) {
        if (picked.length >= fallbackCount) break;
        if (usedIds.has(product.id)) continue;
        picked.push(product);
        usedIds.add(product.id);
      }
    }

    return picked;
  }

  const curatedGolf = pickProducts(
    (category, theme) =>
      (category ?? "").includes("골프") || (theme ?? "").includes("골프"),
    3,
  );

  const curatedClub = pickProducts(
    (category, theme) =>
      (theme ?? "").includes("동호회") ||
      (theme ?? "").includes("단체") ||
      (category ?? "").includes("단체"),
    3,
  );

  const curatedPremium = pickProducts(
    (category, theme) =>
      (theme ?? "").includes("프리미엄") ||
      (theme ?? "").includes("한정") ||
      (theme ?? "").includes("럭셔리"),
    3,
  );

  return (
    <div className="min-h-screen bg-[#0F172A] text-site-primary">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 py-10 md:px-10">
        {topBanners.length > 0 ? <HomeTopBanner banners={topBanners} /> : null}

        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1B2431] via-[#0F172A] to-[#0B1220] px-8 py-16 text-white shadow-xl ring-1 ring-site-border md:px-14 md:py-20">
          <div className="relative z-10 grid gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.15fr)]">
            {/* 왼쪽: 브랜드 메시지 + 신뢰 문구 */}
            <div className="space-y-6">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold tracking-[0.18em] text-blue-50 md:text-sm">
                THEALL TOUR PREMIUM GOLF
              </p>
              <h1 className="heading-display-hero text-3xl font-semibold leading-tight md:text-5xl">
                <span className="text-[#C9A227]">품격 있는</span> 골프와 여행의 시작
              </h1>
              <p className="max-w-xl text-sm font-semibold text-blue-50 md:text-base">
                전담 상담사가 1:1 맞춤 설계를 진행하여, 일정·동행 구성·예산에 맞는 골프&여행 코스를 함께
                정리해 드립니다.
              </p>
              <ul className="space-y-1.5 text-sm text-blue-50/95">
                <li>· 전화·메신저로 편하게 상담 시작</li>
                <li>· 일정·항공·골프장까지 한 번에 비교 제안</li>
                <li>· 출발 전·후 안내까지 전담 상담사가 지속 케어</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 신뢰 강조 섹션 */}
        <section className="rounded-3xl bg-[#162133] px-6 py-12 md:px-10 ring-1 ring-site-border">
          <div className="mb-8 space-y-3 text-center">
            <p className="inline-flex items-center justify-center rounded-full border border-[#C9A227]/40 bg-[#111C2D] px-4 py-1 text-[11px] font-semibold text-[#C9A227] md:text-xs">
              모두투어 · 하나투어 공식 제휴 파트너
            </p>
            <p className="text-xs font-semibold tracking-[0.18em] text-[#60a5fa] md:text-sm">
              THEALL TOUR TRUST
            </p>
            <h3 className="heading-display text-2xl font-semibold text-site-primary md:text-3xl">
              안심하고 맡길 수 있는 여행 파트너
            </h3>
            <p className="mx-auto max-w-2xl text-sm text-site-muted">
              대형 여행사와의 공식 제휴와 검증된 일정 운영 경험을 바탕으로, 안정적인 예약과 운영을 약속드립니다.
            </p>
          </div>

          <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex h-full flex-col rounded-2xl bg-[#111C2D] p-5 text-site-secondary ring-1 ring-site-border">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F172A] ring-1 ring-site-border">
                  <ShieldCheck className="h-5 w-5 text-[#C9A227]" />
                </span>
                <p className="text-sm font-semibold text-site-primary">대형 여행사 공식 제휴</p>
              </div>
              <p className="text-xs leading-relaxed text-site-muted">
                모두투어·하나투어 등 주요 파트너와 협력하여, 검증된 상품과 안정적인 예약 시스템을 기반으로
                운영합니다.
              </p>
            </div>

            <div className="flex h-full flex-col rounded-2xl bg-[#111C2D] p-5 text-site-secondary ring-1 ring-site-border">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F172A] ring-1 ring-site-border">
                  <Users className="h-5 w-5 text-[#C9A227]" />
                </span>
                <p className="text-sm font-semibold text-site-primary">전문 상담사 1:1 배정</p>
              </div>
              <p className="text-xs leading-relaxed text-site-muted">
                연령대·동행 구성·예산을 이해하는 담당자가 처음 상담부터 귀국까지 책임지고 함께하며, 필요한
                내용을 차분하게 설명해 드립니다.
              </p>
            </div>

            <div className="flex h-full flex-col rounded-2xl bg-[#111C2D] p-5 text-site-secondary ring-1 ring-site-border">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F172A] ring-1 ring-site-border">
                  <Route className="h-5 w-5 text-[#C9A227]" />
                </span>
                <p className="text-sm font-semibold text-site-primary">단체·동호회 맞춤 설계</p>
              </div>
              <p className="text-xs leading-relaxed text-site-muted">
                회사·동호회·가족 모임 등 인원과 목적에 맞춘 일정으로 이동 동선과 일정 피로도를 최소화한
                코스를 제안합니다.
              </p>
            </div>

            <div className="flex h-full flex-col rounded-2xl bg-[#111C2D] p-5 text-site-secondary ring-1 ring-site-border">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F172A] ring-1 ring-site-border">
                  <CheckCircle2 className="h-5 w-5 text-[#C9A227]" />
                </span>
              <p className="text-sm font-semibold text-site-primary">안전 기준을 통과한 일정</p>
              </div>
              <p className="text-xs leading-relaxed text-site-muted">
                현지 가이드·차량·숙소까지 사전 점검된 일정만 운영하며, 돌발 상황에도 대응 가능한 안전
                프로세스를 갖추고 있습니다.
              </p>
            </div>
          </div>
        </section>

        {/* 메인 카테고리 섹션 - 골프 우선 구조 */}
        <section className="space-y-8 rounded-3xl bg-[#162133] px-6 py-12 md:px-10 ring-1 ring-site-border">
          <div className="space-y-2 text-left md:text-center">
            <p className="heading-display text-[11px] font-semibold tracking-[0.22em] text-site-muted md:text-xs">
              THEALL TOUR PREMIUM
            </p>
            <h3 className="heading-display text-3xl font-semibold tracking-[0.06em] text-site-primary md:text-4xl">
              품격 있는 골프 컬렉션
            </h3>
            <p className="mx-auto max-w-2xl text-sm text-site-muted md:text-base">
              검증된 일정과 안정적인 운영으로 안내합니다.
            </p>
          </div>

          {/* 골프 3종 카테고리 (최상단) */}
          <div className="grid gap-6 md:grid-cols-3">
            <Link
              href="/products?category=해외 골프 투어"
              className="group relative overflow-hidden rounded-3xl bg-[#111C2D] text-white ring-1 ring-site-border transition-colors duration-150 hover:ring-[#3b82f6]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#1B2431] via-[#162133] to-[#0F172A]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_60%)] opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex h-full flex-col justify-between p-6 md:p-7">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-[#C9A227]">
                    해외 골프 투어
                  </p>
                  <h4 className="font-card-title text-xl font-semibold md:text-2xl text-site-primary">
                    일본·동남아 인기 골프 코스
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-site-secondary">
                    항공·그린피·숙박까지 한 번에 맞춘 일정으로, 시즌에 맞는 해외 골프장을 추천해 드립니다.
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center text-[11px] font-semibold text-site-secondary/95">
                  자세히 보기
                  <span className="ml-1 text-[#C9A227]">→</span>
                </span>
              </div>
            </Link>

            <Link
              href="/products?category=국내 골프 투어"
              className="group relative overflow-hidden rounded-3xl bg-[#111C2D] text-white ring-1 ring-site-border transition-colors duration-150 hover:ring-[#3b82f6]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#162133] via-[#111C2D] to-[#0F172A]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_60%)] opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex h-full flex-col justify-between p-6 md:p-7">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-site-primary">
                    국내 골프 투어
                  </p>
                  <h4 className="font-card-title text-xl font-semibold md:text-2xl text-site-primary">
                    제주·국내 프리미엄 라운딩
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-site-secondary">
                    이동 시간이 부담스러운 고객님을 위해, 접근성 좋은 국내 골프장 중심으로 일정을 설계합니다.
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center text-[11px] font-semibold text-site-secondary/90">
                  자세히 보기
                  <span className="ml-1 text-[#C9A227]">→</span>
                </span>
              </div>
            </Link>

            <Link
              href="/products?category=파크골프 전용 투어"
              className="group relative overflow-hidden rounded-3xl bg-[#111C2D] text-white ring-1 ring-site-border transition-colors duration-150 hover:ring-[#3b82f6]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#162133] to-[#111C2D]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.2),_transparent_60%)] opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex h-full flex-col justify-between p-6 md:p-7">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-[#bbf7d0]">
                    파크골프 전용
                  </p>
                  <h4 className="font-card-title text-xl font-semibold md:text-2xl text-site-primary">
                    중장년층 파크골프 맞춤 일정
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-site-secondary">
                    라운딩 강도와 휴식을 함께 고려해, 무리 없이 즐기실 수 있는 파크골프 중심 일정을 제안합니다.
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center text-[11px] font-semibold text-site-secondary/90">
                  자세히 보기
                  <span className="ml-1 text-[#fbbf24]">→</span>
                </span>
              </div>
            </Link>
          </div>

          {/* 일반 해외/국내 여행 카테고리 (골프 아래 배치) */}
          <Link
            href="/products"
            className="group relative mt-6 flex flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-r from-[#1B2431] via-[#162133] to-[#0F172A] text-site-primary ring-1 ring-site-border transition-colors duration-150 hover:ring-[#3b82f6] md:flex-row md:items-center md:px-8 md:py-5"
          >
            <div className="relative px-5 py-5 md:px-0 md:py-4 md:pr-8">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-[#cbd5e1]">
                해외·국내 패키지
              </p>
              <h4 className="font-card-title mt-1 text-lg font-semibold md:text-xl text-site-primary">
                가족·지인과 떠나는 일반 여행
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-site-secondary">
                휴양 중심 동남아, 유럽 패키지, 국내/제주 여행까지 폭넓게 비교 상담해 드립니다.
              </p>
            </div>
            <div className="relative flex items-center justify-end px-5 pb-4 md:px-0 md:pb-0">
              <span className="inline-flex items-center rounded-full border border-[#60a5fa]/40 bg-[#111C2D] px-4 py-2 text-xs font-semibold text-site-primary">
                전체 패키지 상품 보기
                <span className="ml-1 text-[#60a5fa]">→</span>
              </span>
            </div>
          </Link>
        </section>

        <section className="space-y-8 rounded-3xl bg-[#162133] px-6 py-10 md:px-10 ring-1 ring-site-border">
          <div className="space-y-2">
            <p className="text-sm font-semibold tracking-wide text-[#60a5fa]">
              THEALL CURATED PICKS
            </p>
            <h3 className="heading-display text-2xl font-semibold text-site-primary md:text-3xl">
              이번 달 선별 추천 여행
            </h3>
            <p className="text-sm text-site-muted">
              쇼핑몰식 전체 나열이 아닌, 더올투어가 직접 선별한 코스 중심의 추천 상품입니다.
            </p>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-sm text-site-muted shadow-md ring-1 ring-[#e2e8f0]">
              메인 추천 상품이 없습니다. 관리자 페이지에서 추천 상품을 체크해 주세요.
            </div>
          ) : (
            <div className="space-y-8">
              {/* 이번 달 추천 명문 골프 코스 */}
              <CuratedBlock
                title="이번 달 추천 명문 골프 코스"
                description="시즌과 컨디션을 고려해 추천하는 일본·동남아·국내 명문 골프장 위주의 일정입니다."
                products={curatedGolf}
              />

              {/* 동호회 인기 상품 */}
              <CuratedBlock
                title="동호회 인기 상품"
                description="동호회·지인 모임에서 반복 예약이 많은, 동선과 일정이 검증된 코스만 모았습니다."
                products={curatedClub}
              />

              {/* 프리미엄 한정 패키지 */}
              <CuratedBlock
                title="프리미엄 한정 패키지"
                description="성수기에도 쾌적함을 유지할 수 있는 업그레이드 호텔·항공·그린피 중심의 한정 패키지입니다."
                products={curatedPremium}
              />

              <div className="pt-2">
                <Link
                  href="/products"
                  className="inline-flex rounded-full border border-[#1d4ed8]/50 bg-white px-5 py-2.5 text-sm font-semibold text-[#1e3a8a] transition hover:bg-[#eff6ff]"
                >
                  전체 상품 카탈로그 보기
                </Link>
              </div>
            </div>
          )}
        </section>

        <section
          id="contact"
          className="rounded-3xl bg-[#162133] px-6 py-12 ring-1 ring-site-border md:px-12 md:py-14"
        >
          <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)]">
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-[0.18em] text-[#60a5fa] md:text-sm">
                THEALL TOUR CONTACT
              </p>
              <h3 className="heading-display text-2xl font-semibold text-site-primary md:text-3xl">
                프리미엄 맞춤 상담으로 여정을 설계합니다
              </h3>
              <p className="text-sm text-site-muted md:text-base">
                간단한 내용을 남겨주시면 전담 상담사가 전화로 먼저 연락드려, 일정과 예산을 함께 정리해
                드립니다.
              </p>
              <div className="mt-3 space-y-1.5 text-xs text-site-muted md:text-sm">
                <p>· 통화가 편하신 시간대를 메모로 남겨주시면 최대한 맞춰 연락드립니다.</p>
                <p>· 상담 이후에도 일정 조정·추가 문의를 언제든지 편하게 요청하실 수 있습니다.</p>
                <p>· 전화 연결이 어려운 경우, 문자/메신저로도 차분히 안내해 드립니다.</p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#111C2D] p-5 text-site-primary shadow-xl ring-1 ring-site-border md:p-7">
              <h4 className="mb-4 text-sm font-semibold text-site-secondary md:text-base">
                아래 정보만 남겨주시면, 상담 전담자가 순차적으로 연락드립니다.
              </h4>
              <div className="rounded-2xl bg-[#0F172A] p-4 ring-1 ring-site-border/60 md:p-5">
                <InquiryForm />
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

type CuratedBlockProps = {
  title: string;
  description: string;
  products: Awaited<ReturnType<typeof getFeaturedProducts>>;
};

function CuratedBlock({ title, description, products }: CuratedBlockProps) {
  if (!products || products.length === 0) return null;

  return (
    <section className="space-y-4 rounded-3xl bg-[#111C2D] p-5 shadow-sm ring-1 ring-site-border md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
        <div>
          <h4 className="font-card-title text-lg font-semibold text-site-primary md:text-xl">
            {title}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-site-secondary md:text-sm">{description}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {products.map((product) => {
          const badges = getProductBadges(product);
          return (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-[#020617] text-white ring-1 ring-site-border transition-colors duration-150 hover:ring-[#3b82f6]"
            >
              <div className="relative h-40 w-full overflow-hidden">
                <Image
                  src={product.image_url}
                  alt={`${product.title} 대표 이미지`}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
                {/* 사진은 살려두고, 아래쪽만 살짝 어둡게 */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/70 via-[#0F172A]/20 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_55%)] opacity-80 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="relative flex flex-1 flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                  {product.category ? (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-site-secondary ring-1 ring-white/20">
                      {product.category}
                    </span>
                  ) : null}
                  {badges.map((badge) => (
                    <span
                      key={`${product.id}-${badge}`}
                      className="rounded-full bg-[#162133] px-2 py-1 text-[10px] text-site-primary ring-1 ring-site-border"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
                <h5 className="font-card-title mt-1 line-clamp-2 text-sm font-semibold md:text-base">
                  {product.title}
                </h5>
                {product.theme ? (
                  <p className="text-[11px] text-site-muted">
                    {product.theme}
                  </p>
                ) : null}
                <p className="line-clamp-3 text-[11px] leading-relaxed text-site-muted/90 md:text-xs">
                  {product.description}
                </p>
                {typeof product.price === "number" ? (
                  <p className="font-price-strong mt-1 text-[11px] font-semibold text-[#93c5fd] md:text-xs">
                    예상가 {new Intl.NumberFormat("ko-KR").format(product.price)}원~
                  </p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

