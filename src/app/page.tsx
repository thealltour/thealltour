import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, Users, Route, CheckCircle2 } from "lucide-react";
import InquiryForm from "@/components/InquiryForm";
import SiteHeader from "@/components/SiteHeader";
import { getFeaturedProducts } from "@/lib/products";
import { getHomeBanners } from "@/lib/homeBanners";
import { getProductBadges } from "@/lib/productCategory";
import HeroQuickConsultButton from "@/components/HeroQuickConsultButton";

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

  const primaryBanner = topBanners[0] ?? null;

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="page-content flex w-full flex-col gap-16 px-3 py-8 sm:px-6 md:gap-20 md:py-10 md:px-10">
        <section className="relative overflow-hidden rounded-none bg-[var(--hero-bg)] px-3 py-8 text-[var(--hero-text-primary)] shadow-none ring-0 sm:rounded-3xl sm:px-6 sm:py-12 sm:shadow-[var(--shadow-soft-strong)] sm:ring-1 sm:ring-[var(--border)] md:px-14 md:py-20">
          {/* 데스크톱: 우측 골프 이미지 + 스크림·웜톤·비네트 (토큰 기반) */}
          {primaryBanner ? (
            <>
              <div className="pointer-events-none absolute inset-0 hidden md:block">
                <Image
                  src={primaryBanner.image_url}
                  alt={primaryBanner.title}
                  fill
                  sizes="(min-width: 1024px) 960px, (min-width: 768px) 768px, 0px"
                  priority
                  fetchPriority="high"
                  quality={82}
                  className="object-cover object-[right_center]"
                />
                {/* 왼쪽 45% 스크림: 라이트는 밝게, 다크는 어둡게 (--hero-scrim-from / --hero-scrim-to) */}
                <div className="absolute inset-0 hero-scrim" />
                {/* 우측 웜톤 오버레이 */}
                <div className="absolute inset-y-0 right-0 w-3/5 hero-overlay-warm mix-blend-soft-light" />
                {/* 중앙 경계 블러 */}
                <div className="absolute inset-y-0 left-1/2 w-[18%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[var(--hero-scrim-from)]/40 to-transparent backdrop-blur-[2px]" />
                {/* 가장자리 비네트 */}
                <div className="absolute inset-0 hero-vignette" />
              </div>
              <div className="pointer-events-none absolute inset-0 hidden md:block hero-vignette-soft" />
            </>
          ) : null}

          <div className="relative z-10 space-y-8 md:space-y-10">
            {/* 모바일: 이미지 상단, 텍스트 하단 */}
            {primaryBanner ? (
              <div className="overflow-hidden rounded-2xl ring-1 ring-[var(--hero-badge-border)] md:hidden">
                <div className="relative aspect-[16/11] w-full">
                  <Image
                    src={primaryBanner.mobile_image_url || primaryBanner.image_url}
                    alt={primaryBanner.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 0px"
                    priority
                    fetchPriority="high"
                    quality={82}
                    className="object-cover object-center"
                  />
                  <div className="pointer-events-none absolute inset-0 image-overlay-bottom" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 text-left text-[var(--hero-text-primary)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--hero-text-secondary)]/90">
                      THEALL CURATION
                    </p>
                    <p className="mt-1 type-small font-semibold">{primaryBanner.title}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-10 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.05fr)] md:items-center">
              <div className="space-y-6">
                <p className="inline-flex items-center gap-2 rounded-full bg-[var(--hero-badge-bg)] px-4 py-1 section-label text-[var(--hero-text-secondary)] md:type-small ring-1 ring-[var(--hero-badge-border)]">
                  THEALL TOUR PREMIUM GOLF
                </p>
                <h1 className="heading-display-hero type-h1 font-semibold leading-[1.15] md:text-[2.5rem]">
                  <span className="text-[var(--hero-accent)]">품격 있는</span> 골프와 여행의 시작
                </h1>
                <p className="max-w-xl type-small font-semibold text-[var(--hero-text-secondary)] md:type-body">
                  전담 상담사가 1:1 맞춤 설계를 진행하여, 일정·동행 구성·예산에 맞는 골프&여행 코스를 함께
                  정리해 드립니다.
                </p>
                <ul className="space-y-1.5 type-small text-[var(--hero-text-secondary)]/95">
                  <li>· 전화·메신저로 편하게 상담 시작</li>
                  <li>· 일정·항공·골프장까지 한 번에 비교 제안</li>
                  <li>· 출발 전·후 안내까지 전담 상담사가 지속 케어</li>
                </ul>
              </div>

              {/* 우측 컬럼: 배경 이미지를 보여주기 위한 여백 (이미지는 섹션 배경으로 처리) */}
              <div className="hidden min-h-[260px] md:block" />
            </div>
          </div>
        </section>

        {/* 신뢰 강조 섹션 */}
        <section className="rounded-none bg-transparent px-3 py-8 ring-0 sm:rounded-3xl sm:bg-[var(--surface-muted)] sm:px-6 sm:py-12 sm:ring-1 sm:ring-[var(--border)] md:px-10">
          <div className="mb-8 space-y-3 text-center">
            <p className="inline-flex items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-1 section-label text-[var(--foreground)] md:type-small">
              대형 여행사 공식 제휴 파트너
            </p>
            <p className="section-label text-[var(--text-muted)] md:type-small">
              THEALL TOUR TRUST
            </p>
            <h3 className="heading-display section-title type-h3 md:text-[1.75rem] text-[var(--foreground)]">
              안심하고 맡길 수 있는 여행 파트너
            </h3>
            <p className="mx-auto max-w-2xl type-small text-[var(--text-muted)]">
              대형 여행사와의 공식 제휴와 검증된 일정 운영 경험을 바탕으로, 안정적인 예약과 운영을 약속드립니다.
            </p>
          </div>

          <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-7 lg:grid-cols-4">
            <div className="flex h-full flex-col rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] text-[var(--foreground)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)]">
                  <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
                </span>
                <p className="text-sm font-semibold text-[var(--foreground)] type-small">대형 여행사 공식 제휴</p>
              </div>
              <p className="text-xs leading-relaxed text-[var(--text-muted)] type-caption">
                국내 주요 파트너와 협력하여, 검증된 상품과 안정적인 예약 시스템을 기반으로
                운영합니다.
              </p>
            </div>

            <div className="flex h-full flex-col rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] text-[var(--foreground)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)]">
                  <Users className="h-5 w-5 text-[var(--primary)]" />
                </span>
                <p className="text-sm font-semibold text-[var(--foreground)] type-small">전문 상담사 1:1 배정</p>
              </div>
              <p className="text-xs leading-relaxed text-[var(--text-muted)] type-caption">
                연령대·동행 구성·예산을 이해하는 담당자가 처음 상담부터 귀국까지 책임지고 함께하며, 필요한
                내용을 차분하게 설명해 드립니다.
              </p>
            </div>

            <div className="flex h-full flex-col rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] text-[var(--foreground)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)]">
                  <Route className="h-5 w-5 text-[var(--primary)]" />
                </span>
                <p className="text-sm font-semibold text-[var(--foreground)] type-small">단체·동호회 맞춤 설계</p>
              </div>
              <p className="text-xs leading-relaxed text-[var(--text-muted)] type-caption">
                회사·동호회·가족 모임 등 인원과 목적에 맞춘 일정으로 이동 동선과 일정 피로도를 최소화한
                코스를 제안합니다.
              </p>
            </div>

            <div className="flex h-full flex-col rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] text-[var(--foreground)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)]">
                  <CheckCircle2 className="h-5 w-5 text-[var(--primary)]" />
                </span>
                <p className="text-sm font-semibold text-[var(--foreground)] type-small">안전 기준을 통과한 일정</p>
              </div>
              <p className="text-xs leading-relaxed text-[var(--text-muted)] type-caption">
                현지 가이드·차량·숙소까지 사전 점검된 일정만 운영하며, 돌발 상황에도 대응 가능한 안전
                프로세스를 갖추고 있습니다.
              </p>
            </div>
          </div>
        </section>

        {/* 메인 카테고리 섹션 - 골프 우선 구조 */}
        <section className="space-y-8 rounded-none bg-transparent px-3 py-8 ring-0 sm:rounded-3xl sm:bg-[var(--surface-muted)] sm:px-6 sm:py-12 sm:ring-1 sm:ring-[var(--border)] md:px-10">
          <div className="space-y-2 text-left md:text-center">
            <p className="section-label text-[var(--text-muted)] md:type-small">
              THEALL TOUR PREMIUM
            </p>
            <h3 className="heading-display text-3xl font-semibold tracking-[0.06em] text-[var(--foreground)] md:text-4xl">
              품격 있는 골프 컬렉션
            </h3>
            <p className="mx-auto max-w-2xl type-small text-[var(--text-muted)] md:type-body">
              검증된 일정과 안정적인 운영으로 안내합니다.
            </p>
          </div>

          {/* 골프 3종 카테고리 (최상단) */}
          <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
            <Link
              href="/products?category=해외 골프 투어"
              className="group relative overflow-hidden rounded-3xl bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition-colors duration-150 hover:shadow-[var(--shadow-soft-strong)] hover:ring-[var(--border-strong)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--surface-muted)] via-[var(--surface)] to-[var(--surface-muted)]" />
              <div className="absolute inset-0 overlay-radial-gold opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex h-full flex-col justify-between p-6 md:p-7">
                <div className="space-y-2">
                  <p className="section-label text-[var(--primary)]">
                    해외 골프 투어
                  </p>
                  <h4 className="font-card-title type-h3 text-[var(--foreground)] md:text-[1.75rem]">
                    일본·동남아 인기 골프 코스
                  </h4>
                  <p className="mt-1 type-caption leading-relaxed text-[var(--text-muted)]">
                    항공·그린피·숙박까지 한 번에 맞춘 일정으로, 시즌에 맞는 해외 골프장을 추천해 드립니다.
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center section-label text-[var(--text-muted)]">
                  자세히 보기
                  <span className="ml-1 text-[var(--primary)]">→</span>
                </span>
              </div>
            </Link>

            <Link
              href="/products?category=국내 골프 투어"
              className="group relative overflow-hidden rounded-3xl bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition-colors duration-150 hover:shadow-[var(--shadow-soft-strong)] hover:ring-[var(--border-strong)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--surface-muted)] via-[var(--surface)] to-[var(--surface-muted)]" />
              <div className="absolute inset-0 overlay-radial-blue opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex h-full flex-col justify-between p-6 md:p-7">
                <div className="space-y-2">
                  <p className="section-label text-[var(--primary)]">
                    국내 골프 투어
                  </p>
                  <h4 className="font-card-title type-h3 text-[var(--foreground)] md:text-[1.75rem]">
                    제주·국내 프리미엄 라운딩
                  </h4>
                  <p className="mt-1 type-caption leading-relaxed text-[var(--text-muted)]">
                    이동 시간이 부담스러운 고객님을 위해, 접근성 좋은 국내 골프장 중심으로 일정을 설계합니다.
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center section-label text-[var(--text-muted)]">
                  자세히 보기
                  <span className="ml-1 text-[var(--primary)]">→</span>
                </span>
              </div>
            </Link>

            <Link
              href="/products?category=파크골프 전용 투어"
              className="group relative overflow-hidden rounded-3xl bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition-colors duration-150 hover:shadow-[var(--shadow-soft-strong)] hover:ring-[var(--border-strong)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--surface-muted)] via-[var(--surface)] to-[var(--surface-muted)]" />
              <div className="absolute inset-0 overlay-radial-green opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex h-full flex-col justify-between p-6 md:p-7">
                <div className="space-y-2">
                  <p className="section-label text-[var(--success)]">
                    파크골프 전용
                  </p>
                  <h4 className="font-card-title type-h3 text-[var(--foreground)] md:text-[1.75rem]">
                    중장년층 파크골프 맞춤 일정
                  </h4>
                  <p className="mt-1 type-caption leading-relaxed text-[var(--text-muted)]">
                    라운딩 강도와 휴식을 함께 고려해, 무리 없이 즐기실 수 있는 파크골프 중심 일정을 제안합니다.
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center section-label text-[var(--text-muted)]">
                  자세히 보기
                  <span className="ml-1 text-[var(--primary)]">→</span>
                </span>
              </div>
            </Link>
          </div>

          {/* 일반 해외/국내 여행 카테고리 (골프 아래 배치) */}
          <Link
            href="/products"
            className="group relative mt-6 flex flex-col justify-between overflow-hidden rounded-3xl bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition-colors duration-150 hover:shadow-[var(--shadow-soft-strong)] hover:ring-[var(--border-strong)] md:flex-row md:items-center md:px-8 md:py-5"
          >
            <div className="relative px-5 py-5 md:px-0 md:py-4 md:pr-8">
              <p className="section-label text-[var(--text-muted)]">
                해외·국내 패키지
              </p>
              <h4 className="font-card-title mt-1 type-small font-semibold md:type-body text-[var(--foreground)]">
                가족·지인과 떠나는 일반 여행
              </h4>
              <p className="mt-1 type-caption leading-relaxed text-[var(--text-muted)]">
                휴양 중심 동남아, 유럽 패키지, 국내/제주 여행까지 폭넓게 비교 상담해 드립니다.
              </p>
            </div>
            <div className="relative flex items-center justify-end px-5 pb-4 md:px-0 md:pb-0">
              <span className="inline-flex items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-2 type-caption font-semibold text-[var(--foreground)] hover:bg-[var(--surface)] hover:border-[var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2">
                전체 패키지 상품 보기
                <span className="ml-1 text-[var(--primary)]">→</span>
              </span>
            </div>
          </Link>
        </section>

        <section className="space-y-8 rounded-none bg-transparent px-3 py-6 ring-0 sm:rounded-3xl sm:bg-[var(--surface-muted)] sm:px-6 sm:py-10 sm:ring-1 sm:ring-[var(--border)] md:px-10">
          <div className="space-y-2">
            <p className="text-sm font-semibold tracking-wide text-[var(--text-muted)] type-small">
              THEALL CURATED PICKS
            </p>
            <h3 className="heading-display section-title type-h2 md:type-h2 text-[var(--foreground)]">
              이번 달 선별 추천 여행
            </h3>
            <p className="type-small text-[var(--text-muted)]">
              쇼핑몰식 전체 나열이 아닌, 더올투어가 직접 선별한 코스 중심의 추천 상품입니다.
            </p>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="rounded-none border-0 bg-transparent p-0 shadow-none ring-0 type-small text-[var(--text-muted)] sm:rounded-2xl sm:border sm:border-[var(--border)] sm:bg-[var(--surface)] sm:p-8 sm:shadow-[var(--shadow-soft)]">
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
                  className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                >
                  전체 상품 카탈로그 보기
                </Link>
              </div>
            </div>
          )}
        </section>

        <section
          id="contact"
          className="rounded-none bg-transparent px-3 py-8 ring-0 sm:rounded-3xl sm:bg-[var(--surface-muted)] sm:px-6 sm:py-12 sm:ring-1 sm:ring-[var(--border)] md:px-12 md:py-14"
        >
          <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)]">
            <div className="space-y-4">
              <p className="section-label text-[var(--text-muted)] md:type-small">
                THEALL TOUR CONTACT
              </p>
              <h3 className="heading-display section-title type-h2 md:type-h2 text-[var(--foreground)]">
                프리미엄 맞춤 상담으로 여정을 설계합니다
              </h3>
              <p className="type-small text-[var(--text-muted)] md:type-body">
                간단한 내용을 남겨주시면 전담 상담사가 전화로 먼저 연락드려, 일정과 예산을 함께 정리해
                드립니다.
              </p>
              <div className="mt-3 space-y-1.5 type-caption text-[var(--text-muted)] md:type-small">
                <p>· 통화가 편하신 시간대를 메모로 남겨주시면 최대한 맞춰 연락드립니다.</p>
                <p>· 상담 이후에도 일정 조정·추가 문의를 언제든지 편하게 요청하실 수 있습니다.</p>
                <p>· 전화 연결이 어려운 경우, 문자/메신저로도 차분히 안내해 드립니다.</p>
              </div>
            </div>

            <div className="rounded-none bg-transparent p-0 shadow-none ring-0 text-[var(--foreground)] sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] md:p-7">
              <h4 className="mb-3 type-small font-semibold text-[var(--text-muted)] md:type-body">
                한 번의 클릭으로 프리미엄 상담을 요청해 주세요.
              </h4>
              <p className="mb-4 type-caption text-[var(--text-muted)] md:type-small">
                문의 양식을 길게 작성하지 않아도, 간단한 정보만 남기면 전담 상담사가 직접 연락드립니다.
              </p>
              <div className="rounded-none bg-transparent p-0 ring-0 sm:rounded-2xl sm:bg-[var(--surface-muted)] sm:p-4 sm:ring-1 sm:ring-[var(--border)] md:p-5">
                <HeroQuickConsultButton />
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
    <section className="space-y-4 rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-3xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
        <div>
          <h4 className="font-card-title type-h3 text-[var(--foreground)] md:text-[1.375rem]">
            {title}
          </h4>
          <p className="mt-1 type-caption leading-relaxed text-[var(--text-muted)] md:type-small">{description}</p>
        </div>
      </div>

      <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-4">
        {products.map((product) => {
          const badges = getProductBadges(product);
          return (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition-colors duration-150 hover:shadow-[var(--shadow-soft-strong)] hover:ring-[var(--border-strong)]"
            >
              <div className="relative h-40 w-full overflow-hidden">
                <Image
                  src={product.image_url}
                  alt={`${product.title} 대표 이미지`}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--overlay)] via-[var(--overlay)]/20 to-transparent" />
                <div className="absolute inset-0 overlay-radial-blue-subtle opacity-80 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="relative flex flex-1 flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-1.5 section-label">
                  {product.category ? (
                    <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 type-caption text-[var(--text-muted)] ring-1 ring-[var(--border)]">
                      {product.category}
                    </span>
                  ) : null}
                  {badges.map((badge) => (
                    <span
                      key={`${product.id}-${badge}`}
                      className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-[10px] text-[var(--foreground)] ring-1 ring-[var(--border)]"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
                <h5 className="font-card-title mt-1 line-clamp-2 type-small font-semibold md:type-body text-[var(--foreground)]">
                  {product.title}
                </h5>
                {product.theme ? (
                  <p className="type-caption text-[var(--text-muted)]">
                    {product.theme}
                  </p>
                ) : null}
                <p className="line-clamp-3 type-caption leading-relaxed text-[var(--text-muted)] md:type-small">
                  {product.description}
                </p>
                {typeof product.price === "number" ? (
                  <p className="font-price-strong mt-1 type-caption font-semibold text-[var(--primary)] md:type-small">
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

