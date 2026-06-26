import ExtensionDownloadCard from "@/components/admin/tools/ExtensionDownloadCard";

export default function AdminModetourExtensionPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">모두투어 익스텐션</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Chrome 익스텐션을 다운로드해 모두투어 상품 페이지에서 JSON을 추출할 수 있습니다.
          </p>
        </header>
        <ExtensionDownloadCard slug="modetour" />
      </main>
    </div>
  );
}
