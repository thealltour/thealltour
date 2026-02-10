import Link from "next/link";
import InquiryForm from "@/components/InquiryForm";
import SiteHeader from "@/components/SiteHeader";
import HomeProductSlider from "@/components/HomeProductSlider";
import HomeTopBanner from "@/components/HomeTopBanner";
import { getFeaturedProducts } from "@/lib/products";
import { getHomeBanners } from "@/lib/homeBanners";
import { getProductTaxonomyOptions } from "@/lib/productTaxonomies";

export default async function Home() {
  const [featuredProducts, topBanners] = await Promise.all([getFeaturedProducts(), getHomeBanners()]);
  const { categories } = await getProductTaxonomyOptions(featuredProducts);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 py-10 md:px-10">
        {topBanners.length > 0 ? <HomeTopBanner banners={topBanners} /> : null}

        <section className="relative overflow-hidden rounded-3xl bg-[#1d4ed8] px-8 py-16 text-white shadow-xl md:px-14 md:py-20">
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[#60a5fa]/30 blur-2xl" />
          <div className="absolute -bottom-24 left-8 h-60 w-60 rounded-full bg-[#bfdbfe]/30 blur-2xl" />
          <div className="relative z-10 max-w-3xl space-y-6">
            <p className="inline-block rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
              더올투어 프리미엄 맞춤 여행 컨설팅
            </p>
            <h2 className="text-3xl font-bold leading-tight md:text-5xl">
              맞춤형 해외/국내 여행 전문
            </h2>
            <p className="text-base text-blue-100 md:text-lg">
              더올투어는 고객님의 일정과 예산, 동행 구성에 맞춰 여행을 설계합니다.
              출발 전 상담부터 귀국 후 케어까지 안정적으로 함께합니다.
            </p>
            <a
              href="#contact"
              className="inline-flex rounded-full bg-white px-6 py-3 font-semibold text-[#1e3a8a] transition hover:bg-[#e0ecff]"
            >
              여행 문의하기
            </a>
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
              이름, 연락처, 문의 내용을 남겨주시면 빠르게 상담 도와드리겠습니다.
            </p>
          </div>
          <InquiryForm />
        </section>

      </main>
    </div>
  );
}
