import ExtensionDownloadCard from "@/components/admin/tools/ExtensionDownloadCard";
import ThealltourExtensionUsageGuide from "@/components/admin/tools/ThealltourExtensionUsageGuide";

export default function AdminThealltourExtensionPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">하나투어 수집기</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            thealltour_hanatour_collector — 하나투어 상품 상세에서 일정·출발일·이미지를 수집해 검증(Markdown/JSON)하거나
            관리자에 AI 임포트합니다.
          </p>
        </header>
        <ExtensionDownloadCard slug="thealltour-extension" />
        <ThealltourExtensionUsageGuide />
      </main>
    </div>
  );
}
