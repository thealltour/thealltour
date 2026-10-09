"use client";
import AdminButton from "@/components/admin/ui/AdminButton";
import { useEffect, useRef, useState } from "react";
import type { NarrationView } from "@/lib/marketing/publishable/narration/contracts";
import { MarketingReviewNarrationAudioPanel } from "./MarketingReviewNarrationAudioPanel";
import { MarketingReviewNarrationHookPanel } from "./MarketingReviewNarrationHookPanel";

type DraftSentence = { sentenceId: string | null; text: string; purpose: string | null };
type View = NarrationView & { source: { titleKo: string; bodyKo: string; limitationsKo: string[]; forbiddenClaimsKo: string[] } };
export function MarketingReviewNarrationPanel({ candidateId, refreshKey, onChanged }: { candidateId: string; refreshKey: number; onChanged: () => void }) {
  const [view, setView] = useState<View | null>(null);
  const [sentences, setSentences] = useState<DraftSentence[]>([]);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [handoffText, setHandoffText] = useState("");
  const [importRaw, setImportRaw] = useState("");
  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration`;
  function accept(next: View) {
    setView(next); setSentences(next.narration?.sentences.map(({ sentenceId, text, purpose }) => ({ sentenceId, text, purpose })) ?? [{ sentenceId: null, text: "", purpose: null }]); dirtyRef.current = false; setDirty(false);
  }
  useEffect(() => {
    let cancelled = false;
    void fetch(endpoint, { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "불러오기 실패");
      if (!cancelled) {
        // Keep unsaved sentences; retain their original CAS baseline so a later save rejects drift.
        if (!dirtyRef.current) accept(data as View);
        else setMessage("원문 정보가 갱신되었습니다. 작성 중인 문장은 유지했습니다. 저장 충돌 시 다시 불러와주세요.");
      }
    }).catch(error => { if (!cancelled) setMessage(error instanceof Error ? error.message : "불러오기 실패"); });
    return () => { cancelled = true; };
    // Refresh only on parent updates; typing must not trigger reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, refreshKey]);
  function change(next: DraftSentence[]) { setSentences(next); dirtyRef.current = true; setDirty(true); }
  async function submit(action: "save" | "approve") {
    if (!view) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action, expectedRevision: view.narration?.revision ?? null, expectedFingerprint: view.narration?.fingerprint ?? null,
        lineage: view.lineage, ...(action === "save" ? { sentences } : {}),
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "저장 실패");
      accept(data as View); onChanged(); setMessage(action === "save" ? "Narration을 저장했습니다." : "현재 Narration revision을 승인했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장 실패"); }
    finally { setBusy(false); }
  }
  const editable = !!view?.canEdit && !busy;
  async function exchange(action: "handoff" | "import") {
    if (!view || (action === "handoff" && dirty)) return;
    if (action === "import" && dirty && !window.confirm("작성 중인 문장을 ChatGPT 결과로 교체할까요?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(action === "import" ? { raw: importRaw } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "ChatGPT 결과 처리 실패");
      if (action === "handoff") {
        setHandoffText(data.text);
        try { await navigator.clipboard.writeText(data.text); setMessage("공통원문과 Research를 포함한 Narration handoff를 복사했습니다."); }
        catch { setMessage("자동 복사가 안 되면 아래 handoff JSON을 직접 복사해주세요."); }
      } else {
        accept(data as View); setImportRaw(""); setHandoffText(""); onChanged();
        setMessage("Narration 초안을 가져왔습니다. 문장을 검토한 후 승인해주세요.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "ChatGPT 결과 처리 실패"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
    <h3 className="font-semibold">Narration · {sentences.length}문장 {view?.narration ? `· v${view.narration.revision}` : ""}</h3>
    <p className="text-sm">상태: {dirty ? "저장 필요" : view?.gateState === "approved" ? "승인됨" : view?.gateState === "stale" ? "원문 변경 · 재검토 필요" : "작성·검토 필요"}. 문장 하나가 비주얼 하나와 장면 하나의 기준입니다. 영상 길이는 이후 실제 음성 길이로 결정합니다.</p>
    {view && <details><summary>승인된 공통 원문 확인</summary><div className="whitespace-pre-wrap text-sm"><strong>{view.source.titleKo}</strong><p>{view.source.bodyKo}</p><p>{view.source.limitationsKo.join("\n")}</p><p>{view.source.forbiddenClaimsKo.join("\n")}</p></div></details>}
    <div className="space-y-3 rounded border border-[var(--border)] p-3">
      <h4 className="font-medium">ChatGPT로 Narration 작성</h4>
      <p className="text-sm">승인된 공통원문과 최신 Research 검증을 함께 넘깁니다. 결과는 초안으로 가져오며 승인 전에 문장별로 검토합니다.</p>
      <AdminButton variant="secondary" type="button" disabled={!editable || dirty} onClick={() => void exchange("handoff")}>Narration handoff 복사</AdminButton>
      {dirty && <p className="text-sm">작성 중인 문장을 먼저 저장한 뒤 handoff를 복사해주세요.</p>}
      {handoffText && <details open><summary>handoff JSON · 직접 복사</summary><textarea readOnly value={handoffText} aria-label="Narration handoff JSON" className="mt-2 min-h-40 w-full rounded border bg-[var(--bg)] p-2 text-xs" /></details>}
      <label className="block text-sm">ChatGPT Narration 결과 JSON<textarea value={importRaw} maxLength={500_000} disabled={!editable} onChange={event => setImportRaw(event.target.value)} placeholder='{"contract":"narration-chatgpt-result-v1", ...}' className="mt-2 min-h-32 w-full rounded border bg-[var(--bg)] p-2 text-xs" /></label>
      <AdminButton variant="primary" type="button" disabled={!editable || !importRaw.trim()} onClick={() => void exchange("import")}>Narration 결과 가져오기</AdminButton>
    </div>
    {sentences.map((sentence, index) => <div key={sentence.sentenceId ?? `new-${index}`} className="space-y-2 rounded border border-[var(--border)] p-3">
      <label className="block text-sm">문장 {index + 1}<textarea value={sentence.text} disabled={!editable} className="mt-1 block min-h-20 w-full rounded border p-2 text-[var(--text-primary)] bg-[var(--bg)]" onChange={event => change(sentences.map((s, i) => i === index ? { ...s, text: event.target.value } : s))} /></label>
      <label className="block text-sm">목적 (선택)<input value={sentence.purpose ?? ""} disabled={!editable} className="ml-2 rounded border bg-[var(--bg)] p-1" onChange={event => change(sentences.map((s, i) => i === index ? { ...s, purpose: event.target.value || null } : s))} /></label>
      <div className="flex gap-3 text-sm"><AdminButton variant="secondary" type="button" disabled={!editable || index === 0} onClick={() => { const next = [...sentences]; [next[index - 1], next[index]] = [next[index]!, next[index - 1]!]; change(next); }}>위로</AdminButton><AdminButton variant="secondary" type="button" disabled={!editable || index === sentences.length - 1} onClick={() => { const next = [...sentences]; [next[index + 1], next[index]] = [next[index]!, next[index + 1]!]; change(next); }}>아래로</AdminButton><AdminButton variant="secondary" type="button" disabled={!editable || sentences.length <= 1} onClick={() => change(sentences.filter((_, i) => i !== index))}>삭제</AdminButton></div>
    </div>)}
    <div className="flex flex-wrap gap-4 text-sm"><AdminButton variant="secondary" type="button" disabled={!editable || sentences.length >= 16} onClick={() => change([...sentences, { sentenceId: null, text: "", purpose: null }])}>문장 추가</AdminButton><AdminButton variant="primary" type="button" disabled={!editable || !sentences.length || sentences.some(s => !s.text.trim())} onClick={() => void submit("save")}>저장</AdminButton><AdminButton variant="primary" type="button" disabled={!editable || dirty || !view?.narration || view.gateState === "stale"} onClick={() => void submit("approve")}>현재 revision 승인</AdminButton><AdminButton variant="secondary" type="button" disabled={busy} onClick={async () => { if (dirty && !window.confirm("작성 중인 문장을 버리고 저장본을 불러올까요?")) return; try { const response = await fetch(endpoint, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message); accept(data as View); setMessage(""); } catch (error) { setMessage(error instanceof Error ? error.message : "불러오기 실패"); } }}>저장본 다시 불러오기</AdminButton></div>
    <p className="text-sm">승인 후 음성을 생성하고, 다음 단계에서 문장별 비주얼을 연결합니다.</p>
    {view && <MarketingReviewNarrationAudioPanel key={view.narration?.fingerprint ?? "missing"} candidateId={candidateId} view={view} dirty={dirty} />}
    {view?.gateState === "approved" && !dirty && <MarketingReviewNarrationHookPanel key={`hook-${view.narration?.fingerprint ?? "missing"}`} candidateId={candidateId} />}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
