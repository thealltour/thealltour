"use client";
import AdminButton from "@/components/admin/ui/AdminButton";
import { useEffect, useState } from "react";
import { MarketingReviewNarrationCaptionCuesPanel } from "./MarketingReviewNarrationCaptionCuesPanel";
import { MarketingReviewNarrationHookPanel } from "./MarketingReviewNarrationHookPanel";
import { MarketingReviewNarrationPlatformValidationPanel } from "./MarketingReviewNarrationPlatformValidationPanel";
type Box = readonly [number, number, number, number];
type Purpose = "preview" | "final";
type CaptionSource = { preview: { inputFingerprint: string | null; reason: string | null }; final: { inputFingerprint: string | null; reason: string | null }; workerAvailable: boolean; planFingerprint: string | null;
  sceneCount: number; approvedCount: number; totalDurationMs: number | null; layout: { policyId: string; platformValidation: string; boxes: Record<"requiredText" | "hook" | "caption", Box> } };
type SourceView = { canEdit: boolean; captions: CaptionSource };
type JobView = { jobId: string; contract: string; status: string; errorCode: string | null; sceneCount: number; totalDurationMs: number; purpose?: Purpose; captionCueCount?: number; hookEnabled?: boolean; firstSceneEndMs?: number;
  output: { measuredDurationMs: number } | null };
