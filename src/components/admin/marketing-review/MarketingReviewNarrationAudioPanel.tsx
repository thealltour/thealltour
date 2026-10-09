"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import AdminButton from "@/components/admin/ui/AdminButton";
import { CopyToClipboardButton } from "./CopyToClipboardButton";
import { MarketingReviewNarrationEdgeRangeEditor } from "./MarketingReviewNarrationEdgeRangeEditor";
import type { NarrationView } from "@/lib/marketing/publishable/narration/contracts";
import type { AudioMasterTimeline } from "@/lib/marketing/tts/timeline/contracts";

type AudioState = { profiles: { profileId: string; displayName: string }[]; jobId: string | null;
  profileId?: string; speed?: number; status?: string; errorCode?: string | null; timeline?: AudioMasterTimeline | null; canReprocess?: boolean;
  processing?: { policyId: string; sourceAudioJobId: string | null; segments: ProcessingSegmentView[] } | null };
type ProcessingSegmentView = { segmentId: string; status: string; removedLeadingMs: number; removedTrailingMs: number; rawDurationMs: number | null; measuredDurationMs: number | null; diagnostics: string[];
  rawSha256: string; processedSha256: string | null; keepRawApproved: boolean | null; edgeDecision: { mode: "auto_range" | "manual_range"; startSample: number; endSampleExclusive: number } | null };
