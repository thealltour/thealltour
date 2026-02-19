import Link from "next/link";
import InquiryForm from "@/components/InquiryForm";
import SiteHeader from "@/components/SiteHeader";
import HomeProductSlider from "@/components/HomeProductSlider";
import HomeTopBanner from "@/components/HomeTopBanner";
import { getFeaturedProducts } from "@/lib/products";
import { getHomeBanners } from "@/lib/homeBanners";

export default async function Home() {
  const [featuredProducts, topBanners] = await Promise.all([getFeaturedProducts(), getHomeBanners()]);
  const categories = Array.from(
    new Set(featuredProducts.map((product) => product.category?.trim()).filter(Boolean)),
  ) as string[];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 py-10 md:px-10">
        {topBanners.length > 0 ? <HomeTopBanner banners={topBanners} /> : null}

        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f2f86] to-[#1d4ed8] px-8 py-16 text-white shadow-xl md:px-14 md:py-20">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -bottom-24 left-8 h-64 w-64 rounded-full bg-[#bfdbfe]/25 blur-3xl" />
          <div className="relative z-10 grid gap-8 md:grid-cols-[1.4fr_1fr]">
            <div className="space-y-6">
              <p className="inline-block rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              더올투어 프리미엄 맞춤 여행 컨설팅
            </p>
              <h2 className="text-3xl font-bold leading-tight md:text-5xl">
                1:1 맞춤 설계로
                <br />
                여행 성공 확률을 높입니다
              </h2>
              <p className="text-base text-blue-100 md:text-lg">
                고객님의 일정, 예산, 동행 구성에 맞춘 제안으로 상담부터 출발 이후 케어까지
                책임 있게 안내합니다.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#contact"
                  className="inline-flex rounded-full bg-white px-6 py-3 font-semibold text-[#1e3a8a] transition hover:bg-[#e0ecff]"
                >
                  지금 문의하기
                </a>
                <Link
                  href="/products"
                  className="inline-flex rounded-full border border-white/50 bg-white/10 px-6 py-3 font-semibold text-white transition hover:bg-white/20"
                >
                  추천 상품 보기
                </Link>
              </div>
            </div>
            <div className="grid gap-3 self-end rounded-2xl bg-white/10 p-4 ring-1 ring-white/30 backdrop-blur">
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs text-blue-100">누적 상담</p>
                <p className="text-xl font-bold">고객 맞춤형 진행</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs text-blue-100">응답 체계</p>
                <p className="text-xl font-bold">빠른 상담 연결</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs text-blue-100">상품 큐레이션</p>
                <p className="text-xl font-bold">검증된 일정 중심</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold tracking-wide text-[#2563eb]">THEALL TOUR PRODUCTS</p>
            <h3 className="text-2xl font-bold md:text-3xl">추천 여행 상품</h3>
          </div>
          {featuredProducts.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-sm text-slate-500 shadow-md ring-1 ring-[#e2e8f0]">
              메인 추천 상품이 없습니다. 관리자 페이지에서 추천 상품을 체크해 주세요.
            </div>
          ) : (
            <HomeProductSlider products={featuredProducts} categories={categories} />
          )}
          <div>
            <Link
              href="/products"
              className="inline-flex rounded-lg border border-[#93c5fd] bg-white px-4 py-2 text-sm font-semibold text-[#1e3a8a] transition hover:bg-[#eff6ff]"
            >
              패키지상품 전체보기
            </Link>
          </div>
        </section>

        <section
          id="contact"
          className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-[#dbeafe] md:p-10"
        >
          <div className="mb-6 space-y-2">
            <p className="text-sm font-semibold tracking-wide text-[#2563eb]">THEALL TOUR CONTACT</p>
            <h3 className="text-2xl font-bold md:text-3xl">맞춤 여행 문의하기</h3>
            <p className="text-sm text-slate-600">
              문의 접수 후 순차적으로 상담을 도와드리며, 남겨주신 연락처로 상세 안내를 드립니다.
            </p>
          </div>
          <InquiryForm />
        </section>

      </main>
    </div>
  );
}
