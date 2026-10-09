"use client";
import { useEffect, useRef, useState } from "react";
import AdminButton from "@/components/admin/ui/AdminButton";
type Cue = { cueId: string; sentenceId: string; text: string; startMs: number; endMs: number; timingSource: "forced_alignment" | "manual" | "estimated"; reviewed: boolean };
type Issue = { severity: "error" | "warning"; code: string; cueId: string | null; sentenceId: string | null; message: string };
type AlignmentSentence = { sentenceId: string; status: "verified" | "review_required" | "failed"; reasons: string[]; greedy: string; elapsedMs: number;
  measures: { speechFrameRatio: number | null; unitCer: number | null; forcedLogProbPerFrame: number | null; freeLogProbPerFrame: number | null } };
type AlignmentJob = { jobId: string; status: "queued" | "running" | "completed" | "failed" | "stale"; errorCode: string | null; attempt: number; createdAt: string; startedAt: string | null;
  heartbeatAgeMs: number | null; fresh: boolean; inputFingerprint: string; config: { modelId: string; normalizer: string; version: string }; runner: { torchVersion: string; elapsedMs: number } | null; sentences: AlignmentSentence[] };
type CaptionView = { plan: { revision: number; fingerprint: string; cues: Cue[] } | null; fresh: boolean; approved: boolean; previewReady: boolean; finalReady: boolean; reason: string | null;
  issues: Issue[]; sentences: { sentenceId: string; text: string; startMs: number; endMs: number }[]; lines: Record<string, string[] | null>; canEdit: boolean;
  attention: Record<string, string[]>; previewJobId: string | null; alignment: { job: AlignmentJob | null; currentInputFingerprint: string | null } };
const alignmentStatus: Record<AlignmentJob["status"], string> = { queued: "대기 중", running: "정렬 중", completed: "완료", failed: "실패", stale: "음성·문장이 바뀌어 중단" };
const sentenceStatus: Record<AlignmentSentence["status"], string> = { verified: "정렬 확인", review_required: "검토 필요", failed: "정렬 실패" };
const reasonLabels: Record<string, string> = { no_speech: "말소리 없음", text_audio_mismatch: "들린 내용이 문장과 많이 다름", low_alignment_likelihood: "음성과 문장이 잘 맞지 않음",
  compressed_speech: "글자가 너무 짧은 구간에 몰림(발화 누락 가능)", mostly_wildcard: "확인 가능한 한글이 거의 없음", unit_missing: "정렬되지 않은 단어", timestamp_order: "시간 순서 오류",
  identity_mismatch: "음성 파일 불일치", remote_timeout: "실행 시간 초과", remote_runner_failed: "실행기 오류", model_hash_mismatch: "모델 파일 해시 불일치", model_not_pinned: "고정되지 않은 모델",
  runner_mismatch: "실행 스크립트 버전 불일치", audio_changed: "음성 파일이 바뀜", audio_hash_mismatch: "음성 파일 해시 불일치", remote_identity_mismatch: "실행 결과 연결 정보 불일치", alignment_failed: "정렬 실패" };
