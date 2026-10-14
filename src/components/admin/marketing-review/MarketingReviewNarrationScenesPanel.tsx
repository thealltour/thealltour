"use client";
import { formatAstraImageRequest } from "@/lib/marketing/publishable/narrationScenes/formatImageRequest";
import { NarrationSceneImageUpload } from "./NarrationSceneImageUpload";
import AdminButton from "@/components/admin/ui/AdminButton";
import { MarketingReviewNarrationMotionPanel } from "./MarketingReviewNarrationMotionPanel";
import { NarrationStockPlanBar, NarrationStockSceneSource, useNarrationVisualSources } from "./NarrationStockSceneSource";
import { useEffect, useRef, useState } from "react";
import type { Narration } from "@/lib/marketing/publishable/narration/contracts";
import type { NarrationScenePlan, SceneHandoff } from "@/lib/marketing/publishable/narrationScenes/contracts";
type View = { plan: NarrationScenePlan | null; canEdit: boolean; gateState: string; sourceError: string | null;
  source: { narration: Narration; timeline: { totalDurationMs: number }; source: { audioJobId: string } } | null;
  astraRequest?: { fingerprint: string; visuals: Array<{ visualId: string; imagePrompt: string; expectedFilename: string }> } | null; astraResult?: { visuals: Array<{ visualId: string; imagePrompt: string; expectedFilename: string }> } | null;
  handoff: SceneHandoff | null; uploads: { complete: boolean; slots: Array<{ visualId: string; ready: boolean; asset?: { sha256: string; width: number; height: number; uploadedAt: string } | null }> } | null };
