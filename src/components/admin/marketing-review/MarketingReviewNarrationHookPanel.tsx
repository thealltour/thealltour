"use client";
import { useEffect, useState } from "react";
import AdminButton from "@/components/admin/ui/AdminButton";
type Hook = { revision: number; fingerprint: string; text: string; enabled: boolean; sourceSentenceIds: string[]; durationMs: number };
type HookView = { hook: Hook | null; fresh: boolean; approved: boolean; reason: string | null; issue: string | null; displayIssue: string | null; firstSceneEndMs: number | null; canEdit: boolean;
  firstSentence: { sentenceId: string; text: string; fits: boolean } | null; sentences: { sentenceId: string; text: string }[] };
/** Same artifact and endpoint in Narration (authoring) and Shortform (display check). Manual authoring only; nothing here is AI-generated. */
export function MarketingReviewNarrationHookPanel({ candidateId, refreshKey = 0, onChanged }: { candidateId: string; refreshKey?: number; onChanged?: () => void }) {
  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration-hook`;
  const [view, setView] = useState<HookView | null>(null); const [text, setText] = useState(""); const [enabled, setEnabled] = useState(true); const [sources, setSources] = useState<string[]>([]);
  const [seconds, setSeconds] = useState("3.0"); const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  function accept(next: HookView) { setView(next); setText(next.hook?.text ?? ""); setEnabled(next.hook?.enabled ?? true); setSources(next.hook?.sourceSentenceIds ?? []);
    setSeconds(((next.hook?.durationMs ?? 3000) / 1000).toFixed(1)); setDirty(false); }
  useEffect(() => {
    let cancelled = false;
    void fetch(endpoint, { cache: "no-store" }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message); if (!cancelled) accept(data); })
      .catch(error => { if (!cancelled) setMessage(error instanceof Error ? error.message : "도입 문구를 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, [endpoint, refreshKey]);
  const durationMs = Math.round(Number(seconds) * 10) * 100; const durationValid = Number.isFinite(durationMs) && durationMs >= 1000 && durationMs <= 3000;
  async function run(action: "save" | "approve") {
    if (!view) return; setBusy(true); setMessage("");
    try {
      const body = action === "save" ? { action, expectedRevision: view.hook?.revision ?? null, expectedFingerprint: view.hook?.fingerprint ?? null, text: enabled ? text : "", enabled, sourceSentenceIds: enabled ? sources : [], durationMs }
        : { action, expectedRevision: view.hook!.revision, expectedFingerprint: view.hook!.fingerprint };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.message);
      accept(data); onChanged?.(); setMessage(action === "save" ? (data.approved ? "표시 시간을 저장했습니다. 문구 승인은 유지됩니다." : "저장했습니다. 검토 후 승인해주세요.") : enabled ? "핵심 발견 문구를 승인했습니다." : "‘사용하지 않음’을 승인했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "도입 문구 처리 실패"); } finally { setBusy(false); }
  }
  const editable = !!view?.canEdit && !busy && view.sentences.length > 0;
  const status = !view?.sentences.length ? "Narration을 먼저 승인해주세요." : dirty ? "저장하지 않은 변경이 있습니다." : view.approved ? (view.hook?.enabled ? (view.displayIssue ? "문구 승인됨 · 표시 시간 수정 필요" : "승인됨") : "사용하지 않음 · 승인됨") : view.reason ?? "검토 필요";
  return <div className="space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm">
    <h4 className="font-semibold">핵심 발견 문구 직접 작성</h4>
    <p>자동 생성하지 않습니다. 승인된 Narration에 있는 내용만으로 1~2줄을 직접 써주세요. 영상 첫 장면 상단에 48px(em 기준) 굵은 글씨로 표시되며, 문구를 고쳐도 음성·이미지·모션은 다시 만들지 않습니다.</p>
    <div className="flex flex-wrap gap-4">
      <label className="flex items-center gap-2"><input type="radio" name={`hook-${candidateId}`} checked={enabled} disabled={!editable} onChange={() => { setEnabled(true); setDirty(true); }} />문구 사용</label>
      <label className="flex items-center gap-2"><input type="radio" name={`hook-${candidateId}`} checked={!enabled} disabled={!editable} onChange={() => { setEnabled(false); setDirty(true); }} />사용하지 않음</label>
    </div>
    {enabled && <>
      <textarea aria-label="핵심 발견 문구" placeholder="직접 입력해주세요" value={text} maxLength={80} disabled={!editable} onChange={e => { setText(e.target.value); setDirty(true); }} className="block min-h-16 w-full rounded border bg-[var(--bg)] p-2" />
      {view?.firstSentence && <div className="flex flex-wrap items-center gap-2">
        <AdminButton variant="secondary" type="button" disabled={!editable} onClick={() => { setText(view.firstSentence!.text); setSources([view.firstSentence!.sentenceId]); setDirty(true); }}>첫 문장 가져오기</AdminButton>
        <span className="text-xs text-[var(--text-secondary)]">첫 문장을 그대로 붙여 넣습니다. 요약하지 않으니 필요하면 직접 줄여주세요.{!view.firstSentence.fits && " 지금 길이로는 상단 2줄을 넘습니다."}</span>
      </div>}
      {!!view?.sentences.length && <details open={!sources.length}><summary>근거 문장 선택 (필수)</summary>{view.sentences.map((s, i) => <label key={s.sentenceId} className="flex items-start gap-2"><input type="checkbox" disabled={!editable} checked={sources.includes(s.sentenceId)}
        onChange={e => { setSources(current => e.target.checked ? view.sentences.map(x => x.sentenceId).filter(id => id === s.sentenceId || current.includes(id)) : current.filter(id => id !== s.sentenceId)); setDirty(true); }} />{i + 1}. {s.text}</label>)}</details>}
      <label className="flex flex-wrap items-center gap-2">표시 시간(초)<input type="number" min={1} max={3} step={0.1} value={seconds} disabled={!editable} onChange={e => { setSeconds(e.target.value); setDirty(true); }} className="w-20 rounded border bg-[var(--bg)] p-1" />
        <span className="text-xs text-[var(--text-secondary)]">{view?.firstSceneEndMs ? `첫 장면 ${(view.firstSceneEndMs / 1000).toFixed(1)}초 안에 들어가야 합니다. 표시 시간만 바꾸면 문구 승인은 유지됩니다.` : "최신 음성이 준비되면 첫 장면 길이와 비교합니다."}</span></label>
      {view?.displayIssue && <p role="alert">{view.displayIssue}</p>}
    </>}
    <div className="flex flex-wrap gap-2">
      <AdminButton type="button" disabled={!editable || !durationValid || (enabled && (!text.trim() || !sources.length))} onClick={() => void run("save")}>저장</AdminButton>
      <AdminButton type="button" disabled={!editable || dirty || !view?.hook || !view.fresh || view.approved} onClick={() => void run("approve")}>{enabled ? "문구 승인" : "‘사용하지 않음’ 승인"}</AdminButton>
    </div>
    <p role="status">{message || status}</p>
  </div>;
}
