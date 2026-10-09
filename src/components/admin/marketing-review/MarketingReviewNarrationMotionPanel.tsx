"use client";
import { useEffect, useRef, useState } from "react";
import AdminButton from "@/components/admin/ui/AdminButton";
import type { MotionChoice } from "@/lib/marketing/publishable/narrationMotion/contracts";
type View = { ready: boolean; workerAvailable: boolean; settingsSaved: boolean; canEdit: boolean; planFingerprint: string | null; settingsFingerprint: string | null;
  scenes: Array<{ visualId: string; text: string; durationMs: number; imageReady: boolean; choice: MotionChoice;
    job: { jobId: string; status: string; approved: boolean; errorCode: string | null; output: { sha256: string } | null } | null }> };
const labels: Record<string, string> = { queued: "실행 대기", running: "생성 중", completed: "검토 필요", failed: "실패 · 다시 생성 가능", stale: "변경 감지 · 재생성 필요" };
export function MarketingReviewNarrationMotionPanel({ candidateId, refreshKey, onChanged }: { candidateId: string; refreshKey: number; onChanged: () => void }) {
  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration-motion`;
  const [view, setView] = useState<View | null>(null); const [choices, setChoices] = useState<Array<{ visualId: string; choice: MotionChoice }>>([]);
  const [dirty, setDirty] = useState(false); const dirtyRef = useRef(false); const baselineRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { dirtyRef.current = false; baselineRef.current = null; setDirty(false); setChoices([]); setView(null); setMessage(""); }, [candidateId]);
  function accept(data: View, reset = false) {
    setView(data);
    if (!dirtyRef.current || reset) { setChoices(data.scenes.map(s => ({ visualId: s.visualId, choice: s.choice }))); baselineRef.current = data.settingsFingerprint; dirtyRef.current = false; setDirty(false); }
  }
  async function fetchView() { const response = await fetch(endpoint, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message); return data as View; }
  useEffect(() => {
    let cancelled = false;
    void fetchView().then(data => { if (!cancelled) accept(data); }).catch(error => { if (!cancelled) setMessage(error instanceof Error ? error.message : "모션 상태를 확인하지 못했습니다."); });
    return () => { cancelled = true; };
    // Preserve unsaved choices and their concurrency baseline on parent refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, refreshKey]);
  const active = !!view?.scenes.some(s => s.job?.status === "queued" || s.job?.status === "running");
  useEffect(() => {
    if (!active || busy) return;
    let cancelled = false; const timer = setTimeout(() => {
      void fetchView().then(data => { if (!cancelled) accept(data); }).catch(() => { if (!cancelled) setMessage("작업 상태를 확인하지 못했습니다. 상태 새로고침을 눌러주세요."); });
    }, 3000);
    return () => { cancelled = true; clearTimeout(timer); };
    // The latest view schedules the next poll; stop after terminal states or unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, active, busy, view]);
  function update(visualId: string, value: Partial<MotionChoice>) {
    setChoices(old => old.map(s => s.visualId === visualId ? { ...s, choice: { ...s.choice, ...value } } : s)); dirtyRef.current = true; setDirty(true);
  }
  async function mutate(action: "save" | "generate" | "approve", visualId?: string) {
    if (!view?.planFingerprint) return;
    setBusy(true); setMessage("");
    try {
      const selected = view.scenes.filter(s => !visualId || s.visualId === visualId);
      const body = { action, expectedPlanFingerprint: view.planFingerprint, expectedSettingsFingerprint: action === "save" ? baselineRef.current : view.settingsFingerprint,
        ...(action === "save" ? { scenes: choices } : action === "generate" ? { visualIds: selected.filter(s => s.imageReady).map(s => s.visualId) } :
          { jobs: selected.map(s => ({ jobId: s.job?.jobId, expectedOutputSha256: s.job?.output?.sha256 })) }) };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      accept(data as View, true); onChanged();
      setMessage(action === "save" ? "움직임 설정을 저장했습니다." : action === "generate" ? "모션 작업을 요청했습니다. 미니 PC 실행기가 순서대로 생성합니다." : "검토한 모션 결과를 승인했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "처리 실패"); } finally { setBusy(false); }
  }
  const editable = !!view?.ready && !!view.canEdit && !busy;
  const saved = !dirty && !!view?.settingsFingerprint && !!view.settingsSaved;
  const allComplete = !!view?.scenes.length && view.scenes.every(s => s.job?.status === "completed" && !!s.job.output);
  return <section className="space-y-4 rounded-lg border border-[var(--border)] p-4">
    <h3 className="font-semibold">문장별 이미지 움직임</h3>
    <p className="text-sm">이미지 한 장에서 움직임을 만들고, 실제 음성 길이에 맞춰 미리봅니다. 어색한 장면은 약하게 조정하거나 정지를 선택해주세요.</p>
    {!view?.ready && <p className="text-sm">최신 음성과 승인된 문장 비주얼 계획이 필요합니다.</p>}
    {view && !view.workerAvailable && <p className="text-sm">모션 실행기가 연결되지 않았습니다. 설정 저장은 가능하며 실행기 연결 후 영상을 생성할 수 있습니다.</p>}
    {view?.scenes.map((scene, i) => {
      const choice = choices.find(s => s.visualId === scene.visualId)?.choice ?? scene.choice;
      return <div key={scene.visualId} className="space-y-3 rounded border border-[var(--border)] p-3">
        <p className="text-sm">{i + 1}. {scene.text} · {(scene.durationMs / 1000).toFixed(2)}초</p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label>움직임 <select className="rounded border bg-[var(--bg)] p-2" disabled={!editable} value={choice.preset} onChange={e => update(scene.visualId, { preset: e.target.value as MotionChoice["preset"] })}>
            <option value="parallax">시점 이동</option><option value="pan_zoom">확대·이동</option><option value="light_shadow">빛·그림자 (실험)</option><option value="static">정지</option>
          </select></label>
          {(choice.preset === "parallax" || choice.preset === "light_shadow") && <label>강도 <select className="rounded border bg-[var(--bg)] p-2" disabled={!editable} value={choice.strength} onChange={e => update(scene.visualId, { strength: e.target.value as MotionChoice["strength"] })}><option value="low">약하게</option><option value="standard">표준</option></select></label>}
          <span>{!scene.imageReady ? "이미지 업로드 필요" : dirty ? "설정 저장 필요" : scene.job?.approved ? "승인됨" : scene.job ? labels[scene.job.status] ?? scene.job.status : "생성 필요"}</span>
        </div>
        {choice.preset === "light_shadow" && <p className="text-sm">원본 밝기를 부분적으로 바꾸는 효과입니다. 실제 광원을 재계산하지 않습니다.</p>}
        <div className="flex flex-wrap gap-2">
          <AdminButton type="button" variant="secondary" disabled={!editable || !saved || !view.workerAvailable || !scene.imageReady || scene.job?.status === "running" || scene.job?.status === "queued"} onClick={() => void mutate("generate", scene.visualId)}>{scene.job?.status === "failed" || scene.job?.status === "stale" ? "다시 생성" : "미리보기 생성"}</AdminButton>
          <AdminButton type="button" variant="primary" disabled={!editable || !saved || scene.job?.status !== "completed" || !scene.job.output || scene.job.approved} onClick={() => void mutate("approve", scene.visualId)}>이 장면 승인</AdminButton>
        </div>
        {!dirty && scene.job?.status === "completed" && scene.job.output && <div className="flex flex-wrap gap-3">
          <img className="max-h-72" alt={`장면 ${i + 1} 원본`} src={`/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration-scenes/${scene.visualId}?planFingerprint=${encodeURIComponent(view.planFingerprint ?? "")}`} />
          <video className="max-h-72" key={scene.job.jobId} controls preload="metadata" src={`${endpoint}/${scene.job.jobId}`} />
        </div>}
        {scene.job?.errorCode && <p className="text-sm">{scene.job.errorCode === "motion_bounds_exceeded" ? "움직임이 원본 가장자리를 벗어납니다. 약한 강도나 정지를 선택해주세요." : "생성하지 못했습니다. 연결 상태를 확인하거나 약한 강도·정지로 설정을 바꿔 다시 요청해주세요."}</p>}
      </div>;
    })}
    <div className="flex flex-wrap gap-2">
      <AdminButton type="button" variant="secondary" disabled={!editable || !choices.length} onClick={() => { const first = choices[0]; if (first) { setChoices(old => old.map(s => ({ ...s, choice: { ...first.choice } }))); dirtyRef.current = true; setDirty(true); } }}>첫 장면 설정을 전체에 적용</AdminButton>
      <AdminButton type="button" variant="primary" disabled={!editable || !choices.length} onClick={() => void mutate("save")}>움직임 설정 저장</AdminButton>
      <AdminButton type="button" variant="secondary" disabled={!editable || !saved || !view?.workerAvailable || !view.scenes.some(s => s.imageReady)} onClick={() => void mutate("generate")}>전체 미리보기 생성</AdminButton>
      <AdminButton type="button" variant="primary" disabled={!editable || !saved || !allComplete} onClick={() => void mutate("approve")}>현재 결과 전체 승인</AdminButton>
      <AdminButton type="button" variant="secondary" disabled={busy} onClick={() => { setBusy(true); void fetchView().then(data => accept(data)).catch(error => setMessage(error instanceof Error ? error.message : "상태 확인 실패")).finally(() => setBusy(false)); }}>상태 새로고침</AdminButton>
    </div>
    <p className="text-sm">모션 승인과 최종 숏폼 렌더는 별도 단계입니다. 이미지·음성 길이·설정 변경 시 관련 결과를 다시 검토해야 합니다.</p>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
