"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import {
  buildAdminMobileGolfAdEditHref,
  buildMobileGolfAdPreviewHref,
  createMobileGolfAdClient,
  publishMobileGolfAdClient,
  unpublishMobileGolfAdClient,
  updateMobileGolfAdClient,
} from "@/components/admin/mobile-golf-ads/api/mobileGolfAds.client";
import {
  buildMobileGolfAdPublicPath,
  buildMobileGolfAdPublicUrl,
  type MobileGolfAdLanding,
} from "@/lib/adminMobileGolfAds/types";
import { normalizeMobileGolfAdSlug } from "@/lib/adminMobileGolfAds/validation";

type FormState = {
  title: string;
  slug: string;
  heroImageUrl: string;
  benefitText: string;
  trustActionText: string;
  seoTitle: string;
  seoDescription: string;
};

const emptyForm: FormState = {
  title: "",
  slug: "",
  heroImageUrl: "",
  benefitText: "",
  trustActionText: "",
  seoTitle: "",
  seoDescription: "",
};

function toFormState(item: MobileGolfAdLanding): FormState {
  return {
    title: item.title,
    slug: item.slug,
    heroImageUrl: item.heroImageUrl,
    benefitText: item.benefitText,
    trustActionText: item.trustActionText,
    seoTitle: item.seoTitle ?? "",
    seoDescription: item.seoDescription ?? "",
  };
}

export type AdminMobileGolfAdFormProps = {
  mode: "create" | "edit";
  initial?: MobileGolfAdLanding | null;
};

export default function AdminMobileGolfAdForm({ mode, initial }: AdminMobileGolfAdFormProps) {
  const router = useRouter();
  const { showToast } = useAdminToast();
  const [form, setForm] = useState<FormState>(initial ? toFormState(initial) : emptyForm);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [busy, setBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);

  useEffect(() => {
    if (initial) setForm(toFormState(initial));
  }, [initial]);

  const previewPath = useMemo(() => {
    const slug = normalizeMobileGolfAdSlug(form.slug || "preview");
    return slug ? buildMobileGolfAdPublicPath(slug) : "";
  }, [form.slug]);

  const publicUrl = useMemo(() => {
    const slug = normalizeMobileGolfAdSlug(form.slug);
    return slug ? buildMobileGolfAdPublicUrl(slug) : "";
  }, [form.slug]);

  const handleTitleChange = (title: string) => {
    setForm((prev) => {
      const next = { ...prev, title };
      if (!slugTouched && mode === "create") {
        next.slug = normalizeMobileGolfAdSlug(title);
      }
      return next;
    });
  };

  const buildPayload = () => ({
    title: form.title.trim(),
    slug: normalizeMobileGolfAdSlug(form.slug),
    heroImageUrl: form.heroImageUrl.trim(),
    benefitText: form.benefitText.trim(),
    trustActionText: form.trustActionText.trim(),
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = buildPayload();
      if (mode === "create") {
        const item = await createMobileGolfAdClient(payload);
        showToast("success", "모바일 골프 랜딩이 생성되었습니다.");
        router.push(buildAdminMobileGolfAdEditHref(item.id));
        return;
      }
      if (!initial?.id) throw new Error("편집 ID가 없습니다.");
      await updateMobileGolfAdClient(initial.id, payload);
      showToast("success", "저장되었습니다.");
      router.refresh();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!initial?.id) return;
    setPublishBusy(true);
    try {
      if (initial.isPublished) {
        await unpublishMobileGolfAdClient(initial.id);
        showToast("success", "발행이 취소되었습니다.");
      } else {
        await updateMobileGolfAdClient(initial.id, buildPayload());
        await publishMobileGolfAdClient(initial.id);
        showToast("success", "발행되었습니다.");
      }
      router.refresh();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "발행 처리에 실패했습니다.");
    } finally {
      setPublishBusy(false);
    }
  };

  const copyPublicUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      showToast("success", "비즈보드 URL이 복사되었습니다.");
    } catch {
      showToast("error", "URL 복사에 실패했습니다.");
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">기본 정보</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              관리용 제목
            </label>
            <input
              required
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="예: 2026 여름 골프투어 비즈보드"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">slug</label>
            <input
              required
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((prev) => ({ ...prev, slug: e.target.value }));
              }}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="kakao-golf-2026"
            />
            {previewPath ? (
              <p className="mt-1 text-xs text-[var(--text-muted)]">공개 경로: {previewPath}</p>
            ) : null}
          </div>
          <div className="flex items-end gap-2">
            {publicUrl ? (
              <button
                type="button"
                onClick={() => void copyPublicUrl()}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold"
              >
                비즈보드 URL 복사
              </button>
            ) : null}
            {initial?.isPublished && form.slug ? (
              <a
                href={buildMobileGolfAdPreviewHref(form.slug)}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary)]"
              >
                공개 페이지 열기
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Hero Section</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">모바일 상단 히어로 이미지</p>
        <div className="mt-4">
          <ImageUploadField
            value={form.heroImageUrl}
            onChange={(url) => setForm((prev) => ({ ...prev, heroImageUrl: url }))}
            onUploaded={(url) => setForm((prev) => ({ ...prev, heroImageUrl: url }))}
            optional={false}
            placeholder="히어로 이미지 URL 또는 업로드"
            sizeHint="권장: 세로형 모바일 720×3120px 이하, 400KB 이하 WebP/JPG"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Benefit Section</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">볼드체로 표시됩니다.</p>
        <textarea
          required
          rows={5}
          value={form.benefitText}
          onChange={(e) => setForm((prev) => ({ ...prev, benefitText: e.target.value }))}
          className="mt-4 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          placeholder="핵심 혜택을 짧고 강하게 입력하세요."
        />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Trust &amp; Action Section</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">일반 안내 텍스트로 표시됩니다.</p>
        <textarea
          required
          rows={6}
          value={form.trustActionText}
          onChange={(e) => setForm((prev) => ({ ...prev, trustActionText: e.target.value }))}
          className="mt-4 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          placeholder="신뢰 요소, 이용 안내, 다음 행동을 안내하는 문구"
        />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">SEO (선택)</h2>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">SEO 제목</label>
            <input
              value={form.seoTitle}
              onChange={(e) => setForm((prev) => ({ ...prev, seoTitle: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              SEO 설명
            </label>
            <textarea
              rows={3}
              value={form.seoDescription}
              onChange={(e) => setForm((prev) => ({ ...prev, seoDescription: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-60"
        >
          {busy ? "저장 중…" : mode === "create" ? "생성" : "저장"}
        </button>
        {mode === "edit" && initial ? (
          <button
            type="button"
            disabled={publishBusy || busy}
            onClick={() => void handlePublishToggle()}
            className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {publishBusy
              ? "처리 중…"
              : initial.isPublished
                ? "발행 취소"
                : "발행"}
          </button>
        ) : null}
        {initial ? (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              initial.isPublished
                ? "bg-green-100 text-green-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {initial.isPublished ? "발행됨" : "초안"}
          </span>
        ) : null}
      </div>
    </form>
  );
}
