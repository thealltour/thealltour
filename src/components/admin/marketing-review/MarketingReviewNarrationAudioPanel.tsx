"use client";
import { useState } from "react";
import type { NarrationView } from "@/lib/marketing/publishable/narration/contracts";
export function MarketingReviewNarrationAudioPanel({ candidateId, view, dirty }: { candidateId: string; view: NarrationView; dirty: boolean }) {
  const [profileId, setProfileId] = useState("");
  const [jobId, setJobId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration-audio`;
  async function request(queue: boolean) {
    setBusy(true);
    try {
      const response = await fetch(queue ? endpoint : `${endpoint}?jobId=${encodeURIComponent(jobId)}`, queue ? {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId,
          expectedRevision: view.narration?.revision, expectedFingerprint: view.narration?.fingerprint }),
      } : { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      setJobId(data.jobId);
      const labels: Record<string, string> = { queued: "실행 대기", running: "생성 중", completed: "생성 완료", failed: "생성 실패", stale: "변경 감지 · 재생성 필요" };
      setMessage(`${labels[data.status] ?? data.status}${data.timeline ? ` · 실제 음성·문장 간 쉼 포함 ${(data.timeline.totalDurationMs / 1000).toFixed(2)}초` : ""}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "음성 작업 처리 실패"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2 rounded border border-[var(--border)] p-3 text-sm">
    <h4 className="font-semibold">문장별 음성 생성</h4>
    <p>설정된 음성 프로필 ID를 입력하세요. 요청을 저장한 뒤 별도 작업 실행기가 문장별 음성을 생성합니다. 현재 화면에서 바로 TTS를 호출하지 않습니다.</p>
    <label>음성 프로필 <input value={profileId} disabled={busy} onChange={e => setProfileId(e.target.value)} className="rounded border bg-[var(--bg)] p-1" /></label>
    <div className="flex gap-3"><button type="button" disabled={busy || dirty || !profileId.trim() || !view.canEdit || view.gateState !== "approved"} onClick={() => void request(true)}>승인본 음성 작업 요청</button></div>
    <label>작업 ID <input value={jobId} disabled={busy} onChange={e => setJobId(e.target.value)} className="w-full rounded border bg-[var(--bg)] p-1" /></label>
    <button type="button" disabled={busy || !jobId || dirty} onClick={() => void request(false)}>작업 상태 확인</button>
    {message && <p role="status">{message}</p>}
  </div>;
}
