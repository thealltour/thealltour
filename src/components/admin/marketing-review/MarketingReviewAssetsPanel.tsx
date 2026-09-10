"use client";

import { useCallback, useEffect, useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";

type AssetArtifact = {
  artifactId: string;
  kind: string;
  relativePath: string;
  mediaType: string;
  byteSize: number;
  sha256: string;
  createdAt: string;
  origin: string;
  version: number;
};

type AssetsResponse = {
  status: "missing" | "present";
  candidateId: string;
  businessDateKst: string;
  assetRootConfigured: boolean;
  relativePackagePath: string | null;
  packageId: string | null;
  stage: string | null;
  artifacts: AssetArtifact[];
  updatedAt: string | null;
  createdAt: string | null;
  integrityDigest: string | null;
  message?: string;
  code?: string;
};

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileUrl(candidateId: string, relativePath: string, disposition: "inline" | "attachment") {
  const params = new URLSearchParams({
    path: relativePath,
    disposition,
  });
  return `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/assets/file?${params.toString()}`;
}

export function MarketingReviewAssetsPanel(props: { candidateId: string }) {
  const { candidateId } = props;
  const [assets, setAssets] = useState<AssetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/assets`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as AssetsResponse;
      if (!res.ok) {
        setAssets(null);
        setMessage(data.message ?? "산출물 상태를 불러오지 못했습니다.");
        return;
      }
      setAssets(data);
      setMessage(null);
    } catch {
      setAssets(null);
      setMessage("산출물 상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportToHdd() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/assets/export`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = (await res.json()) as {
        message?: string;
        wrote?: boolean;
        reused?: boolean;
        relativePackagePath?: string;
      };
      if (!res.ok) {
        setMessage(data.message ?? "HDD보내기에 실패했습니다.");
        return;
      }
      setMessage(
        data.reused
          ? "이미 동일한 패키지가 HDD에 있어 재사용했습니다."
          : data.wrote
            ? `HDD 패키지를 저장했습니다${data.relativePackagePath ? ` (${data.relativePackagePath})` : ""}.`
            : "HDD보내기를 완료했습니다.",
      );
      await load();
    } catch {
      setMessage("HDD보내기에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const imageArtifacts =
    assets?.artifacts.filter((item) => item.mediaType.startsWith("image/")) ?? [];

  return (
    <AdminCard className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">제작 산출물 (HDD)</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            CompletedMarketingCandidate를 로컬 패키지로 보내고 미리보기/다운로드합니다. SNS 게시는
            하지 않습니다.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void exportToHdd()}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {assets?.status === "present" ? "HDD 다시 보내기" : "HDD로 보내기"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">산출물 상태 확인 중…</p>
      ) : !assets ? (
        <p className="text-sm text-[var(--text-secondary)]">상태를 표시할 수 없습니다.</p>
      ) : !assets.assetRootConfigured ? (
        <p className="text-sm text-amber-900">
          MARKETING_ASSET_ROOT가 설정되지 않았습니다. 서버 환경에
          `/mnt/HDD2TB/marketing-assets` 등 절대 경로를 설정한 뒤 다시 시도하세요.
        </p>
      ) : assets.status === "missing" ? (
        <p className="text-sm text-[var(--text-secondary)]">
          HDD 패키지가 아직 없습니다. 「HDD로 보내기」를 누르면 copy/context 산출물이 생성됩니다.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="text-[var(--text-secondary)]">
            <div>
              패키지{" "}
              <span className="font-mono text-[var(--text-primary)]">
                {assets.relativePackagePath ?? assets.packageId}
              </span>
            </div>
            <div>
              artifact {assets.artifacts.length}개
              {assets.updatedAt ? ` · 갱신 ${new Date(assets.updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}` : ""}
            </div>
          </div>

          {imageArtifacts.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {imageArtifacts.map((item) => (
                <a
                  key={item.artifactId}
                  href={fileUrl(candidateId, item.relativePath, "attachment")}
                  className="block overflow-hidden rounded-lg border border-[var(--border)]"
                  title={item.relativePath}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fileUrl(candidateId, item.relativePath, "inline")}
                    alt={item.relativePath}
                    className="h-40 w-full object-cover bg-[var(--surface-muted)]"
                  />
                  <div className="px-2 py-1.5 text-xs text-[var(--text-secondary)]">
                    {item.relativePath}
                  </div>
                </a>
              ))}
            </div>
          ) : null}

          <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
            {assets.artifacts.map((item) => (
              <li
                key={item.artifactId}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-mono text-[var(--text-primary)]">{item.relativePath}</div>
                  <div className="text-[var(--text-secondary)]">
                    {item.kind} · {formatBytes(item.byteSize)} · {item.mediaType}
                  </div>
                </div>
                <div className="flex gap-2">
                  {item.mediaType.startsWith("image/") ||
                  item.mediaType.startsWith("text/") ||
                  item.mediaType === "application/json" ? (
                    <a
                      href={fileUrl(candidateId, item.relativePath, "inline")}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--primary)] underline-offset-2 hover:underline"
                    >
                      보기
                    </a>
                  ) : null}
                  <a
                    href={fileUrl(candidateId, item.relativePath, "attachment")}
                    className="text-[var(--primary)] underline-offset-2 hover:underline"
                  >
                    다운로드
                  </a>
                </div>
              </li>
            ))}
            <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
              <div className="font-mono text-[var(--text-primary)]">manifest.json</div>
              <div className="flex gap-2">
                <a
                  href={fileUrl(candidateId, "manifest.json", "inline")}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--primary)] underline-offset-2 hover:underline"
                >
                  보기
                </a>
                <a
                  href={fileUrl(candidateId, "manifest.json", "attachment")}
                  className="text-[var(--primary)] underline-offset-2 hover:underline"
                >
                  다운로드
                </a>
              </div>
            </li>
          </ul>
        </div>
      )}

      {message ? <p className="text-sm text-[var(--text-secondary)]">{message}</p> : null}
    </AdminCard>
  );
}