const reasonText = (codes: string[]) => codes.map(c => reasonLabels[c] ?? c).join(", ");
type Draft = { cueId: string | null; sentenceId: string; text: string; startMs: number | null; endMs: number | null; reviewed: boolean; timingSource: Cue["timingSource"] | null };
const timing: Record<string, string> = { estimated: "추정 시간", manual: "수동 조정", forced_alignment: "정렬 시간" };
const seconds = (ms: number | null) => ms === null ? "다시 계산" : `${(ms / 1000).toFixed(2)}초`;
export function MarketingReviewNarrationCaptionCuesPanel({ candidateId, refreshKey, onChanged }: { candidateId: string; refreshKey: number; onChanged: () => void }) {
  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration-captions`;
  const [view, setView] = useState<CaptionView | null>(null); const [drafts, setDrafts] = useState<Draft[]>([]); const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const dirtyRef = useRef(false); useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  function accept(next: CaptionView) { setView(next); setDrafts((next.plan?.cues ?? []).map(c => ({ cueId: c.cueId, sentenceId: c.sentenceId, text: c.text, startMs: c.startMs, endMs: c.endMs, reviewed: c.reviewed, timingSource: c.timingSource }))); setDirty(false); setAcknowledged([]); }
  useEffect(() => {
    let cancelled = false;
    void fetch(endpoint, { cache: "no-store" }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message); if (!cancelled) accept(data); })
      .catch(error => { if (!cancelled) setMessage(error instanceof Error ? error.message : "자막 cue를 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, [endpoint, refreshKey]);
  const alignmentActive = view?.alignment.job?.status === "queued" || view?.alignment.job?.status === "running";
  useEffect(() => {
    if (!alignmentActive) return;
    const timer = window.setInterval(() => { void fetch(endpoint, { cache: "no-store" }).then(async response => { const data = await response.json() as CaptionView;
      if (!response.ok) return; if (dirtyRef.current) setView(previous => previous ? { ...previous, alignment: data.alignment } : data); else accept(data); }).catch(() => undefined); }, 4000);
    return () => window.clearInterval(timer);
  }, [alignmentActive, endpoint]);
  async function post(body: Record<string, unknown>, done: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.message);
      accept(data); onChanged(); setMessage(done);
    } catch (error) { setMessage(error instanceof Error ? error.message : "자막 cue 처리 실패"); } finally { setBusy(false); }
  }
  async function run(action: "generate" | "save" | "approve" | "apply-alignment") {
    if (action === "generate" && dirty && !window.confirm("편집 중인 자막 cue를 자동 분할 결과로 바꿀까요?")) return;
    const expected = { expectedRevision: view?.plan?.revision ?? null, expectedFingerprint: view?.plan?.fingerprint ?? null };
    const body = action === "save" ? { action, ...expected, cues: drafts.map(({ sentenceId, text, startMs, endMs, reviewed }) => ({ sentenceId, text, startMs, endMs, reviewed })) } : { action, ...expected };
    await post(body, action === "generate" ? "문장 안에서만 자막 cue를 나눴습니다. 정렬 결과가 확인된 문장은 정렬 시간, 나머지는 글자 수 기준 추정값입니다. 미리보기로 확인해주세요."
      : action === "apply-alignment" ? "정렬 결과를 시간에 반영했습니다. 나누는 위치와 직접 입력한 시간은 그대로입니다." : action === "approve" ? "자막 cue를 승인했습니다." : "자막 cue를 저장했습니다.");
  }
  const job = view?.alignment.job ?? null; const attentionIds = Object.keys(view?.attention ?? {});
  const hasErrors = !!view?.issues.some(i => i.severity === "error"); const allAcknowledged = attentionIds.every(id => acknowledged.includes(id));
  const usableJob = job?.status === "completed" && job.fresh;
  const change = (next: Draft[]) => { setDrafts(next); setDirty(true); };
  const editable = !!view?.canEdit && !busy;
  const issuesFor = (cueId: string | null, sentenceId: string) => view?.issues.filter(i => (cueId && i.cueId === cueId) || (!i.cueId && i.sentenceId === sentenceId)) ?? [];
  return <div className="space-y-3 rounded-lg border border-[var(--border)] p-3 text-sm">
    <h4 className="font-semibold">자막 cue</h4>
    <p>문장 하나를 화면 자막 여러 개로 나눌 수 있습니다. 장면·이미지 수는 그대로입니다. 자막은 40px(em 기준) 굵은 글씨, 최대 2줄이며 글자를 줄이지 않습니다. 들어가지 않으면 더 나눠야 합니다.</p>
    <p className="text-xs text-[var(--text-secondary)]">정렬을 실행하면 실제 음성과 승인된 문장을 맞춰 cue 시작 시간을 정합니다. 정렬이 확인되지 않은 문장은 글자 수로 나눈 추정 시간을 쓰고 &quot;추정 시간&quot;으로 표시합니다. 정렬은 사람 승인을 대신하지 않습니다. 미리보기 영상은 검토 전에도 만들 수 있습니다.</p>
    <div className="space-y-1 rounded border border-[var(--border)] p-2 text-xs">
      <p className="font-medium">음성-문장 정렬: {job ? `${alignmentStatus[job.status]}${job.fresh ? "" : " · 현재 음성·문장과 다른 작업"}` : "아직 실행하지 않음"}{job ? ` · 시도 ${job.attempt}회` : ""}</p>
      {alignmentActive && job && <p>{job.status === "queued" ? "실행기가 작업을 가져가기를 기다리는 중입니다." : `정렬 중입니다. 문장 ${job.sentences.length || "전체"}개를 한 번에 처리합니다.`}{job.heartbeatAgeMs !== null && job.heartbeatAgeMs > 60_000 ? " 실행기 응답이 1분 넘게 없습니다." : ""}</p>}
      {job?.status === "failed" && <p className="font-semibold">실패 사유: {reasonText([job.errorCode ?? "alignment_failed"])}</p>}
      {job?.status === "completed" && <p>문장 {job.sentences.length}개 중 정렬 확인 {job.sentences.filter(s => s.status === "verified").length}개 · 검토 필요 {job.sentences.filter(s => s.status === "review_required").length}개 · 실패 {job.sentences.filter(s => s.status === "failed").length}개
        {job.runner ? ` · 처리 ${(job.runner.elapsedMs / 1000).toFixed(1)}초` : ""} · 모델 {job.config.modelId.split("@")[0]}</p>}
      <div className="flex flex-wrap gap-2">
        <AdminButton type="button" variant="secondary" disabled={!editable || alignmentActive || !view?.alignment.currentInputFingerprint || !!usableJob}
          onClick={() => void post({ action: "align", expectedInputFingerprint: view?.alignment.currentInputFingerprint ?? null }, "정렬 작업을 맡겼습니다. 끝나면 결과를 적용할 수 있습니다.")}>{job && job.status !== "completed" ? "정렬 다시 시도" : "정렬 실행"}</AdminButton>
        <AdminButton type="button" variant="secondary" disabled={!editable || dirty || !view?.plan || !view.fresh || job?.status !== "completed"} onClick={() => void run("apply-alignment")}>정렬 결과 적용</AdminButton>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <AdminButton type="button" variant="secondary" disabled={!editable || !view?.sentences.length} onClick={() => void run("generate")}>{view?.plan ? "자동으로 다시 나누기" : "자막 cue 자동 나누기"}</AdminButton>
      <AdminButton type="button" disabled={!editable || !dirty || !drafts.length} onClick={() => void run("save")}>자막 cue 저장</AdminButton>
      <AdminButton type="button" disabled={!editable || dirty || !view?.plan || !view.previewReady || view.approved || drafts.some(d => !d.reviewed)} onClick={() => void run("approve")}>자막 cue 승인</AdminButton>
    </div>
    {view?.sentences.map((sentence, index) => { const own = drafts.filter(d => d.sentenceId === sentence.sentenceId); if (!own.length && !view.plan) return null;
      const aligned = job?.status === "completed" ? job.sentences.find(s => s.sentenceId === sentence.sentenceId) : undefined;
      return <div key={sentence.sentenceId} className="space-y-2 rounded border border-[var(--border)] p-2">
        <p className="text-xs text-[var(--text-secondary)]">문장 {index + 1} · 음성 {seconds(sentence.startMs)}~{seconds(sentence.endMs)}{aligned ? ` · ${sentenceStatus[aligned.status]}` : ""}</p>
        {aligned && <p className="text-xs text-[var(--text-secondary)]">{aligned.reasons.length ? `사유: ${reasonText(aligned.reasons)} · ` : ""}인식된 소리: {aligned.greedy || "(없음)"}
          {aligned.measures.unitCer !== null ? ` · 글자 차이 ${Math.round(aligned.measures.unitCer * 100)}%` : ""}</p>}
        <label className="block text-xs">한 줄에 cue 하나 (문장 글자는 바꿀 수 없고 나누는 위치만 바꿉니다)
          <textarea value={own.map(d => d.text).join("\n")} disabled={!editable} className="mt-1 block min-h-16 w-full rounded border bg-[var(--bg)] p-2 text-sm"
            onChange={e => { const lines = e.target.value.split("\n").filter(l => l.trim()); const first = drafts.findIndex(d => d.sentenceId === sentence.sentenceId);
              const rest = drafts.filter(d => d.sentenceId !== sentence.sentenceId); const replaced = lines.map(text => ({ cueId: null, sentenceId: sentence.sentenceId, text, startMs: null, endMs: null, reviewed: false, timingSource: null }));
              change([...rest.slice(0, first < 0 ? rest.length : first), ...replaced, ...rest.slice(first < 0 ? rest.length : first)]); }} /></label>
        {own.map(draft => { const at = drafts.indexOf(draft); const lines = draft.cueId && !dirty ? view.lines[draft.cueId] : null;
          return <div key={draft.cueId ?? `${sentence.sentenceId}-${at}`} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="min-w-40 font-medium">{lines ? lines.join(" / ") : draft.text}</span>
            {draft.startMs === null ? <span>{seconds(null)}</span> : <>
              <label>시작(ms)<input type="number" step={10} value={draft.startMs} disabled={!editable} className="ml-1 w-24 rounded border bg-[var(--bg)] p-1" onChange={e => change(drafts.map((d, i) => i === at ? { ...d, startMs: Number(e.target.value), reviewed: false } : d))} /></label>
              <label>끝(ms)<input type="number" step={10} value={draft.endMs ?? 0} disabled={!editable} className="ml-1 w-24 rounded border bg-[var(--bg)] p-1" onChange={e => change(drafts.map((d, i) => i === at ? { ...d, endMs: Number(e.target.value), reviewed: false } : d))} /></label>
              <span>{draft.timingSource ? timing[draft.timingSource] : ""}</span></>}
            <label className="flex items-center gap-1"><input type="checkbox" checked={draft.reviewed} disabled={!editable || draft.startMs === null} onChange={e => change(drafts.map((d, i) => i === at ? { ...d, reviewed: e.target.checked } : d))} />검토함</label>
            {draft.cueId && !dirty && view.attention[draft.cueId] && <label className="flex items-center gap-1 font-semibold"><input type="checkbox" checked={acknowledged.includes(draft.cueId)} disabled={!editable}
              onChange={e => setAcknowledged(e.target.checked ? [...acknowledged, draft.cueId!] : acknowledged.filter(id => id !== draft.cueId))} />미리보기에서 확인함</label>}
            {issuesFor(draft.cueId, sentence.sentenceId).filter(i => i.cueId).map(i => <span key={i.code} className={i.severity === "error" ? "font-semibold" : "text-[var(--text-secondary)]"}>{i.severity === "error" ? "오류" : "확인"}: {i.message}</span>)}
          </div>; })}
        {issuesFor(null, sentence.sentenceId).filter(i => !i.cueId).map(i => <p key={i.code} className="text-xs font-semibold">오류: {i.message}</p>)}
      </div>; })}
    {view?.plan && !view.approved && <div className="space-y-1 rounded border border-[var(--border)] p-2 text-xs">
      <p className="font-medium">미리보기 후 전체 승인</p>
      <p>{view.previewJobId ? "현재 자막 cue로 만든 미리보기 영상이 있습니다." : "현재 자막 cue로 만든 완료된 미리보기 영상이 없습니다. 미리보기를 먼저 만들고 확인해주세요."}
        {attentionIds.length ? ` 확인 표시가 필요한 cue ${attentionIds.length}개 중 ${attentionIds.filter(id => acknowledged.includes(id)).length}개를 확인했습니다.` : " 따로 확인할 cue는 없습니다."}{hasErrors ? " 오류가 있는 cue를 먼저 고쳐주세요." : ""}</p>
      <AdminButton type="button" disabled={!editable || dirty || !view.previewJobId || !view.fresh || hasErrors || !allAcknowledged}
        onClick={() => void post({ action: "approve-all", expectedRevision: view.plan!.revision, expectedFingerprint: view.plan!.fingerprint, previewJobId: view.previewJobId, acknowledgedCueIds: acknowledged.filter(id => attentionIds.includes(id)) },
          "미리보기를 확인한 자막 cue 전체를 검토 표시하고 승인했습니다.")}>미리보기 확인 후 전체 승인</AdminButton>
    </div>}
    <p role="status">{message || (dirty ? "저장하지 않은 변경이 있습니다. 나누기를 바꾼 문장의 시간은 저장할 때 다시 추정합니다." : view?.approved && view.finalReady ? "승인됨" : view?.reason ?? "")}</p>
  </div>;
}
