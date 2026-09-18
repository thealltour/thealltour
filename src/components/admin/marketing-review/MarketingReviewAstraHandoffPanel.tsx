"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import { CopyToClipboardButton } from "@/components/admin/marketing-review/CopyToClipboardButton";

type UploadedAsset = {
  visualId: string;
  expectedFilename: string;
  storedFilename: string;
  storedPath: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  uploadedAt: string;
  status: string;
};

type PlanVisualDto = {
  visualId: string;
  role: string;
  visualMode: string | null;
  generatedVisualNeeded: boolean;
  visualIntent: string;
  usageLabels: string[];
};

type SlotDto = {
  visualId: string;
  role: string;
  visualIntent: string;
  visualMode: string | null;
  aspectRatio: string;
  expectedFilename: string;
  usageLabels: string[];
  compositionGuidance: string;
  textSafeArea: string;
  evidenceGuidance: string[];
  uploaded: UploadedAsset | null;
};

type UploadStatusDto = {
  required: number;
  uploaded: number;
  complete: boolean;
  missingVisualIds: string[];
  stale: boolean;
};

type HandoffDto = {
  contentTitleKo: string | null;
  generationMode: string;
  providerIntent: string;
  visualCount: number;
  copyText: string;
  editorialArchetype: string | null;
};

type HandoffViewDto = {
  status: "missing_package" | "missing_handoff" | "ready";
  candidateId: string;
  packagePresent: boolean;
  handoff: HandoffDto | null;
  handoffFingerprint: string | null;
  handoffStale: boolean;
  assetsStale: boolean;
  uploadStatus: UploadStatusDto | null;
  slots: SlotDto[];
  message: string | null;
};

type ViewDto = {
  candidateId: string;
  packagePresent: boolean;
  message: string | null;
  plan: {
    status: "not_generated" | "fresh" | "stale";
    statusLabel: string;
    present: boolean;
    strategySummary: string | null;
    planningMode: string | null;
    visualCount: number;
    generatedVisualNeededCount: number;
    fingerprint: string | null;
    visuals: PlanVisualDto[];
  };
  handoff: HandoffViewDto;
  canGenerateHandoff: boolean;
  handoffBlockReason: string | null;
  code?: string;
};

