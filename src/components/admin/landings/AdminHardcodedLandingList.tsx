"use client";

import Link from "next/link";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import {
  HARDCODED_LANDINGS,
  resolveHardcodedLandingPublicUrl,
} from "@/lib/hardcodedLandings/registry";
import { buildKakaoSyncGolfPublicUrl } from "@/lib/hardcodedLandings/kakaoSyncGolf/urls";

export default function AdminHardcodedLandingList() {
  const { showToast } = useAdminToast();

  const copyUrl = async (entryId: string, path: string) => {
    try {
      const url =
        entryId === "kakao-sync-golf"
          ? buildKakaoSyncGolfPublicUrl(true)
          : resolveHardcodedLandingPublicUrl(path);
      await navigator.clipboard.writeText(url);
      showToast("success", "공개 URL이 복사되었습니다.");
    } catch {
      showToast("error", "URL 복사에 실패했습니다.");
    }
  };

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      showToast("success", "파일 경로가 복사되었습니다.");
    } catch {
      showToast("error", "복사에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">하드코딩 랜딩</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          마케팅 속도전용 코드 고정 랜딩 목록입니다. 문구 수정은 config 파일, 상품 목록은 홈·배너 구성
          &gt; 메인 골프투어 상품에서 관리하세요.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]/50 text-xs text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">랜딩</th>
              <th className="px-4 py-3 font-semibold">공개 URL</th>
              <th className="px-4 py-3 font-semibold">소스 파일</th>
              <th className="px-4 py-3 font-semibold">수정일</th>
            </tr>
          </thead>
          <tbody>
            {HARDCODED_LANDINGS.map((entry) => (
              <tr key={entry.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-4 align-top">
                  <p className="font-semibold text-[var(--text-primary)]">{entry.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{entry.description}</p>
                </td>
                <td className="px-4 py-4 align-top">
                  <code className="text-xs text-[var(--text-secondary)]">{entry.publicPath}</code>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void copyUrl(entry.id, entry.publicPath)}
                      className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold"
                    >
                      URL 복사
                    </button>
                    <Link
                      href={entry.publicPath}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-[var(--primary)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)]"
                    >
                      미리보기
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="space-y-2 text-xs">
                    <div>
                      <p className="text-[var(--text-muted)]">config</p>
                      <button
                        type="button"
                        onClick={() => void copyPath(entry.configPath)}
                        className="mt-0.5 text-left font-mono text-[var(--text-secondary)] underline-offset-2 hover:underline"
                      >
                        {entry.configPath}
                      </button>
                    </div>
                    <div>
                      <p className="text-[var(--text-muted)]">component</p>
                      <button
                        type="button"
                        onClick={() => void copyPath(entry.componentPath)}
                        className="mt-0.5 text-left font-mono text-[var(--text-secondary)] underline-offset-2 hover:underline"
                      >
                        {entry.componentPath}
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 align-top text-xs text-[var(--text-muted)]">
                  {entry.updatedAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
