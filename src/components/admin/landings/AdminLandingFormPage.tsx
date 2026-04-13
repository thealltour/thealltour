"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import AdminLandingEmptyState from "@/components/admin/landings/AdminLandingEmptyState";
import AdminLandingForm, { type AdminLandingFormValue } from "@/components/admin/landings/AdminLandingForm";
import AdminLandingSectionsPanel from "@/components/admin/landings/AdminLandingSectionsPanel";
import {
  createAdminLandingClient,
  getAdminLandingClient,
  updateAdminLandingClient,
} from "@/components/admin/landings/api/adminLandings.client";
import {
  ADMIN_LANDINGS_ERROR_DESCRIPTION,
  ADMIN_LANDINGS_ERROR_TITLE,
  ADMIN_LANDINGS_FUTURE_NEW_ROUTE,
  ADMIN_LANDINGS_ROUTE,
  buildAdminLandingPreviewHref,
} from "@/components/admin/landings/adminLandings.constants";
import type { AdminLandingDetail } from "@/types/adminLanding";

type AdminLandingFormPageProps = {
  mode: "create" | "edit";
  landingId?: string;
};

const DEFAULT_FORM_VALUE: AdminLandingFormValue = {
  title: "",
  slug: "",
  templateType: "destination_consulting",
  status: "draft",
  summary: "",
  seoTitle: "",
  seoDescription: "",
  sourcePath: "",
  quoteCategory: "",
};

export default function AdminLandingFormPage({ mode, landingId }: AdminLandingFormPageProps) {
  const router = useRouter();
  const { showToast } = useAdminToast();
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [detail, setDetail] = useState<AdminLandingDetail | null>(null);
  const [initialValue, setInitialValue] = useState<AdminLandingFormValue>(DEFAULT_FORM_VALUE);

  const pageTitle = useMemo(
    () => (mode === "create" ? "랜딩 생성" : "랜딩 수정"),
    [mode],
  );
  const pageDescription = useMemo(
    () =>
      mode === "create"
        ? "검색/유입 랜딩의 기본 정보를 입력합니다."
        : "랜딩 기본 메타 정보를 수정합니다.",
    [mode],
  );

  const loadItem = useCallback(async () => {
    if (mode !== "edit" || !landingId) return;
    setLoading(true);
    setErrorMessage("");
    setLoadFailed(false);
    try {
      const item = await getAdminLandingClient(landingId);
      setDetail(item);
      setInitialValue({
        title: item.title ?? "",
        slug: item.slug ?? "",
        templateType: (item.templateType as AdminLandingFormValue["templateType"]) ?? "destination_consulting",
        status: item.status ?? "draft",
        summary: item.summary ?? "",
        seoTitle: item.seoTitle ?? "",
        seoDescription: item.seoDescription ?? "",
        sourcePath: item.sourcePath ?? "",
        quoteCategory: item.quoteCategory ?? "",
      });
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : ADMIN_LANDINGS_ERROR_DESCRIPTION);
      setLoadFailed(true);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [mode, landingId]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  async function handleSubmit(value: AdminLandingFormValue) {
    setSubmitting(true);
    setErrorMessage("");
    try {
      if (mode === "create") {
        const created = await createAdminLandingClient(value);
        showToast("success", "랜딩 초안이 저장되었습니다.");
        router.push(`/theall_manager_only/landings/${encodeURIComponent(created.id)}`);
        return;
      }
      if (!landingId) {
        throw new Error("랜딩 ID가 없습니다.");
      }
      await updateAdminLandingClient(landingId, value);
      showToast("success", "랜딩이 저장되었습니다.");
      void loadItem();
    } catch (e) {
      const message = e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.";
      setErrorMessage(message);
      showToast("error", message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    router.push(ADMIN_LANDINGS_ROUTE);
  }

  if (loading) {
    return (
      <section className="rounded-2xl bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
        <p className="text-sm text-[var(--text-muted)]">랜딩 정보를 불러오는 중입니다...</p>
      </section>
    );
  }

  if (mode === "edit" && loadFailed) {
    return (
      <AdminLandingEmptyState
        title={ADMIN_LANDINGS_ERROR_TITLE}
        description={errorMessage}
        retryLabel="다시 시도"
        createLabel="랜딩 생성"
        onRetry={() => {
          void loadItem();
        }}
        onCreate={() => router.push(ADMIN_LANDINGS_FUTURE_NEW_ROUTE)}
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">{pageTitle}</h2>
          {mode === "edit" && landingId ? (
            <button
              type="button"
              onClick={() => router.push(buildAdminLandingPreviewHref(landingId))}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            >
              미리보기
            </button>
          ) : null}
        </div>
        <p className="text-sm text-[var(--text-muted)]">{pageDescription}</p>
      </div>
      <AdminLandingForm
        mode={mode}
        initialValue={initialValue}
        submitting={submitting}
        errorMessage={errorMessage}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
      {mode === "edit" && landingId ? (
        <AdminLandingSectionsPanel
          landingId={landingId}
          initialSections={detail?.sections ?? []}
          reloadDetail={loadItem}
        />
      ) : null}
    </section>
  );
}