function previewUrl(candidateId: string, relativePath: string): string {
  const params = new URLSearchParams({ path: relativePath, disposition: "inline" });
  return `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/assets/file?${params.toString()}`;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadgeClass(status: string): string {
  if (status === "fresh") return "text-[var(--success)]";
  if (status === "stale") return "text-[var(--warning)]";
  return "text-[var(--text-secondary)]";
}

function SlotRow(props: {
  candidateId: string;
  slot: SlotDto;
  uploadDisabled: boolean;
  busyVisualId: string | null;
  onUpload: (visualId: string, file: File) => Promise<void>;
}) {
  const { candidateId, slot, uploadDisabled, busyVisualId, onUpload } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const busy = busyVisualId === slot.visualId;
  const uploaded = slot.uploaded;

  return (
    <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-medium text-sm">{slot.visualId}</div>
        <div className="text-xs text-[var(--text-secondary)]">
          {uploaded ? "✓ 업로드됨" : "미업로드"}
        </div>
      </div>
      <div className="text-xs text-[var(--text-secondary)] space-y-1">
        <div>
          사용처:{" "}
          {slot.usageLabels.length > 0 ? slot.usageLabels.join(" · ") : "—"}
        </div>
        <div>역할: {slot.role}</div>
        {slot.visualIntent ? <div>의도: {slot.visualIntent}</div> : null}
        <div>
          Expected file: {slot.expectedFilename}
          {slot.aspectRatio ? ` · ${slot.aspectRatio}` : ""}
        </div>
      </div>

      {uploaded ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl(candidateId, uploaded.storedPath)}
            alt={uploaded.visualId}
            className="max-h-40 max-w-full rounded-md border border-[var(--border)] object-contain bg-[var(--surface-muted)]"
          />
          <div className="text-[10px] text-[var(--text-secondary)]">
            {uploaded.storedFilename}
            {uploaded.width && uploaded.height
              ? ` · ${uploaded.width}×${uploaded.height}`
              : ""}
            {` · ${formatBytes(uploaded.byteSize)}`}
            {uploaded.uploadedAt
              ? ` · ${new Date(uploaded.uploadedAt).toLocaleString("ko-KR")}`
              : ""}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          className="hidden"
          disabled={uploadDisabled || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onUpload(slot.visualId, file);
          }}
        />
        <button
          type="button"
          disabled={uploadDisabled || busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {busy ? "업로드 중…" : uploaded ? "교체" : "이미지 업로드"}
        </button>
      </div>
    </div>
  );
}

export function MarketingReviewAstraHandoffPanel(props: {
  candidateId: string;
  /** Bump after channel generate/reload so panel refetches artifacts. */
  refreshKey?: number;
}) {
  const { candidateId, refreshKey = 0 } = props;
  const [view, setView] = useState<ViewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyVisualId, setBusyVisualId] = useState<string | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/astra-handoff`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as ViewDto;
      if (!res.ok) {
        setView(null);
        setMessage(data.message ?? "비주얼 오케스트레이션 상태를 불러오지 못했습니다.");
        return;
      }
      setView(data);
      setMessage(data.message);
    } catch {
      setView(null);
      setMessage("비주얼 오케스트레이션 상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const generatePlan = useCallback(async () => {
    setPlanBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/shared-visual-plan/generate`,
        { method: "POST" },
      );
      const data = (await res.json()) as {
        message?: string;
        ok?: boolean;
        code?: string;
      };
      setMessage(data.message ?? (res.ok ? "Shared Visual Plan을 생성했습니다." : "Plan 생성 실패"));
      await load();
    } catch {
      setMessage("Shared Visual Plan 생성에 실패했습니다.");
    } finally {
      setPlanBusy(false);
    }
  }, [candidateId, load]);

  const generateHandoff = useCallback(async () => {
    setHandoffBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/astra-handoff/generate`,
        { method: "POST" },
      );
      const data = (await res.json()) as { message?: string; ok?: boolean };
      setMessage(data.message ?? (res.ok ? "Astra Handoff를 생성했습니다." : "Handoff 생성 실패"));
      await load();
    } catch {
      setMessage("Astra Handoff 생성에 실패했습니다.");
    } finally {
      setHandoffBusy(false);
    }
  }, [candidateId, load]);

  const onUpload = useCallback(
    async (visualId: string, file: File) => {
      setBusyVisualId(visualId);
      setMessage(null);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(
          `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/shared-visuals/${encodeURIComponent(visualId)}/upload`,
          { method: "POST", body: form },
        );
        const data = (await res.json()) as { message?: string; code?: string };
        if (!res.ok) {
          setMessage(data.message ?? "업로드에 실패했습니다.");
          return;
        }
        setMessage(data.message ?? "업로드했습니다.");
        await load();
      } catch {
        setMessage("업로드에 실패했습니다.");
      } finally {
        setBusyVisualId(null);
      }
    },
    [candidateId, load],
  );

  if (loading && !view) {
    return (
      <AdminCard className="space-y-2 p-4">
        <h2 className="text-base font-semibold">Shared Visual / Astra Handoff</h2>
        <p className="text-sm text-[var(--text-secondary)]">불러오는 중…</p>
      </AdminCard>
    );
  }

  if (!view || !view.packagePresent) {
    return (
      <AdminCard className="space-y-2 p-4">
        <h2 className="text-base font-semibold">Shared Visual / Astra Handoff</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {view?.message ?? message ?? "HDD 마케팅 패키지가 없습니다."}
        </p>
      </AdminCard>
    );
  }

  const plan = view.plan;
  const handoffView = view.handoff;
  const handoff = handoffView.handoff;
  const uploadDisabled = !handoff || handoffView.handoffStale;
  const progress = handoffView.uploadStatus;

  return (
    <AdminCard className="space-y-6 p-4">
      {/* Shared Visual Plan */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Shared Visual Plan</h2>
          <div className={`text-xs ${statusBadgeClass(plan.status)}`}>
            {plan.statusLabel}
            {plan.planningMode ? ` · ${plan.planningMode}` : ""}
            {plan.present ? ` · visuals ${plan.visualCount}` : ""}
          </div>
        </div>

        <p className="text-xs text-[var(--text-secondary)]">
          채널 생성/재생성과 독립된 cross-channel editorial stage입니다. 채널을 바꾼 뒤에는 Plan이
          stale이 되며, 자동으로 재생성되지 않습니다.
        </p>

        {plan.status === "stale" ? (
          <p className="text-sm text-[var(--warning)]">
            채널 결과가 변경되어 Plan이 오래되었습니다. 검토 후 재생성하세요. (기존 Plan은
            유지됩니다.)
          </p>
        ) : null}

        {plan.strategySummary ? (
          <p className="text-sm">{plan.strategySummary}</p>
        ) : null}

        {plan.visuals.length > 0 ? (
          <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
            {plan.visuals.map((v) => (
              <li key={v.visualId} className="rounded-md border border-[var(--border)] p-2">
                <div className="font-medium text-[var(--text)]">
                  {v.visualId} · {v.role}
                  {v.generatedVisualNeeded ? " · Astra 필요" : " · 로컬/비생성"}
                </div>
                <div>{v.visualIntent}</div>
                <div>
                  사용처: {v.usageLabels.length > 0 ? v.usageLabels.join(" · ") : "—"}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">아직 Plan이 없습니다.</p>
        )}

        <button
          type="button"
          disabled={planBusy}
          onClick={() => void generatePlan()}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {planBusy
            ? "생성 중…"
            : plan.present
              ? "Shared Visual Plan 재생성"
              : "Shared Visual Plan 생성"}
        </button>
      </section>

      {/* Astra Handoff */}
      <section className="space-y-3 border-t border-[var(--border)] pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Astra Handoff</h2>
          <div
            className={`text-xs ${statusBadgeClass(
              !handoff
                ? "not_generated"
                : handoffView.handoffStale
                  ? "stale"
                  : "fresh",
            )}`}
          >
            {!handoff
              ? "아직 생성되지 않음"
              : handoffView.handoffStale
                ? "오래됨(stale)"
                : "최신"}
            {handoff ? ` · visuals ${handoff.visualCount}` : ""}
          </div>
        </div>

        <p className="text-xs text-[var(--text-secondary)]">
          fresh Shared Visual Plan이 있을 때만 생성할 수 있습니다. Plan 재생성 후 Handoff는 stale이
          됩니다.
        </p>

        {view.handoffBlockReason && !view.canGenerateHandoff ? (
          <p className="text-sm text-[var(--warning)]">{view.handoffBlockReason}</p>
        ) : null}

        <button
          type="button"
          disabled={handoffBusy || !view.canGenerateHandoff}
          onClick={() => void generateHandoff()}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-40"
          title={view.handoffBlockReason ?? undefined}
        >
          {handoffBusy
            ? "생성 중…"
            : handoff
              ? "Astra Handoff 재생성"
              : "Astra Handoff 생성"}
        </button>

        {handoff ? (
          <>
            {handoff.contentTitleKo ? (
              <p className="text-sm font-medium">{handoff.contentTitleKo}</p>
            ) : null}

            {handoffView.handoffStale ? (
              <p className="text-sm text-[var(--warning)]">
                현재 Astra 요청문이 최신 Visual Plan과 일치하지 않습니다. Handoff를 재생성한 뒤
                업로드하세요.
              </p>
            ) : null}

            {handoffView.assetsStale && !handoffView.handoffStale ? (
              <p className="text-sm text-[var(--warning)]">
                업로드된 Shared Visual 매핑이 현재 Handoff/Plan과 어긋납니다. visualId만 같다고
                같은 이미지가 아닙니다. 필요 시 다시 업로드하세요. (기존 파일은 삭제되지
                않습니다.)
              </p>
            ) : null}

            {progress ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Astra visuals: {progress.required} required · {progress.uploaded} /{" "}
                {progress.required} uploaded
                {progress.complete ? " · complete" : ""}
              </p>
            ) : null}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--text-secondary)]">Astra 요청문</span>
                <CopyToClipboardButton
                  label="Astra 요청문"
                  value={handoff.copyText}
                  title="Astra 요청문 복사"
                />
              </div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs">
                {handoff.copyText}
              </pre>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">공유 비주얼 슬롯</h3>
              {handoffView.slots.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  업로드할 Astra 비주얼이 없습니다.
                </p>
              ) : (
                handoffView.slots.map((slot) => (
                  <SlotRow
                    key={slot.visualId}
                    candidateId={candidateId}
                    slot={slot}
                    uploadDisabled={uploadDisabled}
                    busyVisualId={busyVisualId}
                    onUpload={onUpload}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            {handoffView.message ?? "Astra Handoff가 아직 없습니다."}
          </p>
        )}
      </section>

      {message ? <p className="text-sm text-[var(--text-secondary)]">{message}</p> : null}
    </AdminCard>
  );
}
