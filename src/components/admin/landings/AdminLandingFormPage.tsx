"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import AdminLandingEmptyState from "@/components/admin/landings/AdminLandingEmptyState";
import AdminLandingForm, { type AdminLandingFormValue } from "@/components/admin/landings/AdminLandingForm";
import AdminLandingSectionsPanel from "@/components/admin/landings/AdminLandingSectionsPanel";
import {
  AdminLandingPublishClientError,
  createAdminLandingClient,
  getAdminLandingClient,
  publishAdminLandingClient,
  unpublishAdminLandingClient,
  updateAdminLandingClient,
} from "@/components/admin/landings/api/adminLandings.client";
import {
  ADMIN_LANDINGS_ERROR_DESCRIPTION,
  ADMIN_LANDINGS_ERROR_TITLE,
  ADMIN_LANDINGS_FUTURE_NEW_ROUTE,
  ADMIN_LANDINGS_ROUTE,
  buildAdminLandingPreviewHref,
} from "@/components/admin/landings/adminLandings.constants";
import type { AdminLandingDetail, AdminLandingSection, LandingPublishValidationIssue } from "@/types/adminLanding";

const ADMIN_LANDING_FORM_ID = "admin-landing-form";

/** `?? []`를 인라인으로 쓰면 매 렌더마다 새 배열이 되어 섹션 패널 useEffect가 상태를 계속 초기화함 */
const EMPTY_LANDING_SECTIONS: AdminLandingSection[] = [];

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
  const [publishIssues, setPublishIssues] = useState<LandingPublishValidationIssue[]>([]);
  const [publishBusy, setPublishBusy] = useState(false);

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

  const loadItem = useCallback(async (opts?: { background?: boolean }) => {
    if (mode !== "edit" || !landingId) return;
    const background = opts?.background === true;
    if (!background) {
      setLoading(true);
      setErrorMessage("");
      setLoadFailed(false);
    }
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
      const message = e instanceof Error ? e.message : ADMIN_LANDINGS_ERROR_DESCRIPTION;
      if (!background) {
        setErrorMessage(message);
        setLoadFailed(true);
        setDetail(null);
      } else {
        showToast("error", message);
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, [mode, landingId, showToast]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  async function handleSubmit(value: AdminLandingFormValue) {
    setSubmitting(true);
    setErrorMessage("");
    setPublishIssues([]);
    try {
      if (mode === "create") {
        const created = await createAdminLandingClient(value);
        if (!created.id?.trim()) {
          throw new Error("생성된 랜딩 ID가 없습니다.");
        }
        showToast("success", "랜딩 초안이 저장되었습니다.");
        router.push(`/theall_manager_only/landings/${encodeURIComponent(created.id)}`);
        return;
      }
      if (!landingId) {
        throw new Error("랜딩 ID가 없습니다.");
      }
      const lockedStatus = detail?.status ?? value.status;
      const item = await updateAdminLandingClient(landingId, { ...value, status: lockedStatus });
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
      showToast("success", "랜딩이 저장되었습니다.");
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

  const sectionPublishIssue = useMemo(
    () => publishIssues.some((i) => String(i.field).startsWith("sections")),
    [publishIssues],
  );

  const canPublish = detail?.status === "draft" || detail?.status === "archived";
  const canUnpublish = detail?.status === "published";
  const publishHighlightFields = useMemo(
    () => publishIssues.map((i) => i.field).filter((f) => !String(f).startsWith("sections")),
    [publishIssues],
  );

  const reloadLandingDetailInBackground = useCallback(() => loadItem({ background: true }), [loadItem]);

  async function handlePublishClick() {
    if (!landingId) return;
    setPublishBusy(true);
    setPublishIssues([]);
    setErrorMessage("");
    try {
      const item = await publishAdminLandingClient(landingId);
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
      showToast("success", "랜딩이 공개되었습니다. /recommended 경로에서 접근할 수 있습니다.");
    } catch (e) {
      if (e instanceof AdminLandingPublishClientError) {
        setPublishIssues(e.issues);
        const first = e.issues[0]?.message ?? "Publish 검증에 실패했습니다.";
        showToast("error", first);
        return;
      }
      const message = e instanceof Error ? e.message : "Publish에 실패했습니다.";
      setErrorMessage(message);
      showToast("error", message);
    } finally {
      setPublishBusy(false);
    }
  }

  async function handleUnpublishClick() {
    if (!landingId) return;
    setPublishBusy(true);
    setPublishIssues([]);
    setErrorMessage("");
    try {
      const item = await unpublishAdminLandingClient(landingId);
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
      showToast("success", "비공개로 전환했습니다. 공개 URL에서는 더 이상 보이지 않습니다.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unpublish에 실패했습니다.";
      setErrorMessage(message);
      showToast("error", message);
    } finally {
      setPublishBusy(false);
    }
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => router.push(buildAdminLandingPreviewHref(landingId))}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
              >
                미리보기
              </button>
              <button
                type="submit"
                form={ADMIN_LANDING_FORM_ID}
                disabled={submitting || publishBusy}
                className="rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--primary)] disabled:opacity-50"
              >
                {submitting ? "저장 중..." : "저장"}
              </button>
              {canPublish ? (
                <button
                  type="button"
                  disabled={publishBusy || submitting}
                  onClick={() => {
                    void handlePublishClick();
                  }}
                  className="rounded-lg border border-[var(--success)]/40 bg-[var(--success-bg)] px-3 py-2 text-sm font-semibold text-[var(--success)] hover:opacity-90 disabled:opacity-50"
                >
                  {publishBusy ? "처리 중..." : "Publish"}
                </button>
              ) : null}
              {canUnpublish ? (
                <button
                  type="button"
                  disabled={publishBusy || submitting}
                  onClick={() => {
                    void handleUnpublishClick();
                  }}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]/80 disabled:opacity-50"
                >
                  {publishBusy ? "처리 중..." : "Unpublish"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <p className="text-sm text-[var(--text-muted)]">{pageDescription}</p>
      </div>

      {publishIssues.length > 0 ? (
        <div
          role="alert"
          className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          <p className="font-semibold">Publish 검증 실패 — 아래를 수정한 뒤 다시 시도하세요.</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {publishIssues.map((issue, idx) => (
              <li key={`${issue.field}-${idx}`}>
                <span className="font-mono text-xs opacity-80">{issue.field}</span>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AdminLandingForm
        formId={ADMIN_LANDING_FORM_ID}
        mode={mode}
        initialValue={initialValue}
        submitting={submitting}
        errorMessage={errorMessage}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        omitStatusField
        highlightIssueFields={publishHighlightFields}
      />
      {mode === "edit" && landingId ? (
        <AdminLandingSectionsPanel
          key={landingId}
          landingId={landingId}
          initialSections={detail?.sections ?? EMPTY_LANDING_SECTIONS}
          reloadDetail={reloadLandingDetailInBackground}
          highlightIssue={sectionPublishIssue}
        />
      ) : null}
    </section>
  );
}
