"use client";
import { useEffect, useRef, useState } from "react";
import type { NarrationView } from "@/lib/marketing/publishable/narration/contracts";
import { MarketingReviewNarrationAudioPanel } from "./MarketingReviewNarrationAudioPanel";

type DraftSentence = { sentenceId: string | null; text: string; purpose: string | null };
type View = NarrationView & { source: { titleKo: string; bodyKo: string; limitationsKo: string[]; forbiddenClaimsKo: string[] } };
export function MarketingReviewNarrationPanel({ candidateId, refreshKey, onChanged }: { candidateId: string; refreshKey: number; onChanged: () => void }) {
  const [view, setView] = useState<View | null>(null);
  const [sentences, setSentences] = useState<DraftSentence[]>([]);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
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
  return <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
    <h3 className="font-semibold">Narration · {sentences.length}문장 {view?.narration ? `· v${view.narration.revision}` : ""}</h3>
    <p className="text-sm">상태: {dirty ? "저장 필요" : view?.gateState === "approved" ? "승인됨" : view?.gateState === "stale" ? "원문 변경 · 재검토 필요" : "작성·검토 필요"}. 문장 하나가 비주얼 하나와 장면 하나의 기준입니다. 영상 길이는 이후 실제 음성 길이로 결정합니다.</p>
    {view && <details><summary>승인된 공통 원문 확인</summary><div className="whitespace-pre-wrap text-sm"><strong>{view.source.titleKo}</strong><p>{view.source.bodyKo}</p><p>{view.source.limitationsKo.join("\n")}</p><p>{view.source.forbiddenClaimsKo.join("\n")}</p></div></details>}
    {sentences.map((sentence, index) => <div key={sentence.sentenceId ?? `new-${index}`} className="space-y-2 rounded border border-[var(--border)] p-3">
      <label className="block text-sm">문장 {index + 1}<textarea value={sentence.text} disabled={!editable} className="mt-1 block min-h-20 w-full rounded border p-2 text-[var(--text-primary)] bg-[var(--bg)]" onChange={event => change(sentences.map((s, i) => i === index ? { ...s, text: event.target.value } : s))} /></label>
      <label className="block text-sm">목적 (선택)<input value={sentence.purpose ?? ""} disabled={!editable} className="ml-2 rounded border bg-[var(--bg)] p-1" onChange={event => change(sentences.map((s, i) => i === index ? { ...s, purpose: event.target.value || null } : s))} /></label>
      <div className="flex gap-3 text-sm"><button type="button" disabled={!editable || index === 0} onClick={() => { const next = [...sentences]; [next[index - 1], next[index]] = [next[index]!, next[index - 1]!]; change(next); }}>위로</button><button type="button" disabled={!editable || index === sentences.length - 1} onClick={() => { const next = [...sentences]; [next[index + 1], next[index]] = [next[index]!, next[index + 1]!]; change(next); }}>아래로</button><button type="button" disabled={!editable || sentences.length <= 1} onClick={() => change(sentences.filter((_, i) => i !== index))}>삭제</button></div>
    </div>)}
    <div className="flex flex-wrap gap-4 text-sm"><button type="button" disabled={!editable || sentences.length >= 16} onClick={() => change([...sentences, { sentenceId: null, text: "", purpose: null }])}>문장 추가</button><button type="button" disabled={!editable || !sentences.length || sentences.some(s => !s.text.trim())} onClick={() => void submit("save")}>저장</button><button type="button" disabled={!editable || dirty || !view?.narration || view.gateState === "stale"} onClick={() => void submit("approve")}>현재 revision 승인</button><button type="button" disabled={busy} onClick={async () => { if (dirty && !window.confirm("작성 중인 문장을 버리고 저장본을 불러올까요?")) return; try { const response = await fetch(endpoint, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message); accept(data as View); setMessage(""); } catch (error) { setMessage(error instanceof Error ? error.message : "불러오기 실패"); } }}>저장본 다시 불러오기</button></div>
    <p className="text-sm">기존 카드뉴스 생성은 유지합니다. 문장별 비주얼 연결은 다음 단계에서 진행합니다.</p>
    {view && <MarketingReviewNarrationAudioPanel key={view.narration?.fingerprint ?? "missing"} candidateId={candidateId} view={view} dirty={dirty} />}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
