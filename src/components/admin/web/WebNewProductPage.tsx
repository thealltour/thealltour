"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminButton from "@/components/admin/ui/AdminButton";
import AdminImportProgressOverlay from "@/components/admin/ui/AdminImportProgressOverlay";
import { useSimulatedImportProgress } from "@/components/admin/hooks/useSimulatedImportProgress";
import {
  ADMIN_PRODUCTS_QUERY_KEYS,
  ADMIN_PRODUCTS_VIEW,
} from "@/components/admin/products/adminProducts.constants";

type ImportResponse = {
  id?: string;
  message?: string;
  existingId?: string;
  provider?: string | null;
  parsed?: {
    title: string | null;
    price: number | null;
    duration: string | null;
    galleryCount?: number;
    itineraryEventCount?: number;
    itineraryImageCount?: number;
  };
};

function parseImageUrls(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function WebNewProductPage() {
  const router = useRouter();
  const [cleanHtmlStructure, setCleanHtmlStructure] = useState("");
  const [rawHtmlText, setRawHtmlText] = useState("");
  const [galleryUrlsText, setGalleryUrlsText] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [itineraryBlocksText, setItineraryBlocksText] = useState("");
  const [productSourceUrl, setProductSourceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<ImportResponse | null>(null);
  const progress = useSimulatedImportProgress();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExistingId(null);
    setSuccessSummary(null);
    setIsSubmitting(true);
    progress.start();

    try {
      if (!cleanHtmlStructure.trim() && !rawHtmlText.trim()) {
        progress.stop();
        setError("정제 HTML 또는 페이지 텍스트 중 하나는 필수입니다.");
        return;
      }

      let itineraryBlocks: unknown[] | undefined;
      const blocksRaw = itineraryBlocksText.trim();
      if (blocksRaw) {
        try {
          const parsed = JSON.parse(blocksRaw) as unknown;
          if (!Array.isArray(parsed)) {
            progress.stop();
            setError("itineraryBlocks는 JSON 배열이어야 합니다.");
            return;
          }
          itineraryBlocks = parsed;
        } catch {
          progress.stop();
          setError("itineraryBlocks JSON 형식이 올바르지 않습니다.");
          return;
        }
      }

      const galleryUrls = parseImageUrls(galleryUrlsText);
      const res = await fetch("/api/admin/products/import-external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cleanHtmlStructure: cleanHtmlStructure.trim() || undefined,
          rawHtmlText: rawHtmlText.trim() || undefined,
          product_source_url: productSourceUrl.trim() || undefined,
          productGalleryUrls: galleryUrls.length > 0 ? galleryUrls : undefined,
          heroImageUrl: heroImageUrl.trim() || undefined,
          itineraryBlocks,
        }),
      });

      const data = (await res.json()) as ImportResponse;

      if (res.status === 409 && data.existingId) {
        progress.stop();
        setExistingId(data.existingId);
        setError(data.message ?? "이미 등록된 상품입니다.");
        return;
      }

      if (!res.ok) {
        progress.stop();
        setError(data.message ?? "상품 등록에 실패했습니다.");
        return;
      }

      if (data.id) {
        progress.complete();
        setSuccessSummary(data);
        const params = new URLSearchParams({
          [ADMIN_PRODUCTS_QUERY_KEYS.VIEW]: ADMIN_PRODUCTS_VIEW.CREATE,
          [ADMIN_PRODUCTS_QUERY_KEYS.EDITING_ID]: data.id,
        });
        router.push(`/theall_manager_only/products?${params.toString()}`);
      }
    } catch {
      progress.stop();
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">상품 등록(WEB)</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          하나투어·모두투어 상세 페이지 HTML 또는 텍스트를 AI가 파싱해 상품을 등록합니다.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]">
        <p className="font-medium text-[var(--text-primary)]">통합 크롬 익스텐션 (thealltour_extension)</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            관리자 <strong>도구 → 통합 익스텐션</strong>에서 ZIP 다운로드 후 Chrome에 설치
          </li>
          <li>로컬 개발 시 <code className="text-xs">tools/thealltour_extension/</code> 폴더를 직접 로드해도 됩니다</li>
          <li>관리자 사이트에 먼저 로그인한 뒤 하나/모두 상세 페이지에서 아이콘 클릭</li>
          <li>운영 시 익스텐션 storage의 <code className="text-xs">apiBaseUrl</code>을 설정</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">상품 URL</span>
          <input
            type="url"
            className={fieldClass}
            value={productSourceUrl}
            onChange={(e) => setProductSourceUrl(e.target.value)}
            placeholder="https://www.hanatour.com/trp/pkg/... 또는 modetour.com"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">정제 HTML (cleanHtmlStructure)</span>
          <span className="block text-xs text-[var(--text-secondary)]">
            익스텐션이 수집한 HTML 구조. 텍스트·이미지 위치 관계가 보존된 일정 매핑용 입력입니다.
          </span>
          <textarea
            className={`${fieldClass} min-h-[200px] font-mono text-xs`}
            value={cleanHtmlStructure}
            onChange={(e) => setCleanHtmlStructure(e.target.value)}
            placeholder="<div>1일차 ... <img src=...></div>"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">페이지 텍스트 (legacy fallback)</span>
          <textarea
            className={`${fieldClass} min-h-[120px] font-mono text-xs`}
            value={rawHtmlText}
            onChange={(e) => setRawHtmlText(e.target.value)}
            placeholder="HTML이 없을 때만 사용"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">일정 블록 JSON (legacy override)</span>
          <span className="block text-xs text-[var(--text-secondary)]">
            수동 itineraryBlocks. 있으면 AI 일정 대신 이 블록을 사용합니다.
          </span>
          <textarea
            className={`${fieldClass} min-h-[120px] font-mono text-xs`}
            value={itineraryBlocksText}
            onChange={(e) => setItineraryBlocksText(e.target.value)}
            placeholder={'[{"day":2,"heading":"상비산","description":"...","imageUrls":["https://..."]}]'}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">상품 갤러리 URL (선택, 결정적)</span>
          <span className="block text-xs text-[var(--text-secondary)]">
            익스텐션 productGalleryUrls와 동일. 한 줄에 하나. AI 대신 이 순서로 갤러리가 설정됩니다.
          </span>
          <textarea
            className={`${fieldClass} min-h-[80px] font-mono text-xs`}
            value={galleryUrlsText}
            onChange={(e) => setGalleryUrlsText(e.target.value)}
            placeholder={"https://...\nhttps://..."}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">대표 이미지 URL (선택)</span>
          <input
            type="url"
            className={fieldClass}
            value={heroImageUrl}
            onChange={(e) => setHeroImageUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
            {existingId && (
              <div className="mt-2">
                <Link
                  href={`/theall_manager_only/products?${ADMIN_PRODUCTS_QUERY_KEYS.VIEW}=${ADMIN_PRODUCTS_VIEW.CREATE}&${ADMIN_PRODUCTS_QUERY_KEYS.EDITING_ID}=${existingId}`}
                  className="font-medium underline"
                >
                  기존 상품 편집으로 이동
                </Link>
              </div>
            )}
          </div>
        )}

        {successSummary?.parsed && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
            등록 완료
            {successSummary.provider && ` (${successSummary.provider})`}:{" "}
            {successSummary.parsed.title ?? "제목 미정"}
            {successSummary.parsed.price != null &&
              ` · ${successSummary.parsed.price.toLocaleString("ko-KR")}원`}
            {successSummary.parsed.itineraryEventCount != null &&
              ` · 일정 이벤트 ${successSummary.parsed.itineraryEventCount}개`}
            {successSummary.parsed.galleryCount != null &&
              ` · 갤러리 ${successSummary.parsed.galleryCount}장`}
          </div>
        )}

        <div className="flex gap-2">
          <AdminButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? "AI 파싱·등록 중..." : "상품 등록"}
          </AdminButton>
          <AdminButton
            type="button"
            variant="secondary"
            onClick={() => router.push("/theall_manager_only/products")}
          >
            상품 목록
          </AdminButton>
        </div>
      </form>

      <AdminImportProgressOverlay
        open={progress.open}
        percent={progress.percent}
        label={progress.label}
      />
    </div>
  );
}
