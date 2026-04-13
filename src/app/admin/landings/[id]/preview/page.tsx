import { notFound } from "next/navigation";
import Link from "next/link";
import LandingPageRenderer from "@/components/landings/LandingPageRenderer";
import { getAdminLandingById } from "@/lib/adminLandings/service";

type AdminLandingPreviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminLandingPreviewPage({ params }: AdminLandingPreviewPageProps) {
  const { id } = await params;
  const landing = await getAdminLandingById(id);
  if (!landing) notFound();

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <div className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8 xl:px-10">
          <div className="text-sm text-[var(--text-muted)]">
            관리자 미리보기 · {landing.title}
          </div>
          <Link
            href={`/theall_manager_only/landings/${encodeURIComponent(id)}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
          >
            편집으로 돌아가기
          </Link>
        </div>
      </div>

      <LandingPageRenderer
        landing={landing}
        mode="preview"
        sourcePath={`/theall_manager_only/landings/${encodeURIComponent(id)}/preview`}
      />
    </div>
  );
}
