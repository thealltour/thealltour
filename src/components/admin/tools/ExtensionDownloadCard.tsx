"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Puzzle } from "lucide-react";
import AdminButton from "@/components/admin/ui/AdminButton";
import ChromeExtensionInstallGuide from "@/components/admin/tools/ChromeExtensionInstallGuide";
import type { ExtensionBuildManifest, ExtensionSlug } from "@/lib/extensionBuilds";
import { EXTENSION_DISPLAY } from "@/lib/extensionBuilds";

type ExtensionMetaResponse = {
  slug: ExtensionSlug;
  available: boolean;
  manifest: ExtensionBuildManifest | null;
};

function formatUploadedAt(value: string | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

type ExtensionDownloadCardProps = {
  slug: ExtensionSlug;
};

export default function ExtensionDownloadCard({ slug }: ExtensionDownloadCardProps) {
  const display = EXTENSION_DISPLAY[slug];
  const [meta, setMeta] = useState<ExtensionMetaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setErrorMessage("");
        const res = await fetch(`/api/admin/tools/extensions/${slug}`, { cache: "no-store" });
        const data = (await res.json()) as ExtensionMetaResponse & { message?: string };
        if (!res.ok) {
          if (!cancelled) setErrorMessage(data.message ?? "익스텐션 정보를 불러오지 못했습니다.");
          return;
        }
        if (!cancelled) setMeta(data);
      } catch {
        if (!cancelled) setErrorMessage("익스텐션 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleDownload = useCallback(async () => {
    try {
      setDownloading(true);
      setErrorMessage("");
      const res = await fetch(`/api/admin/tools/extensions/${slug}/download`, { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setErrorMessage(data.message ?? "다운로드에 실패했습니다.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = meta?.manifest?.fileName ?? display.downloadFileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMessage("다운로드 중 오류가 발생했습니다.");
    } finally {
      setDownloading(false);
    }
  }, [display.downloadFileName, meta?.manifest?.fileName, slug]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_oklab,var(--primary)_12%,transparent)] text-[var(--primary)]">
            <Puzzle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{display.title}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{display.description}</p>
            </div>

            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--text-muted)]">버전</dt>
                <dd className="font-medium text-[var(--text-primary)]">
                  {loading ? "…" : meta?.manifest?.version ?? "미업로드"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">업로드일</dt>
                <dd className="font-medium text-[var(--text-primary)]">
                  {loading ? "…" : formatUploadedAt(meta?.manifest?.uploadedAt)}
                </dd>
              </div>
            </dl>

            {!loading && !meta?.available ? (
              <p className="rounded-lg border border-amber-200/60 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                아직 업로드된 빌드가 없습니다. 로컬에서{" "}
                <code className="rounded bg-black/5 px-1 py-0.5 text-xs dark:bg-white/10">
                  npm run extensions:package
                </code>{" "}
                실행 후 다시 시도해 주세요.
              </p>
            ) : null}

            {errorMessage ? <p className="text-sm text-[var(--danger)]">{errorMessage}</p> : null}

            <AdminButton
              onClick={() => void handleDownload()}
              disabled={downloading || loading || !meta?.available}
              className="inline-flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {downloading ? "다운로드 중…" : display.downloadButtonLabel}
            </AdminButton>
          </div>
        </div>
      </div>

      <ChromeExtensionInstallGuide />
    </div>
  );
}