export function MarketingReviewNarrationScenesPanel({ candidateId, refreshKey, onChanged }: { candidateId: string; refreshKey: number; onChanged: () => void }) {
  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration-scenes`;
  const [view, setView] = useState<View | null>(null);
  const [audioJobId, setAudioJobId] = useState("");
  const [prompts, setPrompts] = useState<Array<{ sentenceId: string; visualPrompt: string }>>([]);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [astraInput, setAstraInput] = useState("");
  const [handoffText, setHandoffText] = useState("");
  const visualSources = useNarrationVisualSources(candidateId, refreshKey, onChanged);
  function accept(next: View) {
    setView(next); dirtyRef.current = false; setDirty(false); setHandoffText(next.astraRequest ? formatAstraImageRequest(next.astraRequest) : "");
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
  async function load(latest = false) {
    if (dirty && !window.confirm("작성 중인 계획을 버리고 다시 불러올까요?")) return;
    setBusy(true); try { accept(await fetchView(latest ? undefined : audioJobId.trim())); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "불러오기 실패"); } finally { setBusy(false); }
  }
  async function mutate(action: "save" | "approve" | "generate" | "write-handoff") {
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
      if (data.astraRequest) setHandoffText(formatAstraImageRequest(data.astraRequest));
      setMessage(action === "write-handoff" ? "Astra 이미지 생성 요청문을 만들었습니다. 아래 일반 요청문을 복사해 Astra에 전달하고, 생성된 이미지를 슬롯에 업로드해주세요." : action === "approve" ? "현재 장면 계획을 승인했습니다." : action === "generate" ? "Hermes가 비주얼 계획 초안을 저장했습니다. 문장별로 검토·수정하고 승인해주세요." : "장면 계획을 저장했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "처리 실패"); } finally { setBusy(false); }
  }
  async function importAstra() {
    if (!view?.plan) return;
    setBusy(true); setMessage("");
    try {
      const payload = JSON.parse(astraInput);
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import-astra", planFingerprint: view.plan.fingerprint, payload }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      accept(await fetchView()); setAstraInput(""); onChanged(); setMessage("Astra 결과를 가져왔습니다. 이미지 파일을 해당 슬롯에 업로드해주세요.");
    } catch (error) { setMessage(error instanceof SyntaxError ? "올바른 JSON을 붙여넣어주세요." : error instanceof Error ? error.message : "결과 인입 실패"); }
    finally { setBusy(false); }
  }
  async function upload(visualId: string, file: File, fit: boolean) {
    if (!view?.plan || !view.handoff || busy) throw new Error("최신 계획과 Astra 요청문을 먼저 확인해주세요.");
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set("file", file); form.set("visualId", visualId);
      form.set("planFingerprint", view.plan.fingerprint); form.set("handoffFingerprint", view.handoff.fingerprint);
      if (fit) form.set("fit", "contain");
      const response = await fetch(endpoint, { method: "POST", body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message ?? `이미지 업로드 실패 (HTTP ${response.status}). 파일 용량과 형식을 확인해주세요.`);
      accept(await fetchView()); onChanged(); setMessage("장면 이미지를 업로드했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "업로드 실패"); throw error; } finally { setBusy(false); }
  }
  const editable = !!view?.canEdit && !busy;
  const selectedSourceMatches = !view?.plan || view.plan.source.audioJobId === view.source?.source.audioJobId;
  return <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
    <h3 className="font-semibold">공유 비주얼 · Narration 기준 · {prompts.length}장면</h3>
    <p className="text-sm">승인된 문장마다 비주얼 계획 하나와 9:16 이미지 하나를 연결합니다. Hermes Shared Visual Planner가 계획 초안을 작성하고, 승인 후 Astra Handoff Writer가 이미지 생성 요청문을 만듭니다. 같은 원본 비주얼을 숏폼과 Instagram 카드뉴스에 사용합니다. 숏폼에서는 문장별로 이미지 모션 대신 스톡 영상을 고를 수 있으며, 이 경우에도 이미지는 Instagram용으로 유지합니다.</p>
    <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--text-secondary)]"><li>최신 음성을 불러온 뒤, Hermes로 비주얼 계획 초안을 생성합니다. 필요하면 각 문장의 계획을 직접 수정합니다.</li><li>모든 계획을 저장하고 검토한 뒤 승인합니다.</li><li>Astra Handoff Writer로 이미지 생성 요청문을 만들고 복사해 전달합니다. Astra는 승인된 계획에 맞춰 이미지를 생성합니다.</li><li>요청문을 받은 Astra가 생성한 이미지를 해당 문장 슬롯에 바로 업로드합니다. 결과 JSON 인입은 필요하지 않습니다.</li></ol>
    <div className="flex flex-wrap gap-2 text-sm"><AdminButton variant="secondary" type="button" disabled={busy} onClick={() => void load(true)}>최신 음성 불러오기</AdminButton><label>음성 작업 ID (직접 지정) <input value={audioJobId} disabled={busy} onChange={e => setAudioJobId(e.target.value)} className="rounded border bg-[var(--bg)] p-1" /></label><AdminButton variant="secondary" type="button" disabled={busy} onClick={() => void load()}>지정한 음성·계획 불러오기</AdminButton></div>
    <AdminButton type="button" disabled={!editable || !view?.source} onClick={() => { if (!dirty || window.confirm("수정 중인 계획 대신 Hermes 초안을 새로 생성할까요?")) void mutate("generate"); }}>{busy ? "처리 중…" : "Hermes 비주얼 계획 초안 생성"}</AdminButton>
    <p className="text-sm">상태: {dirty ? "저장 필요" : view?.gateState === "approved" ? "승인됨" : view?.gateState === "stale" ? "변경 감지 · 재검토 필요" : "작성·검토 필요"}{view?.source ? ` · ${(view.source.timeline.totalDurationMs / 1000).toFixed(2)}초` : ""}</p>
    {view?.uploads && <p className="text-sm" role="status">이미지 업로드 완료: {view.uploads.slots.filter(slot => slot.ready).length} / {view.uploads.slots.length}장면</p>}
    {view?.sourceError && <p className="text-sm">{view.sourceError}</p>}
    {view?.plan?.approval && view.gateState === "approved" && selectedSourceMatches && !dirty && <NarrationStockPlanBar state={visualSources} />}
    {view?.source?.narration.sentences.map((sentence, index) => <div key={sentence.sentenceId} className="space-y-2 rounded border border-[var(--border)] p-3">
      <p className="text-sm">{index + 1}. {sentence.text}</p>
      <label className="block text-sm">비주얼 계획 · 검토·수정<textarea placeholder="이 문장에서 보여줄 장소·피사체·행동·구도·분위기를 적어주세요. 세로 9:16, 자막용 글자는 이미지에 넣지 않습니다." value={prompts[index]?.visualPrompt ?? ""} disabled={!editable} className="mt-1 block min-h-24 w-full rounded border bg-[var(--bg)] p-2" onChange={e => { setPrompts(previous => previous.map((p, i) => i === index ? { ...p, visualPrompt: e.target.value } : p)); dirtyRef.current = true; setDirty(true); setHandoffText(""); }} /></label>
      {view?.plan?.approval && view.gateState === "approved" && selectedSourceMatches && !dirty && <div className="space-y-2 text-sm">
        {!view.handoff && <p>Astra 이미지 생성 요청문을 만든 후, 그 요청문으로 생성한 이미지를 업로드해주세요.</p>}
        <NarrationSceneImageUpload key={`${view.plan.fingerprint}:${sentence.sentenceId}`} index={index} disabled={!editable || !view.handoff}
          slot={view.uploads?.slots.find(s => s.visualId === sentence.sentenceId) ?? null}
          previewUrl={`${endpoint}/${sentence.sentenceId}?planFingerprint=${encodeURIComponent(view.plan.fingerprint)}&image=${view.uploads?.slots.find(s => s.visualId === sentence.sentenceId)?.asset?.sha256 ?? ""}`}
          onUpload={(file, fit) => upload(sentence.sentenceId, file, fit)} />
        <NarrationStockSceneSource sentenceId={sentence.sentenceId} state={visualSources} />
      </div>}
    </div>)}
    <div className="flex flex-wrap gap-4 text-sm"><AdminButton variant="primary" type="button" disabled={!editable || !view?.source || !prompts.length || prompts.some(p => !p.visualPrompt.trim())} onClick={() => void mutate("save")}>1. 계획 저장</AdminButton><AdminButton variant="primary" type="button" disabled={!editable || dirty || !view?.plan || !view.source || !selectedSourceMatches || view.gateState === "stale"} onClick={() => void mutate("approve")}>2. 계획 검토·승인</AdminButton><AdminButton variant="secondary" type="button" disabled={!editable || dirty || !selectedSourceMatches || view?.gateState !== "approved"} onClick={() => void mutate("write-handoff")}>3. Astra 이미지 생성 요청문 만들기</AdminButton></div>
    {view?.gateState !== "approved" || dirty || !selectedSourceMatches ? <p className="text-sm text-[var(--text-secondary)]">Astra 요청문은 이미지 생성용입니다. {!view?.source ? "최신 완료 음성을 먼저 불러오세요." : dirty || !view?.plan ? "모든 문장의 비주얼 계획을 작성·저장하고 승인하면 버튼이 활성화됩니다." : !selectedSourceMatches || view.gateState === "stale" ? "변경된 음성에 맞춰 계획을 저장하고 다시 승인해주세요." : "저장된 계획을 검토하고 승인하면 버튼이 활성화됩니다."}</p> : null}
    {handoffText && <label className="block text-sm">Astra에 전달할 이미지 생성 요청문<textarea readOnly value={handoffText} className="mt-1 block h-48 w-full rounded border bg-[var(--bg)] p-2" /><AdminButton variant="secondary" type="button" onClick={() => void navigator.clipboard.writeText(handoffText).then(() => setMessage("Astra 요청문을 복사했습니다.")).catch(() => setMessage("클립보드에 복사하지 못했습니다. 요청문을 직접 선택해 복사해주세요."))}>이미지 생성 요청문 복사</AdminButton></label>}
    {view?.astraRequest && !dirty && view.gateState === "approved" && <div className="space-y-2 text-sm">
      <p>한 장씩 생성하려면 아래 장면별 요청문을 복사해주세요.</p>
      {view.astraRequest.visuals.map((visual, index) => <details key={visual.visualId} className="rounded border border-[var(--border)] p-2"><summary className="cursor-pointer">장면 {index + 1} 이미지 생성 요청문</summary><p className="my-2 whitespace-pre-wrap">{visual.imagePrompt}</p><AdminButton variant="secondary" type="button" onClick={() => void navigator.clipboard.writeText(formatAstraImageRequest({ visuals: [visual] })).then(() => setMessage(`장면 ${index + 1} 이미지 생성 요청문을 복사했습니다.`)).catch(() => setMessage("클립보드에 복사하지 못했습니다."))}>이 장면 요청문 복사</AdminButton></details>)}
    </div>}
    {view?.astraRequest && !dirty && view.gateState === "approved" && <details className="space-y-2 rounded border border-[var(--border)] p-3 text-sm">
      <summary className="cursor-pointer font-semibold">고급 · 기존 Astra 결과 JSON 인입 (선택)</summary><p>일반 이미지 생성에는 이 기능이 필요하지 않습니다. 생성된 이미지를 각 슬롯에 바로 업로드하세요.</p>
      <p>요청문의 fingerprint를 requestFingerprint에 그대로 넣고, 각 visualId의 최종 imagePrompt와 expectedFilename을 반환받아 붙여넣으세요. 실제 이미지 파일은 별도로 슬롯에 업로드합니다.</p>
      <AdminButton variant="secondary" type="button" onClick={() => void navigator.clipboard.writeText(JSON.stringify({ contract: "narration-astra-result-v1", candidateId, requestFingerprint: view.astraRequest!.fingerprint, visuals: view.astraRequest!.visuals }, null, 2)).then(() => setMessage("Astra 결과 템플릿을 복사했습니다.")).catch(() => setMessage("복사에 실패했습니다. 요청문의 fingerprint와 visuals를 사용해주세요."))}>결과 JSON 템플릿 복사</AdminButton>
      <textarea aria-label="Astra 결과 JSON" value={astraInput} onChange={e => setAstraInput(e.target.value)} disabled={!editable} className="block h-40 w-full rounded border bg-[var(--bg)] p-2" />
      <AdminButton type="button" disabled={!editable || !astraInput.trim()} onClick={() => void importAstra()}>검토한 Astra 결과 가져오기</AdminButton>
      {view.astraResult && <div><p>현재 요청의 결과를 가져왔습니다.</p>{view.astraResult.visuals.map(v => <details key={v.visualId}><summary>{v.expectedFilename}</summary><p className="whitespace-pre-wrap">{v.imagePrompt}</p></details>)}</div>}
    </details>}
    {view?.uploads?.complete && selectedSourceMatches && !dirty && <p className="text-sm">모든 장면의 이미지가 준비되었습니다. 아래에서 움직임을 생성하고 검토해주세요.</p>}
    {!dirty && selectedSourceMatches && <MarketingReviewNarrationMotionPanel candidateId={candidateId} refreshKey={refreshKey} onChanged={onChanged} />}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