const processingLabels: Record<string, string> = { ready: "무음 정리됨", review_required: "검토 필요 · 원본 길이 유지", failed: "정리 실패" };
const speeds = [0.7, 0.8, 0.9, 1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.4, 1.5, 1.75, 2];
const labels: Record<string, string> = { queued: "음성 생성 대기 중", running: "문장별 음성 생성 중", completed: "음성 생성 완료", failed: "음성 생성 실패 · 다시 생성할 수 있습니다", stale: "원고 또는 설정이 변경됐습니다 · 다시 생성해주세요" };
export function MarketingReviewNarrationAudioPanel({ candidateId, view, dirty }: { candidateId: string; view: NarrationView; dirty: boolean }) {
  const [profileId, setProfileId] = useState("");
  const [speed, setSpeed] = useState(1.15);
  const selectionRestored = useRef(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState("");
  const previewController = useRef<AbortController | null>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioState | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration-audio`;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      const data: AudioState & { message?: string } = await response.json();
      if (!response.ok) throw new Error(data.message || "음성 설정을 불러오지 못했습니다.");
      if (signal?.aborted) return;
      setState(data); setProfileId(current => data.profiles.some(p => p.profileId === current) ? current : data.profiles.some(p => p.profileId === data.profileId) ? data.profileId! : data.profiles[0]?.profileId || ""); setMessage("");
      if (!selectionRestored.current) { setSpeed(data.speed ?? 1.15); selectionRestored.current = true; }
    } catch (error) { if (!signal?.aborted) setMessage(error instanceof Error ? error.message : "음성 상태 확인 실패"); }
  }, [endpoint]);
  useEffect(() => {
    setPreviewUrl(null); setPreviewMessage("");
    return () => { previewController.current?.abort(); };
  }, [profileId, speed]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    const audio = previewAudio.current;
    if (previewUrl) void audio?.play().catch(() => {});
    return () => { audio?.pause(); };
  }, [previewUrl]);
  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh, view.narration?.fingerprint]);
  const pending = state?.status === "queued" || state?.status === "running";
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    async function poll() { await refresh(controller.signal); if (!controller.signal.aborted) timer = setTimeout(() => void poll(), 4000); }
    timer = setTimeout(() => void poll(), 4000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [pending, refresh]);
  async function generate() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, speed, expectedRevision: view.narration?.revision, expectedFingerprint: view.narration?.fingerprint }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      setState(current => ({ profiles: current?.profiles ?? [], ...data }));
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "음성 생성 요청 실패"); }
    finally { setBusy(false); }
  }
  async function reprocess() {
    if (!state?.jobId) return; setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reprocess", sourceJobId: state.jobId }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      await refresh(); setMessage("기존 음성의 앞뒤 무음을 정리한 새 음성 작업을 만들었습니다. 장면 계획과 이후 단계는 새 음성 기준으로 다시 승인해야 합니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "무음 정리 실패"); }
    finally { setBusy(false); }
  }
  async function approveKeepRaw(segment: ProcessingSegmentView) {
    if (!state?.jobId || !segment.processedSha256) return; setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve-keep-raw", audioJobId: state.jobId, sentenceId: segment.segmentId, expectedRawSha256: segment.rawSha256, expectedProcessedSha256: segment.processedSha256 }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      await refresh(); setMessage("원본 길이 유지로 승인했습니다. 음성이나 무음 정리 기준이 바뀌면 다시 승인해야 합니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "승인 실패"); }
    finally { setBusy(false); }
  }
  async function preview() {
    const controller = new AbortController(); previewController.current = controller;
    setPreviewBusy(true); setPreviewMessage(""); setPreviewUrl(null);
    try {
      const response = await fetch(`${endpoint}/preview`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, speed }), signal: controller.signal });
      if (!response.ok) { const data = await response.json(); throw new Error(data.message || "미리듣기 실패"); }
      const audio = await response.blob(); if (controller.signal.aborted) return;
      setPreviewUrl(URL.createObjectURL(audio)); setPreviewMessage(`“안녕하세요” · ${speed.toFixed(2)}배속`);
    } catch (error) { if (!controller.signal.aborted) setPreviewMessage(error instanceof Error ? error.message : "미리듣기 실패"); }
    finally { if (previewController.current === controller) { setPreviewBusy(false); previewController.current = null; } }
  }
  return <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
    <h4 className="font-semibold">문장별 음성 생성</h4>
    <p className="text-[var(--text-secondary)]">승인한 원고를 미니 PC로 보내 문장별 음성을 생성합니다. 완료되면 실제 재생 길이와 음성을 확인할 수 있습니다.</p>
    <label className="flex flex-wrap items-center gap-2">목소리
      <select value={profileId} disabled={busy || pending || previewBusy} onChange={e => setProfileId(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
        <option value="">목소리를 선택하세요</option>{state?.profiles.map(p => <option key={p.profileId} value={p.profileId}>{p.displayName}</option>)}
      </select>
    </label>
    <label className="flex flex-wrap items-center gap-2">말하기 속도
      <select value={speed} disabled={busy || pending || previewBusy} onChange={e => setSpeed(Number(e.target.value))} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
        {(speeds.includes(speed) ? speeds : [...speeds, speed].sort((a, b) => a - b)).map(value => <option key={value} value={value}>{value.toFixed(2)}배{value === 1 ? " · 기본" : value === 1.15 ? " · 추천 시작점" : ""}</option>)}
      </select>
    </label>
    <p className="text-xs text-[var(--text-secondary)]">변경한 속도는 음성을 다시 생성할 때 적용됩니다. 새 음성을 생성하면 기존 장면 계획도 새 음성에 맞춰 갱신해야 합니다.</p>
    <div className="space-y-2 rounded-lg bg-[var(--surface-muted)] p-3">
      <AdminButton type="button" variant="secondary" disabled={busy || pending || previewBusy || !profileId || !view.canEdit} onClick={() => void preview()}>{previewBusy ? "샘플 준비 중…" : "목소리 미리듣기"}</AdminButton>
      <p className="text-xs text-[var(--text-secondary)]">선택한 목소리와 속도로 “안녕하세요”를 읽습니다. 원고를 입력할 필요는 없습니다. 처음 듣는 조합은 샘플 생성 시간이 필요합니다.</p>
      {previewMessage && <p role="status">{previewMessage}</p>}
      {previewUrl && <audio ref={previewAudio} controls src={previewUrl} className="w-full" />}
    </div>
    <div className="flex flex-wrap gap-2">
      <AdminButton type="button" disabled={busy || pending || previewBusy || dirty || !profileId || !view.canEdit || view.gateState !== "approved"} onClick={() => void generate()}>{pending ? "음성 생성 진행 중…" : state?.jobId ? "음성 다시 생성하기" : "음성 생성하기"}</AdminButton>
      <AdminButton type="button" variant="secondary" disabled={busy} onClick={() => void refresh()}>상태 새로고침</AdminButton>
    </div>
    {(dirty || view.gateState !== "approved") && <p className="text-[var(--text-secondary)]">현재 원고를 저장하고 승인한 뒤 음성을 생성하세요.</p>}
    <p role="status" aria-live="polite">{message || (state?.status ? labels[state.status] : "목소리를 선택한 뒤 음성을 생성하세요.")}</p>
    {state?.errorCode && <p className="text-xs text-[var(--text-secondary)]">오류 코드: {state.errorCode}</p>}
    {state?.jobId && <div className="flex flex-wrap items-center gap-2"><span className="break-all text-xs">작업 ID: {state.jobId}</span><CopyToClipboardButton label="작업 ID" value={state.jobId} /></div>}
    {state?.status === "completed" && state.timeline && !dirty && <div className="space-y-3">
      <p className="font-medium">총 {(state.timeline.totalDurationMs / 1000).toFixed(2)}초 · 생성 속도 {(state.speed ?? 1).toFixed(2)}배 · 문장 사이 쉼 포함</p>
      <p className="text-xs text-[var(--text-secondary)]">{state.processing ? "각 문장 음성의 앞뒤 무음만 정리했습니다. 문장 안의 쉼과 문장 사이 0.25초 쉼은 그대로입니다." : "이전 방식 음성입니다. 앞뒤 무음이 정리되지 않았습니다."}</p>
      {state.canReprocess && <AdminButton type="button" variant="secondary" disabled={busy || pending || dirty || !view.canEdit} onClick={() => void reprocess()}>기존 음성으로 무음 정리</AdminButton>}
      {state.canReprocess && <p className="text-xs text-[var(--text-secondary)]">음성을 다시 만들지 않고 저장된 원본에서 새 음성 작업을 만듭니다. 기존 음성 원본과 이미 완성된 영상은 지우지 않습니다. 새 작업 기준으로 장면 계획을 다시 승인해야 하며, 이전 계획에 올린 이미지는 같은 파일을 다시 올려도 재사용할 수 없어 새로 생성한 이미지가 필요할 수 있습니다.</p>}
      {state.timeline.segments.map((segment, index) => { const processed = state.processing?.segments.find(s => s.segmentId === segment.segmentId); const src = `${endpoint}?jobId=${encodeURIComponent(state.jobId!)}&sentenceId=${encodeURIComponent(segment.segmentId)}`;
        return <div key={segment.segmentId} className="space-y-1 rounded-lg border border-[var(--border)] p-3">
          <p>{index + 1}. {segment.text}</p>
          <p className="text-xs text-[var(--text-secondary)]">최종 {(segment.durationMs / 1000).toFixed(2)}초{processed ? ` · ${processingLabels[processed.status] ?? processed.status} · 앞 ${(processed.removedLeadingMs / 1000).toFixed(2)}초 / 뒤 ${(processed.removedTrailingMs / 1000).toFixed(2)}초 제거${processed.rawDurationMs !== null ? ` · 원본 ${(processed.rawDurationMs / 1000).toFixed(2)}초` : ""}` : ""}</p>
          {processed?.diagnostics.length ? <p className="text-xs text-[var(--text-secondary)]">확인 필요: {processed.diagnostics.join(", ")}</p> : null}
          {processed?.status === "review_required" && <p className="text-xs">{processed.keepRawApproved ? "원본 길이 유지 승인됨 · 최종 영상에 사용할 수 있습니다." : "원본을 들어본 뒤 원본 길이 유지, 자동 제안 구간, 직접 지정 중 하나를 선택해주세요. 선택 전에도 미리보기 영상은 만들 수 있지만 최종 영상은 만들 수 없습니다."}</p>}
          {processed?.edgeDecision && <p className="text-xs">{processed.edgeDecision.mode === "auto_range" ? "자동 제안 구간" : "직접 지정한 구간"}을 들어보고 적용함 · 원본 샘플 {processed.edgeDecision.startSample}~{processed.edgeDecision.endSampleExclusive}</p>}
          {processed && (processed.status === "review_required" || processed.edgeDecision) && !dirty && <MarketingReviewNarrationEdgeRangeEditor key={`${state.jobId}-${segment.segmentId}`} endpoint={endpoint} jobId={state.jobId!} sentenceId={segment.segmentId}
            keepRawApproved={processed.keepRawApproved} canEdit={!busy && !pending && !!view.canEdit} onKeepRaw={() => approveKeepRaw(processed)} onApplied={async text => { await refresh(); setMessage(`${text} 장면 계획과 이후 단계는 새 음성 기준으로 다시 승인해야 합니다.`); }} />}
          {processed ? <div className="grid gap-1 sm:grid-cols-2"><label className="text-xs">정리 후<audio controls preload="none" className="w-full" src={src} /></label><label className="text-xs">원본<audio controls preload="none" className="w-full" src={`${src}&variant=raw`} /></label></div>
            : <audio controls preload="none" className="w-full" src={src} />}
        </div>; })}
      <p className="text-[var(--text-secondary)]">음성을 검토한 뒤 작업 ID를 복사해 다음 단계에서 음성·계획을 불러오세요.</p>
    </div>}
  </div>;
}
