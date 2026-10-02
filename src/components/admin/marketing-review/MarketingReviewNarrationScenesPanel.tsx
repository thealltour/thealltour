"use client";
import { useEffect, useRef, useState } from "react";
import type { Narration } from "@/lib/marketing/publishable/narration/contracts";
import type { NarrationScenePlan, SceneHandoff } from "@/lib/marketing/publishable/narrationScenes/contracts";
type View = { plan: NarrationScenePlan | null; canEdit: boolean; gateState: string; sourceError: string | null;
  source: { narration: Narration; timeline: { totalDurationMs: number }; source: { audioJobId: string } } | null;
  handoff: SceneHandoff | null; uploads: { complete: boolean; slots: Array<{ visualId: string; ready: boolean }> } | null };
export function MarketingReviewNarrationScenesPanel({ candidateId, refreshKey, onChanged }: { candidateId: string; refreshKey: number; onChanged: () => void }) {
  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration-scenes`;
  const [view, setView] = useState<View | null>(null);
  const [audioJobId, setAudioJobId] = useState("");
  const [prompts, setPrompts] = useState<Array<{ sentenceId: string; visualPrompt: string }>>([]);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [handoffText, setHandoffText] = useState("");
  function accept(next: View) {
    setView(next); dirtyRef.current = false; setDirty(false); setHandoffText("");
    setAudioJobId(next.source?.source.audioJobId ?? next.plan?.source.audioJobId ?? "");
    setPrompts((next.source?.narration.sentences ?? []).map(sentence => ({ sentenceId: sentence.sentenceId,
      visualPrompt: next.plan?.scenes.find(scene => scene.sentenceId === sentence.sentenceId)?.visualPrompt ?? "" })));
  }
  async function fetchView(jobId?: string): Promise<View> {
    const response = await fetch(`${endpoint}${jobId ? `?audioJobId=${encodeURIComponent(jobId)}` : ""}`, { cache: "no-store" });
    const data = await response.json(); if (!response.ok) throw new Error(data.message); return data as View;
  }
  useEffect(() => {
    let cancelled = false;
    void fetchView().then(next => {
      if (!cancelled) {
        if (!dirtyRef.current) accept(next);
        else setMessage("원문 정보가 갱신되었습니다. 작성 중인 계획은 유지했습니다. 저장 충돌 시 다시 불러와주세요.");
      }
    }).catch(error => { if (!cancelled) setMessage(error instanceof Error ? error.message : "불러오기 실패"); });
    return () => { cancelled = true; };
    // Preserve dirty input and its original concurrency baseline on parent refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, refreshKey]);
  async function load() {
    if (dirty && !window.confirm("작성 중인 계획을 버리고 다시 불러올까요?")) return;
    setBusy(true); try { accept(await fetchView(audioJobId)); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "불러오기 실패"); } finally { setBusy(false); }
  }
  async function mutate(action: "save" | "approve" | "handoff") {
    if (!view?.source) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action, audioJobId: view.source.source.audioJobId, expectedRevision: view.plan?.revision ?? null,
        expectedFingerprint: view.plan?.fingerprint ?? null, expectedNarrationRevision: view.source.narration.revision,
        expectedNarrationFingerprint: view.source.narration.fingerprint, ...(action === "save" ? { prompts } : {}),
      }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      accept(await fetchView(view.source.source.audioJobId)); onChanged();
      if (data.handoff) setHandoffText(JSON.stringify(data.handoff, null, 2));
      setMessage(action === "handoff" ? "Astra 요청문을 만들었습니다. 아래 JSON을 복사해주세요." : action === "approve" ? "현재 장면 계획을 승인했습니다." : "장면 계획을 저장했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "처리 실패"); } finally { setBusy(false); }
  }
  async function upload(visualId: string, file: File) {
    if (!view?.plan || !view.handoff) return;
    setBusy(true);
    try {
      const form = new FormData(); form.set("file", file); form.set("visualId", visualId);
      form.set("planFingerprint", view.plan.fingerprint); form.set("handoffFingerprint", view.handoff.fingerprint);
      const response = await fetch(endpoint, { method: "POST", body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      accept(await fetchView()); onChanged(); setMessage("장면 이미지를 업로드했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "업로드 실패"); } finally { setBusy(false); }
  }
  const editable = !!view?.canEdit && !busy;
  const selectedSourceMatches = !view?.plan || view.plan.source.audioJobId === view.source?.source.audioJobId;
  return <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
    <h3 className="font-semibold">문장별 비주얼 계획 · {prompts.length}장면</h3>
    <p className="text-sm">승인된 문장마다 계획 하나와 9:16 생성 이미지 하나를 연결합니다. 기존 Instagram 공유 비주얼은 별도 단계로 유지합니다.</p>
    <div className="flex flex-wrap gap-2 text-sm"><label>완료된 음성 작업 ID <input value={audioJobId} disabled={busy} onChange={e => setAudioJobId(e.target.value)} className="rounded border bg-[var(--bg)] p-1" /></label><button type="button" disabled={busy} onClick={() => void load()}>음성·계획 불러오기</button></div>
    <p className="text-sm">상태: {dirty ? "저장 필요" : view?.gateState === "approved" ? "승인됨" : view?.gateState === "stale" ? "변경 감지 · 재검토 필요" : "작성·검토 필요"}{view?.source ? ` · ${(view.source.timeline.totalDurationMs / 1000).toFixed(2)}초` : ""}</p>
    {view?.sourceError && <p className="text-sm">{view.sourceError}</p>}
    {view?.source?.narration.sentences.map((sentence, index) => <div key={sentence.sentenceId} className="space-y-2 rounded border border-[var(--border)] p-3">
      <p className="text-sm">{index + 1}. {sentence.text}</p>
      <label className="block text-sm">비주얼 계획<textarea value={prompts[index]?.visualPrompt ?? ""} disabled={!editable} className="mt-1 block min-h-24 w-full rounded border bg-[var(--bg)] p-2" onChange={e => { setPrompts(previous => previous.map((p, i) => i === index ? { ...p, visualPrompt: e.target.value } : p)); dirtyRef.current = true; setDirty(true); setHandoffText(""); }} /></label>
      {view?.plan?.approval && view.gateState === "approved" && selectedSourceMatches && !dirty && <div className="space-y-2 text-sm">
        <span>{view.uploads?.slots.find(s => s.visualId === sentence.sentenceId)?.ready ? "이미지 준비됨" : "이미지 필요"}</span>
        {!view.handoff && <p>Astra 요청문을 만든 후 이미지를 업로드해주세요.</p>}
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!editable || !view.handoff} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(sentence.sentenceId, file); e.target.value = ""; }} />
        {view.uploads?.slots.find(s => s.visualId === sentence.sentenceId)?.ready && <img alt={`장면 ${index + 1} 비주얼`} className="max-h-56" src={`${endpoint}/${sentence.sentenceId}?planFingerprint=${encodeURIComponent(view.plan.fingerprint)}`} />}
      </div>}
    </div>)}
    <div className="flex flex-wrap gap-4 text-sm"><button type="button" disabled={!editable || !view?.source || !prompts.length || prompts.some(p => !p.visualPrompt.trim())} onClick={() => void mutate("save")}>계획 저장</button><button type="button" disabled={!editable || dirty || !view?.plan || !view.source || !selectedSourceMatches || view.gateState === "stale"} onClick={() => void mutate("approve")}>현재 계획 승인</button><button type="button" disabled={!editable || dirty || !selectedSourceMatches || view?.gateState !== "approved"} onClick={() => void mutate("handoff")}>Astra 요청문 만들기</button></div>
    {handoffText && <label className="block text-sm">Astra에 전달할 JSON<textarea readOnly value={handoffText} className="mt-1 block h-48 w-full rounded border bg-[var(--bg)] p-2" /><button type="button" onClick={() => void navigator.clipboard.writeText(handoffText).then(() => setMessage("Astra 요청문을 복사했습니다.")).catch(() => setMessage("클립보드에 복사하지 못했습니다. JSON을 직접 선택해 복사해주세요."))}>JSON 복사</button></label>}
    {view?.uploads?.complete && selectedSourceMatches && !dirty && <p className="text-sm">모든 장면의 이미지가 준비되었습니다. 영상 렌더 연결은 S5에서 진행합니다.</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
