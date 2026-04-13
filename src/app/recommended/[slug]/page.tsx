import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import LandingPageRenderer from "@/components/landings/LandingPageRenderer";
import { getPublicLandingBySlug } from "@/lib/adminLandings/service";

type RecommendedLandingDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function RecommendedLandingDetailPage({ params }: RecommendedLandingDetailPageProps) {
  const { slug } = await params;
  const landing = await getPublicLandingBySlug(slug);
  if (!landing) notFound();

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />
      <LandingPageRenderer
        landing={landing}
        mode="public"
        sourcePath={`/recommended/${encodeURIComponent(slug)}`}
      />
    </div>
  );
}
