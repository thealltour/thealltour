"use client";
import { useEffect, useRef, useState } from "react";
import type { InstagramAdaptation, InstagramCardCopy } from "@/lib/marketing/publishable/narrationInstagram/contracts";
import type { NarrationScenePlan } from "@/lib/marketing/publishable/narrationScenes/contracts";
type Scene = NarrationScenePlan["scenes"][number] & { imageReady: boolean; imageSha256: string | null };
type View = { adaptation: InstagramAdaptation | null; plan: NarrationScenePlan | null; planReady: boolean; scenes: Scene[];
  gateState: string; canEdit: boolean; rendered: { cards: Array<{ cardId: string }> } | null; renderError: string | null };
const FIELDS = [{ key: "kicker", label: "키커", limit: 40 }, { key: "headline", label: "헤드라인", limit: 80 },
  { key: "body", label: "본문", limit: 400 }, { key: "microcopy", label: "마이크로카피", limit: 120 }] as const;
export function MarketingReviewNarrationInstagramPanel({ candidateId, refreshKey, onChanged }: { candidateId: string; refreshKey: number; onChanged: () => void }) {
  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration-instagram`;
  const [view, setView] = useState<View | null>(null);
  const [cards, setCards] = useState<InstagramCardCopy[]>([]);
  const [dirty, setDirty] = useState(false); const dirtyRef = useRef(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [handoff, setHandoff] = useState(""); const [resultText, setResultText] = useState("");
  function accept(next: View) {
    setView(next); setCards(next.adaptation?.cards.map(({ sceneId, kicker, headline, body, microcopy }) => ({ sceneId, kicker, headline, body, microcopy })) ?? []);
    dirtyRef.current = false; setDirty(false); setHandoff("");
  }
  async function fetchView(): Promise<View> { const response = await fetch(endpoint, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message); return data as View; }
  useEffect(() => {
    let cancelled = false;
    void fetchView().then(next => { if (!cancelled) { if (!dirtyRef.current) accept(next); else setMessage("장면 정보가 갱신되었습니다. 작성 중인 카드는 유지했습니다. 저장 충돌 시 다시 불러와주세요."); } }).catch(error => { if (!cancelled) setMessage(error instanceof Error ? error.message : "불러오기 실패"); });
    return () => { cancelled = true; };
    // Parent refresh must not discard ongoing copy edits or their original CAS baseline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, refreshKey]);
  function change(next: InstagramCardCopy[]) { setCards(next); dirtyRef.current = true; setDirty(true); setHandoff(""); }
  function toggle(sceneId: string) {
    if (!view) return;
    const selected = cards.some(c => c.sceneId === sceneId);
    const next = selected ? cards.filter(c => c.sceneId !== sceneId) : [...cards, { sceneId, kicker: null, headline: "", body: null, microcopy: null }];
    next.sort((a, b) => view.scenes.findIndex(s => s.sceneId === a.sceneId) - view.scenes.findIndex(s => s.sceneId === b.sceneId)); change(next);
  }
  async function mutate(action: "save" | "approve" | "handoff" | "import" | "render") {
    if (!view?.plan) return;
    if (action === "import" && dirty && !window.confirm("작성 중인 카드를 가져온 결과로 바꿀까요?")) return;
    setBusy(true); setMessage("");
    try {
      const body = { action, expectedRevision: view.adaptation?.revision ?? null, expectedFingerprint: view.adaptation?.fingerprint ?? null,
        expectedScenePlanFingerprint: view.plan.fingerprint, ...(action === "save" ? { cards } : {}), ...(action === "import" ? { result: JSON.parse(resultText) } : {}) };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      if (action !== "handoff") { accept(await fetchView()); onChanged(); }
      if (data.handoff) setHandoff(JSON.stringify(data.handoff, null, 2));
      if (action === "import") setResultText("");
      setMessage(action === "handoff" ? "ChatGPT용 카드 파생 JSON을 만들었습니다." : action === "render" ? "선택한 카드 전체를 렌더했습니다." : action === "approve" ? "현재 카드 구성을 승인했습니다." : "카드 구성을 저장했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "처리 실패"); } finally { setBusy(false); }
  }
  async function reload() { if (dirty && !window.confirm("작성 중인 카드를 버리고 저장본을 불러올까요?")) return; setBusy(true); try { accept(await fetchView()); setMessage(""); } catch (error) { setMessage(error instanceof Error ? error.message : "불러오기 실패"); } finally { setBusy(false); } }
  const editable = !!view?.canEdit && !!view.planReady && !busy;
  const selectionValid = cards.length >= 4 && cards.length <= 10 && cards.every(c => c.headline.trim() && view?.scenes.some(s => s.sceneId === c.sceneId && s.imageReady));
  return <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
    <h3 className="font-semibold">Narration에서 Instagram 카드 파생 · {cards.length}장 선택</h3>
    <p className="text-sm">4~10개 장면을 선택하세요. 카드마다 선택한 장면의 이미지 하나를 사용하며, 순서는 Narration을 따릅니다. 영상의 문장 수와 길이는 바꾸지 않습니다.</p>
    {!view?.planReady && <p className="text-sm">먼저 문장별 비주얼 계획을 승인하고 이미지를 준비해주세요.</p>}
    {view?.planReady && view.scenes.length < 4 && <p className="text-sm">현재 장면이 4개 미만이므로 이 계약으로 카드뉴스를 만들 수 없습니다. 카드 수를 맞추려고 Narration을 늘리지 않습니다.</p>}
    <p className="text-sm">상태: {dirty ? "저장 필요" : view?.gateState === "approved" ? "승인됨" : view?.gateState === "stale" ? "원문·장면·이미지 변경 · 재검토 필요" : "작성·검토 필요"}</p>
    {view?.scenes.map(scene => {
      const card = cards.find(c => c.sceneId === scene.sceneId);
      return <div key={scene.sceneId} className="space-y-2 rounded border border-[var(--border)] p-3">
        <label className="text-sm"><input type="checkbox" checked={!!card} disabled={!editable || (!card && (!scene.imageReady || cards.length >= 10))} onChange={() => toggle(scene.sceneId)} /> 장면 {scene.order + 1} · {scene.sentenceText} {!scene.imageReady ? "(이미지 필요)" : ""}</label>
        {card && <div className="space-y-2">
          <img alt={`선택한 장면 ${scene.order + 1}`} className="max-h-48 aspect-[4/5] object-cover" src={`/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration-scenes/${scene.visualId}?planFingerprint=${encodeURIComponent(view?.plan?.fingerprint ?? "")}`} />
          {FIELDS.map(field => <label key={field.key} className="block text-sm">{field.label} · {(card[field.key] ?? "").length}/{field.limit}<textarea value={card[field.key] ?? ""} maxLength={field.limit} disabled={!editable} className="mt-1 block w-full rounded border bg-[var(--bg)] p-2" onChange={e => change(cards.map(c => c.sceneId === scene.sceneId ? { ...c, [field.key]: field.key === "headline" ? e.target.value : e.target.value || null } : c))} /></label>)}
        </div>}
      </div>;
    })}
    {cards.some(card => !view?.scenes.some(scene => scene.sceneId === card.sceneId)) && <p className="text-sm">이전 카드에 현재 계획에 없는 장면이 있습니다. 새 구성으로 시작해주세요.</p>}
    <div className="flex flex-wrap gap-4 text-sm"><button type="button" disabled={!editable} onClick={() => { if (!cards.length || window.confirm("현재 선택과 문구를 비우고 새 구성으로 시작할까요?")) change([]); }}>선택·문구 비우기</button><button type="button" disabled={!editable || !selectionValid} onClick={() => void mutate("save")}>구성·문구 저장</button><button type="button" disabled={!editable || dirty || !view?.adaptation || view.gateState === "stale"} onClick={() => void mutate("approve")}>현재 구성 승인</button><button type="button" disabled={!editable || dirty || view?.gateState !== "approved"} onClick={() => void mutate("render")}>선택한 카드 렌더</button><button type="button" disabled={busy} onClick={() => void reload()}>저장본 다시 불러오기</button></div>
    <details className="space-y-2 text-sm"><summary>ChatGPT 카드 문구 작성·검토</summary><p>승인된 Narration·장면과 공통 원문을 전달합니다. 결과는 별도 파생 계약으로 저장합니다.</p><button type="button" disabled={!editable || dirty || (view?.scenes.length ?? 0) < 4} onClick={() => void mutate("handoff")}>ChatGPT용 JSON 만들기</button>
      {handoff && <><textarea readOnly value={handoff} className="block h-40 w-full rounded border bg-[var(--bg)] p-2" /><button type="button" onClick={() => void navigator.clipboard.writeText(handoff).then(() => setMessage("JSON을 복사했습니다.")).catch(() => setMessage("JSON을 직접 선택해 복사해주세요."))}>JSON 복사</button></>}
      <label className="block">결과 JSON<textarea value={resultText} disabled={busy} onChange={e => setResultText(e.target.value)} className="block h-32 w-full rounded border bg-[var(--bg)] p-2" /></label><button type="button" disabled={!editable || !resultText.trim()} onClick={() => void mutate("import")}>결과 가져오기</button>
    </details>
    {!dirty && view?.gateState === "approved" && view.rendered && <div className="grid grid-cols-2 gap-3">{view.rendered.cards.map(card => <a key={card.cardId} href={`${endpoint}/${card.cardId}?fingerprint=${encodeURIComponent(view.adaptation!.fingerprint)}`} target="_blank" rel="noreferrer"><img alt="렌더된 Instagram 카드" src={`${endpoint}/${card.cardId}?fingerprint=${encodeURIComponent(view.adaptation!.fingerprint)}`} /></a>)}</div>}
    {view?.renderError && <p className="text-sm">{view.renderError}</p>}{message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
