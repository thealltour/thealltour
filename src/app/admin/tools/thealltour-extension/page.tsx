import ExtensionDownloadCard from "@/components/admin/tools/ExtensionDownloadCard";
import ThealltourExtensionUsageGuide from "@/components/admin/tools/ThealltourExtensionUsageGuide";

export default function AdminThealltourExtensionPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">통합 익스텐션</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            thealltour_extension — 하나투어·모두투어 상세 페이지에서 상품을 AI로 임포트합니다.
          </p>
        </header>
        <ExtensionDownloadCard slug="thealltour-extension" />
        <ThealltourExtensionUsageGuide />
      </main>
    </div>
  );
}
