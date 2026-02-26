import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { getSiteSettings } from "@/lib/siteSettings";

export default async function AboutPage() {
  const settings = await getSiteSettings();

  const kicker = settings.about_kicker || "ABOUT THEALL TOUR";
  const title = settings.about_title || "여행을 디자인해 드립니다";
  const paragraph1 = settings.about_paragraph1;
  const paragraph2 = settings.about_paragraph2;
  const ctaLabel = settings.about_cta_label || "맞춤 여행 상담 받기";
  const ctaHref = settings.about_cta_href || "/#contact";
  const isExternal = ctaHref.startsWith("http://") || ctaHref.startsWith("https://");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader activeTab="about" />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-[#1d4ed8] p-10 text-white shadow-xl">
          <p className="mb-3 text-sm font-semibold tracking-wide text-blue-100">{kicker}</p>
          <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-[#dbeafe] md:p-10">
          <div className="space-y-6 text-slate-700">
            {paragraph1 ? <p className="leading-8 whitespace-pre-line">{paragraph1}</p> : null}
            {paragraph2 ? <p className="leading-8 whitespace-pre-line">{paragraph2}</p> : null}
          </div>
          <div className="mt-8">
            {isExternal ? (
              <a
                href={ctaHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
              >
                {ctaLabel}
              </a>
            ) : (
              <Link
                href={ctaHref}
                className="inline-flex rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
              >
                {ctaLabel}
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