const guideColors = { requiredText: "rgba(255,255,255,0.9)", hook: "rgba(255,200,0,0.95)", caption: "rgba(0,200,255,0.95)" } as const;
const guideLabels = { requiredText: "공통 안전 영역", hook: "도입 문구 영역", caption: "자막 영역" } as const;
export function MarketingReviewNarrationShortformPanel({ candidateId, refreshKey, onChanged }: { candidateId: string; refreshKey: number; onChanged: () => void }) {
  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration-shortform`;
  const storageKey = `narration-shortform-job:${candidateId}`;
  const [source, setSource] = useState<SourceView | null>(null); const [localRefresh, setLocalRefresh] = useState(0);
  const [jobId, setJobId] = useState(""); const [job, setJob] = useState<JobView | null>(null); const [guides, setGuides] = useState<(keyof typeof guideLabels)[]>([]);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function get<T>(url: string): Promise<T> { const response = await fetch(url, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message); return data as T; }
  useEffect(() => {
    let cancelled = false; setSource(null);
    let savedJobId = ""; try { savedJobId = localStorage.getItem(storageKey) ?? ""; } catch { /* Storage optional. */ }
    void Promise.allSettled([get<SourceView>(endpoint), savedJobId ? get<JobView>(`${endpoint}?jobId=${encodeURIComponent(savedJobId)}`) : Promise.resolve(null)] as const)
      .then(([nextSource, nextJob]) => {
        if (cancelled) return;
        if (nextSource.status === "fulfilled") setSource(nextSource.value);
        else setMessage("렌더 입력을 확인하지 못했습니다. 원문·음성·이미지 상태를 확인해주세요.");
        if (nextJob.status === "fulfilled" && nextJob.value) { setJobId(nextJob.value.jobId); setJob(nextJob.value); }
        else if (nextJob.status === "rejected") { setJobId(savedJobId); setMessage("이전 렌더 결과를 확인하지 못했습니다. 최신 입력으로 새 작업을 요청할 수 있습니다."); }
      })
      .catch(error => { if (!cancelled) { setJob(null); setMessage(error instanceof Error ? error.message : "렌더 상태를 확인하지 못했습니다."); } });
    return () => { cancelled = true; };
    // Parent refresh checks source and last job only; no polling or rendering side effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, refreshKey, localRefresh, storageKey]);
  async function queue(purpose: Purpose) {
    const captions = source?.captions; const input = captions?.[purpose].inputFingerprint; if (!captions?.planFingerprint || !input) return; setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedScenePlanFingerprint: captions.planFingerprint, expectedInputFingerprint: input, purpose }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      setJobId(data.jobId); setJob(await get<JobView>(`${endpoint}?jobId=${encodeURIComponent(data.jobId)}`)); try { localStorage.setItem(storageKey, data.jobId); } catch { /* Storage optional. */ }
      onChanged(); setMessage(purpose === "final" ? "최종 영상 작업을 요청했습니다." : "미리보기 영상 작업을 요청했습니다. 자막 시간과 위치를 확인해주세요.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "요청 실패"); } finally { setBusy(false); }
  }
  async function refresh() {
    if (!jobId) return; setBusy(true); setJob(null);
    try { const next = await get<JobView>(`${endpoint}?jobId=${encodeURIComponent(jobId)}`); setJob(next); try { localStorage.setItem(storageKey, next.jobId); } catch { /* Storage optional. */ } setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "상태 확인 실패"); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status) || busy) return;
    let cancelled = false;
    const timer = setTimeout(() => { void get<JobView>(`${endpoint}?jobId=${encodeURIComponent(job.jobId)}`).then(next => { if (!cancelled) setJob(next); }).catch(() => { if (!cancelled) setMessage("영상 상태를 확인하지 못했습니다. 상태 확인을 눌러주세요."); }); }, 3000);
    return () => { cancelled = true; clearTimeout(timer); };
    // Poll only active jobs; stop on completion or unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, job, busy]);
  const changed = () => { setLocalRefresh(n => n + 1); onChanged(); };
  const labels: Record<string, string> = { queued: "실행 대기", running: "렌더 중", completed: "완료", failed: "실패", stale: "변경 감지 · 재생성 필요" };
  const captions = source?.captions; const canQueue = !busy && !!source?.canEdit && !!captions?.workerAvailable;
  return <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
    <h3 className="font-semibold">Shortform 영상</h3>
    <p className="text-sm">승인된 문장별 장면 영상(이미지 모션 또는 스톡 구간 클립)과 무음 정리된 음성을 연결하고, 검토한 자막 cue와 도입 문구를 영상에 입힙니다. 한 문장은 한 장면이며, 자막을 나눠도 장면 수는 바뀌지 않습니다.</p>
    <p className="text-sm">{captions?.totalDurationMs ? `${captions.sceneCount}장면 · 실제 타임라인 ${(captions.totalDurationMs / 1000).toFixed(2)}초 · 9:16` : "승인된 Narration·음성·장면 계획과 모든 장면의 영상 소스 승인(모션 또는 스톡 클립)이 필요합니다."}
      {captions ? ` · 장면 영상 승인 ${captions.approvedCount}/${captions.sceneCount}${!captions.workerAvailable ? " · 영상 실행기 연결 필요" : ""}` : ""}</p>
    <MarketingReviewNarrationCaptionCuesPanel candidateId={candidateId} refreshKey={refreshKey} onChanged={changed} />
    <MarketingReviewNarrationHookPanel candidateId={candidateId} refreshKey={refreshKey} onChanged={changed} />
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <AdminButton variant="secondary" type="button" disabled={!canQueue || !captions?.preview.inputFingerprint} onClick={() => void queue("preview")}>미리보기 영상 만들기</AdminButton>
        <AdminButton type="button" disabled={!canQueue || !captions?.final.inputFingerprint} onClick={() => void queue("final")}>최종 영상 만들기</AdminButton>
      </div>
      {captions?.preview.reason && <p className="text-sm">미리보기: {captions.preview.reason}</p>}
      {captions?.final.reason && <p className="text-sm">최종: {captions.final.reason}</p>}
    </div>
    <label className="block text-sm">작업 ID<input value={jobId} disabled={busy} className="mt-1 block w-full rounded border bg-[var(--bg)] p-2" onChange={e => { setJobId(e.target.value); setJob(null); }} /></label>
    <AdminButton variant="secondary" type="button" disabled={busy || !jobId.trim()} onClick={() => void refresh()}>작업 상태 확인</AdminButton>
    {job?.contract === "narration-shortform-render-job-v1" && <p className="text-sm">이전 정지 이미지 방식의 영상입니다.</p>}
    {job?.contract === "narration-shortform-render-job-v2" && <p className="text-sm">이전 문장 단위 자막 방식의 영상입니다. 새 작업은 자막 cue와 공통 안전 영역을 사용합니다.</p>}
    {job && <p className="text-sm">상태: {labels[job.status] ?? job.status}{job.purpose ? ` · ${job.purpose === "final" ? "최종" : "미리보기 (검토 전 자막 포함 가능)"}` : ""}{job.output ? ` · 출력 길이 ${(job.output.measuredDurationMs / 1000).toFixed(2)}초` : ""}
      {job.errorCode === "caption_layout_overflow" ? " · 실제 렌더에서 자막이 안전 영역을 벗어났습니다. 해당 cue를 더 나눠주세요."
        : job.errorCode === "caption_font_invalid" ? " · 자막 글꼴 파일이 없거나 고정된 SHA256과 다릅니다. 다른 글꼴로 대신 렌더하지 않았습니다. 설치 문서대로 글꼴을 다시 설치해주세요." : job.errorCode ? " · 다시 요청하기 전에 작업 로그와 입력을 확인해주세요." : ""}</p>}
    {job?.purpose && <p className="text-sm">자막 cue {job.captionCueCount}개 · 도입 문구 {job.hookEnabled ? `0~${(Math.min(3000, job.firstSceneEndMs ?? 3000) / 1000).toFixed(2)}초` : "사용 안 함"}</p>}
    {job?.status === "completed" && job.output && <div className="space-y-2">
      {captions && <div className="flex flex-wrap items-center gap-3 text-sm"><span>가이드 (화면에만 표시, 영상 파일에는 들어가지 않음):</span>
        {(Object.keys(guideLabels) as (keyof typeof guideLabels)[]).map(name => <label key={name} className="flex items-center gap-1"><input type="checkbox" checked={guides.includes(name)} onChange={e => setGuides(e.target.checked ? [...guides, name] : guides.filter(g => g !== name))} />{guideLabels[name]}</label>)}</div>}
      {captions && guides.length > 0 && <p className="text-xs">가이드는 프로젝트 공통 기준이며 플랫폼 앱의 실제 버튼·설명 위치가 아닙니다. 실제 가림 여부는 아래 실기기 검수로 확인합니다.</p>}
      <div className="relative inline-block">
        <video key={job.jobId} controls preload="metadata" className="block max-h-[640px] max-w-full" src={`${endpoint}/${job.jobId}`} />
        {captions && (Object.keys(guideLabels) as (keyof typeof guideLabels)[]).filter(name => guides.includes(name)).map(name => { const [x0, y0, x1, y1] = captions.layout.boxes[name];
          return <div key={name} aria-hidden className="pointer-events-none absolute border-2 border-dashed text-[10px]" style={{ left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%`, borderColor: guideColors[name], color: guideColors[name] }}>{guideLabels[name]}</div>; })}
      </div>
      <div className="flex gap-4 text-sm"><a href={`${endpoint}/${job.jobId}`} download="shortform.mp4">MP4 다운로드</a><a href={`${endpoint}/${job.jobId}?format=srt`}>자막 SRT 다운로드</a></div>
    </div>}
    <p className="text-sm">720×1280 · 30fps · H.264/AAC. 안전 영역은 {captions?.layout.policyId ?? "cross-platform-conservative-v2"} 기준이며 플랫폼 공식 검증이 아닙니다. 단어별 강조는 지원하지 않습니다.</p>
    <MarketingReviewNarrationPlatformValidationPanel canEdit={!!source?.canEdit} />
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
