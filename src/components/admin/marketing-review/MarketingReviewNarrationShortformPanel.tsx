"use client";
import { useEffect, useState } from "react";
type SourceView = { ready: boolean; canEdit: boolean; planFingerprint: string | null; sceneCount: number; totalDurationMs: number | null };
type JobView = { jobId: string; status: string; errorCode: string | null; sceneCount: number; totalDurationMs: number;
  output: { measuredDurationMs: number } | null };
export function MarketingReviewNarrationShortformPanel({ candidateId, refreshKey, onChanged }: { candidateId: string; refreshKey: number; onChanged: () => void }) {
  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration-shortform`;
  const storageKey = `narration-shortform-job:${candidateId}`;
  const [source, setSource] = useState<SourceView | null>(null);
  const [jobId, setJobId] = useState(""); const [job, setJob] = useState<JobView | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function get<T>(url: string): Promise<T> { const response = await fetch(url, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message); return data as T; }
  useEffect(() => {
    let cancelled = false; setSource(null); setJob(null);
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
  }, [endpoint, refreshKey, storageKey]);
  async function queue() {
    if (!source?.planFingerprint) return; setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedScenePlanFingerprint: source.planFingerprint }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      setJobId(data.jobId); setJob(null); try { localStorage.setItem(storageKey, data.jobId); } catch { /* Storage optional. */ }
      onChanged(); setMessage("렌더 작업을 요청했습니다. 별도 실행기가 실행한 뒤 상태를 확인해주세요.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "요청 실패"); } finally { setBusy(false); }
  }
  async function refresh() {
    if (!jobId) return; setBusy(true); setJob(null);
    try { const next = await get<JobView>(`${endpoint}?jobId=${encodeURIComponent(jobId)}`); setJob(next); try { localStorage.setItem(storageKey, next.jobId); } catch { /* Storage optional. */ } setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "상태 확인 실패"); } finally { setBusy(false); }
  }
  const labels: Record<string, string> = { queued: "실행 대기", running: "렌더 중", completed: "완료", failed: "실패", stale: "변경 감지 · 재생성 필요" };
  return <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
    <h3 className="font-semibold">Shortform 영상</h3>
    <p className="text-sm">문장별 이미지와 음성을 순서대로 연결합니다. Instagram 카드 선택과 무관하게 모든 문장을 사용합니다.</p>
    <p className="text-sm">{source?.ready ? `${source.sceneCount}장면 · 실제 타임라인 ${((source.totalDurationMs ?? 0) / 1000).toFixed(2)}초 · 9:16` : "현재 승인된 Narration·음성·장면 계획과 모든 장면의 이미지가 필요합니다."}</p>
    <button type="button" disabled={busy || !source?.ready || !source.canEdit} onClick={() => void queue()}>최신 장면으로 영상 작업 요청</button>
    <p className="text-sm">작업 요청은 파일만 저장합니다. 별도 실행기가 FFmpeg를 실행하며, 완료 결과가 현재 원문·음성·이미지와 일치해야 표시됩니다.</p>
    <label className="block text-sm">작업 ID<input value={jobId} disabled={busy} className="mt-1 block w-full rounded border bg-[var(--bg)] p-2" onChange={e => { setJobId(e.target.value); setJob(null); }} /></label>
    <button type="button" disabled={busy || !jobId.trim()} onClick={() => void refresh()}>작업 상태 확인</button>
    {job && <p className="text-sm">상태: {labels[job.status] ?? job.status}{job.output ? ` · 출력 길이 ${(job.output.measuredDurationMs / 1000).toFixed(2)}초` : ""}{job.errorCode ? " · 다시 요청하기 전에 작업 로그와 입력을 확인해주세요." : ""}</p>}
    {job?.status === "completed" && job.output && <div className="space-y-2">
      <video key={job.jobId} controls preload="metadata" className="max-h-[640px] max-w-full" src={`${endpoint}/${job.jobId}`} />
      <div className="flex gap-4 text-sm"><a href={`${endpoint}/${job.jobId}`} download="shortform.mp4">MP4 다운로드</a><a href={`${endpoint}/${job.jobId}?format=srt`}>문장별 SRT 다운로드</a></div>
    </div>}
    <p className="text-sm">720×1280 · 30fps · H.264/AAC. 자막은 MP4 내부 트랙과 별도 SRT로 제공하며 영상 화면에 직접 입히지는 않습니다.</p>
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
