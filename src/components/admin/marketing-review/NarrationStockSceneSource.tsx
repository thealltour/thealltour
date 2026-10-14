"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import AdminButton from "@/components/admin/ui/AdminButton";
import { PLACE_SCOPES, SEARCH_STRATEGIES, stockSceneSearchPlanV2Schema, type RejectReason, type SceneSourceChoice, type SearchDiagnosis, type SearchStrategy, type StockProvider,
  type StockSceneSearchPlan, type StockSceneSearchPlanV2, type SupplementProposal } from "@/lib/marketing/publishable/narrationVisualSources/contracts";
import { emptySceneV2, isV2Scene, STRATEGY_LABEL, upgradeSceneToV2, type SceneRequirement } from "@/lib/marketing/publishable/narrationVisualSources/requirements";
import type { SceneSearchMetrics } from "@/lib/marketing/publishable/narrationVisualSources/metrics";
import type { QueryHistoryRevision } from "@/lib/marketing/publishable/narrationVisualSources/queryHistory";
import { AxesEditor, CandidateReviewControls, EXCLUSION_LABEL, NoSuitableToggle, PROVIDER_LABEL, QueryHistoryPanel, QueryRows, SceneSearchHistory, SceneSearchMetricsPanel, SupplementPanel } from "./NarrationStockSearchPanels";

type FacetStatus = "match" | "conflict" | "no_info" | "not_required";
type Facet = { status: FacetStatus; evidence: string[]; weak?: boolean };
export type Candidate = { provider: StockProvider; videoId: string; pageUrl: string; creatorName: string | null; creatorUrl: string | null; declaredDurationMs: number; posterUrl: string | null;
  preview: { width: number; height: number } | null; renderRendition: { fileKey: string; width: number; height: number; fps: number | null };
  fit: { scale: number; retainedArea: number; orientation: string }; sourceMetadata: { tags: string[]; pageSlug: string | null };
  placeEvidence: { field: "tags" | "page_url"; matchedText: string } | null; foundBy: Array<{ query: string; page: number; providerRank: number; strategy?: SearchStrategy | null }>;
  evidence: { basis: string; videoReviewed: false; describedBy: string[]; facets: { subject: Facet; action: Facet; context: Facet; place: Facet; exclusion: Facet }; genericOnly: string[];
    requiredMatched: string[]; preferredMatched: string[] } | null;
  priorityReason: string | null; review: { verdict: "shortlist" | "reject"; reason: RejectReason | null; note: string | null; decidedAt: string } | null };
type Clip = { jobId: string; status: string; errorCode: string | null; approved: boolean; startMs: number; provider: StockProvider; videoId: string;
  output: { sha256: string; frameCount: number; durationMs: number } | null; original: { sha256: string; width: number; height: number; durationMs: number; avgFrameRate: string; downloadedAt: string } | null;
  provenance: { pageUrl: string; creatorName: string | null; creatorUrl: string | null } };
export type AttemptSummary = { attemptId: string; sessionId: string; kind: "initial" | "supplement" | "next_page"; changeReason: string | null; startedAt: string;
  queries: Array<{ text: string; strategy: SearchStrategy | null; purpose: string | null }>; stoppedReason: "rate_limited" | null; notRunRequests: number;
  totals: { networkRequests: number; cacheHits: number; rawCount: number; duplicateCount: number; technicalPassCount: number; excludedByReason: Record<string, number> };
  requests: Array<{ provider: StockProvider; query: string; strategy: SearchStrategy | null; page: number; status: string; networkRequests: number; rawCount: number; duplicateCount: number; technicalPassCount: number }> };
export type StockScene = { visualId: string; sentenceId: string; order: number; text: string; frameCount: number | null; durationMs: number | null; choice: SceneSourceChoice;
  searchScene: StockSceneSearchPlan | null; requirement: SceneRequirement | null;
  search: { current: boolean; outcome: "candidates" | "no_suitable_candidate" | "search_failed" | "not_applicable"; searchedAt: string; sessionId: string | null; sessionStartedAt: string;
    sessionQueries: Array<{ text: string; strategy: SearchStrategy | null; purpose: string | null; batch: "initial" | "supplement" }> | null;
    shown: Candidate[]; rejected: Candidate[]; total: number; storedNotShown: number; canRevealMore: boolean; canFetchNextPage: boolean;
    attempts: Array<{ provider: StockProvider; query: string; page: number; status: string; rawCount: number; message: string | null }>; excludedSummary: Record<string, number>;
    supplement: { proposal: SupplementProposal | null; ran: boolean; available: boolean; diagnosis: SearchDiagnosis | null } } | null;
  attemptHistory: AttemptSummary[]; queryHistory: QueryHistoryRevision[]; noSuitable: { note: string | null; decidedAt: string } | null; metrics: SceneSearchMetrics | null;
  clip: Clip | null; motion: { imageReady: boolean; status: string | null; approved: boolean } | null };
export type StockView = { ready: boolean; canEdit: boolean; planFingerprint: string | null; searchPlan: { fingerprint: string; revision: number; origin: string; contract: string } | null;
  selection: { fingerprint: string | null; matchesPlan: boolean } | null; workerAvailable: boolean; providers: Record<StockProvider, boolean>; scenes: StockScene[]; notice?: string | null };

const OUTCOME_LABEL = { candidates: "후보 있음", no_suitable_candidate: "검색했지만 조건에 맞는 후보가 없습니다", search_failed: "검색 실패 (provider 오류·호출 제한·키 없음)", not_applicable: "스톡 검색 대상 아님" };
const CLIP_LABEL: Record<string, string> = { queued: "실행 대기", running: "다운로드·정규화 중", completed: "확인·승인 필요", failed: "실패", stale: "선택 또는 장면 길이 변경 · 다시 만들기 필요" };
const CLIP_ERROR: Record<string, string> = { source_too_short: "원본이 선택한 구간보다 짧습니다. 시작점을 앞당기거나 다른 후보를 고르세요. 반복·슬로모션·정지 프레임으로 늘리지 않습니다.",
  source_resolution_insufficient: "다운로드한 원본 해상도가 720×1280을 채우지 못합니다.", source_crop_excessive: "원본 비율 때문에 9:16 변환 시 너무 많이 잘립니다.",
  download_url_unavailable: "다운로드 주소를 갱신하지 못했습니다.", download_failed: "원본 다운로드에 실패했습니다.", source_unreadable: "원본 파일을 읽을 수 없습니다.",
  output_invalid: "정규화 결과가 렌더 규격(프레임 수·해상도·무음)과 다릅니다.", normalize_failed: "정규화에 실패했습니다." };
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}초`;
/** v1 scenes are shown in the v2 form for editing only; the stored v1 plan is unchanged until the reviewer saves. */
const editableScene = (scene: StockSceneSearchPlan | null, visualId: string): StockSceneSearchPlanV2 => !scene ? emptySceneV2(visualId) : isV2Scene(scene) ? scene : upgradeSceneToV2(scene);

/** Loaded once per scenes panel; only explicit button actions reach providers. */
export function useNarrationVisualSources(candidateId: string, refreshKey: number, onChanged: () => void) {
  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration-visual-sources`;
  const [view, setView] = useState<StockView | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<StockSceneSearchPlanV2[]>([]); const [dirty, setDirty] = useState<Record<string, boolean>>({}); const dirtyRef = useRef(false);
  const accept = useCallback((next: StockView, reset = false) => {
    setView(next);
    if (!dirtyRef.current || reset) { setDraft(next.scenes.map(s => editableScene(s.searchScene, s.visualId))); setDirty({}); dirtyRef.current = false; }
  }, []);
  const fetchView = useCallback(async () => { const response = await fetch(endpoint, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message); return data as StockView; }, [endpoint]);
  useEffect(() => {
    let cancelled = false;
    void fetchView().then(next => { if (!cancelled) accept(next); }).catch(error => { if (!cancelled) setMessage(error instanceof Error ? error.message : "스톡 영상 상태를 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, [fetchView, accept, refreshKey]);
  const active = !!view?.scenes.some(s => s.clip?.status === "queued" || s.clip?.status === "running");
  useEffect(() => {
    if (!active || busy) return;
    let cancelled = false; const timer = setTimeout(() => { void fetchView().then(next => { if (!cancelled) accept(next); }).catch(() => undefined); }, 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [active, busy, view, fetchView, accept]);
  async function mutate(body: Record<string, unknown>, done: string) {
    if (!view?.planFingerprint) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedPlanFingerprint: view.planFingerprint, ...body }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      accept(data as StockView, body.action === "save-search-plan" || body.action === "draft-search-plan"); onChanged();
      setMessage((data as StockView).notice ? `${done} ${(data as StockView).notice}` : done);
    } catch (error) { setMessage(error instanceof Error ? error.message : "처리 실패"); } finally { setBusy(false); }
  }
  function edit(visualId: string, patch: Partial<StockSceneSearchPlanV2>) {
    setDraft(old => old.map(s => s.visualId === visualId ? { ...s, ...patch } : s)); setDirty(old => ({ ...old, [visualId]: true })); dirtyRef.current = true;
  }
  return { view, busy, message, draft, dirty, edit, mutate, endpoint, refresh: () => { setBusy(true); void fetchView().then(next => accept(next)).catch(error => setMessage(error instanceof Error ? error.message : "상태 확인 실패")).finally(() => setBusy(false)); } };
}
export type VisualSourcesState = ReturnType<typeof useNarrationVisualSources>;

export function NarrationStockPlanBar({ state }: { state: VisualSourcesState }) {
  const { view, busy, mutate, draft, dirty } = state;
  if (!view?.ready) return null;
  const editable = view.canEdit && !busy; const anyDirty = Object.values(dirty).some(Boolean);
  const legacy = view.searchPlan?.contract === "narration-stock-search-plan-v1";
  return <div className="space-y-2 rounded border border-[var(--border)] p-3 text-sm">
    <p className="font-semibold">스톡 영상 (선택 사항)</p>
    <p>문장별로 Pexels·Pixabay 실제 영상을 대신 쓸 수 있습니다. 이미지는 그대로 유지되며, 화면을 열거나 렌더할 때는 검색하지 않습니다. 버튼을 누를 때만 검색합니다.
      {!view.providers.pexels && " Pexels 키가 설정되지 않았습니다."}{!view.providers.pixabay && " Pixabay 키가 설정되지 않았습니다."}</p>
    <p>검색 계획: {view.searchPlan ? `${view.searchPlan.revision}차 · ${view.searchPlan.origin === "hermes_draft" ? "Hermes 초안" : "사람이 수정"}${legacy ? " · 이전 형식" : ""}` : "없음"}{anyDirty ? " · 저장 필요" : ""}</p>
    {legacy && <p className="text-xs">이전 형식의 검색 계획입니다. 지금 결과로 검색·선택을 계속할 수 있습니다. 검색 전략, 지역, 완화 가능한 조건을 쓰려면 아래 조건을 확인한 뒤 새 형식으로 저장하세요. 저장하면 새 개정판이 만들어집니다. 기존 선택과 클립 승인은 그대로 유지되고, 검색은 새 조건으로 다시 해야 합니다.</p>}
    <div className="flex flex-wrap gap-2">
      <AdminButton type="button" variant="secondary" disabled={!editable} onClick={() => { if (!anyDirty || window.confirm("수정 중인 검색 조건 대신 Hermes 초안을 새로 만들까요?")) void mutate({ action: "draft-search-plan", expectedSearchPlanFingerprint: view.searchPlan?.fingerprint ?? null }, "Hermes 검색 계획 초안을 저장했습니다. 장면별 조건과 검색어를 검토해주세요."); }}>검색 계획 초안 만들기 (Hermes)</AdminButton>
      <AdminButton type="button" variant="primary" disabled={!editable || (!anyDirty && !!view.searchPlan && !legacy) || !draft.length} onClick={() => void mutate({ action: "save-search-plan", expectedSearchPlanFingerprint: view.searchPlan?.fingerprint ?? null, scenes: draft }, "검색 계획을 저장했습니다.")}>{legacy && !anyDirty ? "새 형식으로 저장 (전체 장면)" : "검색 조건 저장 (전체 장면)"}</AdminButton>
      <AdminButton type="button" variant="secondary" disabled={busy} onClick={state.refresh}>상태 새로고침</AdminButton>
    </div>
    {view.selection && !view.selection.matchesPlan && <p>스톡 선택이 이전 장면 계획 기준입니다. 스톡을 고른 장면은 구간 클립을 다시 만들거나 이미지 모션으로 바꿔야 최종 렌더가 가능합니다.</p>}
    {state.message && <p role="status">{state.message}</p>}
  </div>;
}

const lines = (value: string) => value.split("\n").map(v => v.trim()).filter(Boolean);
const PLACE_SCOPE_LABEL: Record<(typeof PLACE_SCOPES)[number], string> = { specific_place: "특정 장소 (그 가게·거리 자체)", city_region: "도시·지역 (그 지역 영상이면 됨)", any: "장소 무관" };
function SearchConditions({ scene, value, disabled, onEdit }: { scene: StockScene; value: StockSceneSearchPlanV2; disabled: boolean; onEdit: (patch: Partial<StockSceneSearchPlanV2>) => void }) {
  const issues = value.searchEnabled ? [...new Set((stockSceneSearchPlanV2Schema.safeParse(value).error?.issues ?? []).map(i => i.message))] : [];
  const area = (label: string, field: "required" | "preferred" | "exclude" | "relaxable" | "humanChecks") =>
    <label>{label}<textarea className="block w-full rounded border bg-[var(--bg)] p-1" value={value[field].join("\n")} disabled={disabled} onChange={e => onEdit({ [field]: lines(e.target.value) })} /></label>;
  return <div className="grid gap-2">
    <label className="flex items-center gap-2"><input type="checkbox" checked={value.searchEnabled} disabled={disabled} onChange={e => onEdit({ searchEnabled: e.target.checked })} />이 장면을 스톡 검색 대상으로 사용</label>
    <label>핵심 피사체<input className="block w-full rounded border bg-[var(--bg)] p-1" value={value.coreSubject} disabled={disabled} onChange={e => onEdit({ coreSubject: e.target.value })} /></label>
    <label>핵심 행동 (화면에서 실제로 보여야 할 것)<input className="block w-full rounded border bg-[var(--bg)] p-1" value={value.coreAction} disabled={disabled} onChange={e => onEdit({ coreAction: e.target.value })} /></label>
    <label>장소 요구<select className="block rounded border bg-[var(--bg)] p-1" value={value.place.scope} disabled={disabled}
      onChange={e => { const scope = e.target.value as StockSceneSearchPlanV2["place"]["scope"]; onEdit({ place: { scope, name: scope === "specific_place" ? value.place.name : null, region: scope === "any" ? null : value.place.region } }); }}>
      {PLACE_SCOPES.map(s => <option key={s} value={s}>{PLACE_SCOPE_LABEL[s]}</option>)}</select></label>
    {value.place.scope === "specific_place" && <label>장소명 (출처 페이지 표기 그대로, 영문)<input className="block w-full rounded border bg-[var(--bg)] p-1" value={value.place.name ?? ""} disabled={disabled} onChange={e => onEdit({ place: { ...value.place, name: e.target.value.trim() ? e.target.value : null } })} /></label>}
    {value.place.scope !== "any" && <label>{value.place.scope === "city_region" ? "도시·지역명 (영문, 검색어 하나 이상에 포함)" : "(선택) 도시·지역명 (영문, 넣으면 검색어 하나 이상에 포함)"}
      <input className="block w-full rounded border bg-[var(--bg)] p-1" value={value.place.region ?? ""} disabled={disabled} onChange={e => onEdit({ place: { ...value.place, region: e.target.value.trim() ? e.target.value : null } })} /></label>}
    {value.place.scope !== "specific_place" && <label>오인 위험 검토 (내레이션과 함께 특정 식당·장소로 오인될 수 있는지)<textarea className="block w-full rounded border bg-[var(--bg)] p-1" value={value.misattributionRisk} disabled={disabled} onChange={e => onEdit({ misattributionRisk: e.target.value })} /></label>}
    {area("반드시 유지할 조건 (줄마다 하나 · 결과가 적어도 자동으로 낮추지 않습니다)", "required")}
    {area("선호 조건 (줄마다 하나)", "preferred")}
    {area("제외 조건 (줄마다 하나 · provider 설명에 나오면 '제외 조건 언급'으로 표시)", "exclude")}
    {area("완화 가능한 조건 (줄마다 하나 · 보완 검색에서 뺄 수 있는 부가 조건만)", "relaxable")}
    <AxesEditor key={JSON.stringify(value.axes ?? null)} axes={value.axes} disabled={disabled} onChange={axes => onEdit({ axes })} />
    <div>영어 검색어 (최대 3개, 검색어마다 다른 전략 · 핵심 피사체를 앞에, 의미 축 2~3개만 조합 · Pexels 3~4단어, Pixabay 2~3단어 · 이미지 프롬프트를 넣지 않습니다)
      <QueryRows rows={value.queries} axes={value.axes} disabled={disabled} onChange={queries => onEdit({ queries })} /></div>
    {area("사람이 확인할 항목 (줄마다 하나)", "humanChecks")}
    {issues.length > 0 && <ul className="list-disc pl-5 text-xs">{issues.map(m => <li key={m}>{m}</li>)}</ul>}
    {scene.search && !scene.search.current && <p>검색 조건이 바뀌었습니다. 저장 후 다시 검색해주세요. 이전 결과는 참고용입니다.</p>}
  </div>;
}

const FACET_STATUS: Record<FacetStatus, string> = { match: "일치 근거", conflict: "충돌 근거", no_info: "정보 없음", not_required: "해당 없음" };
function ContentEvidence({ evidence }: { evidence: NonNullable<Candidate["evidence"]> }) {
  const row = (label: string, facet: Facet) => <li key={label}>{label}: {facet.status === "conflict" && label === "피사체" ? "다른 피사체 언급" : FACET_STATUS[facet.status]}{facet.evidence.length ? ` (${facet.evidence.join(", ")})` : ""}{facet.weak ? " · 일반 행동어라 순서에 반영하지 않음" : ""}</li>;
  return <div className="text-xs">
    <p>내용 근거: provider가 적은 {evidence.describedBy.length ? evidence.describedBy.map(f => f === "tags" ? "태그" : "제목(페이지 주소)").join("·") : "설명 없음"} 기준 · 실제 영상은 확인하지 않았습니다. 태그에 없다고 불일치는 아닙니다.</p>
    <ul className="list-disc pl-5">{row("피사체", evidence.facets.subject)}{row("행동", evidence.facets.action)}{row("맥락", evidence.facets.context)}{row("장소 표기", evidence.facets.place)}{row("제외 조건", evidence.facets.exclusion)}
      {evidence.genericOnly.length > 0 && <li>일반어 언급 (순서에 반영하지 않음): {evidence.genericOnly.join(", ")}</li>}
      {evidence.preferredMatched.length > 0 && <li>선호 조건 언급: {evidence.preferredMatched.join(", ")}</li>}</ul>
  </div>;
}
function CandidateCard({ candidate, index, scene, state, label }: { candidate: Candidate; index: number; scene: StockScene; state: VisualSourcesState; label?: string }) {
  const { view, busy, mutate, endpoint } = state; const sceneMs = scene.durationMs ?? 0;
  const maxStart = Math.max(0, candidate.declaredDurationMs - Math.ceil(sceneMs));
  const chosen = scene.choice.source === "stock_video" && scene.choice.provider === candidate.provider && scene.choice.videoId === candidate.videoId ? scene.choice : null;
  const [startMs, setStartMs] = useState(chosen?.startMs ?? 0); const [placeChecked, setPlaceChecked] = useState(false); const [showVideo, setShowVideo] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState(""); const [note, setNote] = useState("");
  const video = useRef<HTMLVideoElement | null>(null); const stopAt = useRef<number | null>(null);
  const specific = scene.requirement?.placeRequirement === "specific_place";
  const previewSrc = `${endpoint}/preview?${new URLSearchParams({ planFingerprint: view?.planFingerprint ?? "", visualId: scene.visualId, provider: candidate.provider, videoId: candidate.videoId })}`;
  function playRange() {
    const element = video.current; if (!element) return;
    element.currentTime = startMs / 1000; stopAt.current = (startMs + sceneMs) / 1000; void element.play();
  }
  const evidenceValid = /^https:\/\/\S+$/.test(evidenceUrl.trim());
  const placeReview = specific ? { placeRequirement: "specific_place", placeName: scene.requirement?.placeName, sourceChecked: placeChecked, evidenceUrl: evidenceValid ? evidenceUrl.trim() : null, note: note.trim() || null }
    : { placeRequirement: "generic_allowed", misattributionReviewed: placeChecked };
  return <div className="space-y-2 rounded border border-[var(--border)] p-2">
    <p className="font-medium">{label ?? `후보 ${index + 1}`} · {PROVIDER_LABEL[candidate.provider]} #{candidate.videoId}{chosen ? " · 현재 선택" : ""}{candidate.review?.verdict === "shortlist" ? " · 검토 후보" : ""}</p>
    <div className="flex flex-wrap gap-3">
      {candidate.posterUrl && <figure><img className="max-h-48" src={candidate.posterUrl} alt={`후보 ${index + 1} 포스터`} /><figcaption className="text-xs">포스터 이미지 (정지 화면, 영상 아님)</figcaption></figure>}
      {candidate.preview && (showVideo
        ? <figure><video ref={video} className="max-h-64" controls preload="metadata" src={previewSrc} onTimeUpdate={e => { if (stopAt.current !== null && e.currentTarget.currentTime >= stopAt.current) { e.currentTarget.pause(); stopAt.current = null; } }} />
          <figcaption className="text-xs">실제 영상 미리보기 · 저해상도 {candidate.preview.width}×{candidate.preview.height} (검토용, 렌더 파일 아님)</figcaption></figure>
        : <AdminButton type="button" variant="secondary" onClick={() => setShowVideo(true)}>실제 영상 미리보기 불러오기</AdminButton>)}
    </div>
    <ul className="list-disc pl-5">
      <li><a className="underline" href={candidate.pageUrl} target="_blank" rel="noreferrer">원본 페이지 열기</a> · 제작자 {candidate.creatorUrl ? <a className="underline" href={candidate.creatorUrl} target="_blank" rel="noreferrer">{candidate.creatorName ?? "확인 불가"}</a> : candidate.creatorName ?? "확인 불가"}</li>
      <li>렌더용 파일 {candidate.renderRendition.width}×{candidate.renderRendition.height}{candidate.renderRendition.fps ? ` · ${candidate.renderRendition.fps}fps` : ""} · 9:16 변환 후 원본 화면의 {Math.round(candidate.fit.retainedArea * 100)}% 사용 · 확대 없음</li>
      <li>길이 {seconds(candidate.declaredDurationMs)} (provider 표기, 초 단위) · 장면 길이 {seconds(sceneMs)}</li>
      {candidate.priorityReason && <li>표시 순서 이유: {candidate.priorityReason}</li>}
      <li>찾은 검색어: {candidate.foundBy.map(f => `“${f.query}”${f.strategy ? `(${STRATEGY_LABEL[f.strategy]})` : ""} ${f.page}쪽 ${f.providerRank}번째`).join(", ")}</li>
      {candidate.sourceMetadata.tags.length > 0 && <li>provider 태그: {candidate.sourceMetadata.tags.join(", ")}</li>}
      {specific && <li>{candidate.placeEvidence ? `provider 메타데이터의 장소 표기(${candidate.placeEvidence.field === "tags" ? "태그" : "페이지 주소"}): ${candidate.placeEvidence.matchedText} · 확인이 아니며 원본 출처에서 직접 확인해야 합니다.`
        : "장소 미확인: provider 메타데이터(태그·페이지 주소)에 장소명이 없습니다. 선택은 할 수 있으며, 확인하지 않으면 선택 기록에 '장소 확인 없음'으로 남습니다."}</li>}
    </ul>
    {candidate.evidence && <ContentEvidence evidence={candidate.evidence} />}
    <CandidateReviewControls candidate={candidate} scene={scene} state={state} />
    <label className="block">시작점 {seconds(startMs)} (구간 길이는 장면 길이 {seconds(sceneMs)}로 고정)
      <input type="range" className="block w-full" min={0} max={maxStart} step={100} value={Math.min(startMs, maxStart)} disabled={!view?.canEdit || busy} onChange={e => setStartMs(Number(e.target.value))} /></label>
    {candidate.declaredDurationMs < sceneMs && <p>원본이 장면보다 짧아 사용할 수 없습니다. 반복·슬로모션·정지 프레임으로 늘리지 않습니다.</p>}
    {showVideo && <AdminButton type="button" variant="secondary" onClick={playRange}>선택 구간 미리 재생</AdminButton>}
    {specific && <div className="grid gap-1">
      <label>(선택) 장소를 확인한 근거 URL (https)<input className="block w-full rounded border bg-[var(--bg)] p-1" value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} placeholder="원본 페이지 또는 장소를 확인한 출처 주소" /></label>
      {evidenceUrl.trim() && !evidenceValid && <p className="text-xs">https 주소만 기록됩니다.</p>}
      <label>(선택) 확인 메모<input className="block w-full rounded border bg-[var(--bg)] p-1" value={note} maxLength={300} onChange={e => setNote(e.target.value)} /></label>
    </div>}
    <label className="flex items-start gap-2"><input type="checkbox" checked={placeChecked} onChange={e => setPlaceChecked(e.target.checked)} />
      {specific ? "(선택) 원본 출처에서 이 영상이 해당 장소임을 직접 확인했습니다. 체크하고 근거 URL을 넣으면 장소 확인으로 기록됩니다." : "(선택) 내레이션과 함께 봐도 특정 식당·장소로 오인되지 않는 일반 장면인지 검토했습니다."}</label>
    <AdminButton type="button" variant="primary" disabled={!view?.canEdit || busy} onClick={() => void mutate({ action: "use-stock", expectedSelectionFingerprint: view?.selection?.fingerprint ?? null, visualId: scene.visualId,
      provider: candidate.provider, videoId: candidate.videoId, startMs: Math.min(startMs, maxStart), placeReview }, "이 후보로 구간 클립을 요청했습니다. 정규화된 클립을 확인한 뒤 승인해주세요.")}>이 후보로 구간 만들기</AdminButton>
  </div>;
}

/** The place requirement belongs to the selection; search-plan edits never change it. Updating it here needs a new clip and approval. */
function PlaceReviewUpdate({ scene, state }: { scene: StockScene; state: VisualSourcesState }) {
  const { view, busy, mutate } = state; const stock = scene.choice.source === "stock_video" ? scene.choice : null;
  const [requirement, setRequirement] = useState<"generic_allowed" | "specific_place">(stock?.placeReview.placeRequirement ?? "generic_allowed");
  const [placeName, setPlaceName] = useState(stock?.placeReview.placeRequirement === "specific_place" ? stock.placeReview.placeName : scene.requirement?.placeName ?? "");
  const [evidenceUrl, setEvidenceUrl] = useState(""); const [note, setNote] = useState(""); const [checked, setChecked] = useState(false);
  if (!stock || !view?.selection?.fingerprint) return null;
  const specific = requirement === "specific_place";
  const evidenceValid = /^https:\/\/\S+$/.test(evidenceUrl.trim());
  const ready = !specific || placeName.trim().length >= 2;
  const planned = scene.requirement;
  const planDiffers = !!planned && (planned.placeRequirement !== stock.placeReview.placeRequirement ||
    (planned.placeRequirement === "specific_place" && stock.placeReview.placeRequirement === "specific_place" && planned.placeName !== stock.placeReview.placeName));
  return <details className="text-xs"><summary className="cursor-pointer">선택의 장소 요구 갱신{planDiffers ? " · 현재 검색 계획과 다름" : ""}</summary>
    <div className="mt-1 grid gap-1">
      <p>선택에 적용된 장소 요구는 선택 당시 기록을 따릅니다. 검색 계획을 바꿔도 자동으로 바뀌지 않으며, 여기서 갱신하면 구간 클립을 다시 만들고 다시 승인해야 합니다.</p>
      <select className="rounded border bg-[var(--bg)] p-1" value={requirement} onChange={e => setRequirement(e.target.value as typeof requirement)}><option value="generic_allowed">일반 보조 장면</option><option value="specific_place">특정 장소</option></select>
      {specific && <>
        <input className="rounded border bg-[var(--bg)] p-1" value={placeName} onChange={e => setPlaceName(e.target.value)} placeholder="장소명 (영문)" />
        <input className="rounded border bg-[var(--bg)] p-1" value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} placeholder="(선택) 장소를 확인한 근거 URL (https)" />
        <input className="rounded border bg-[var(--bg)] p-1" value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder="(선택) 확인 메모" />
      </>}
      <label className="flex items-start gap-2"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />{specific ? "(선택) 원본 출처에서 장소를 직접 확인했습니다." : "(선택) 특정 장소로 오인되지 않는 일반 장면인지 검토했습니다."}</label>
      <AdminButton type="button" variant="secondary" disabled={!view.canEdit || busy || !ready} onClick={() => void mutate({ action: "update-place-review", expectedSelectionFingerprint: view.selection!.fingerprint, visualId: scene.visualId,
        placeReview: specific ? { placeRequirement: "specific_place", placeName: placeName.trim(), sourceChecked: checked, evidenceUrl: evidenceValid ? evidenceUrl.trim() : null, note: note.trim() || null } : { placeRequirement: "generic_allowed", misattributionReviewed: checked } },
        "선택의 장소 요구를 갱신했습니다. 새 구간 클립을 확인한 뒤 다시 승인해주세요.")}>장소 요구 갱신</AdminButton>
    </div></details>;
}

export function NarrationStockSceneSource({ sentenceId, state }: { sentenceId: string; state: VisualSourcesState }) {
  const { view, busy, mutate, draft, dirty, edit, endpoint } = state;
  const scene = view?.scenes.find(s => s.sentenceId === sentenceId); const visualId = scene?.visualId ?? ""; const value = draft.find(s => s.visualId === visualId);
  if (!view?.ready || !scene || !value) return null;
  const editable = view.canEdit && !busy; const stock = scene.choice.source === "stock_video" ? scene.choice : null; const clip = scene.clip;
  const searchBody = { expectedSearchPlanFingerprint: view.searchPlan?.fingerprint, visualId };
  return <details className="rounded border border-[var(--border)] p-2 text-sm" open={!!stock}>
    <summary className="cursor-pointer">영상 소스: {stock ? `스톡 영상 · ${PROVIDER_LABEL[stock.provider]} #${stock.videoId} · 시작 ${seconds(stock.startMs)}` : "이미지 모션"}{dirty[visualId] ? " · 검색 조건 저장 필요" : ""}</summary>
    <div className="mt-2 space-y-3">
      {stock && <div className="space-y-2 rounded border border-[var(--border)] p-2">
        <p className="text-xs">선택 기록 (검색 결과와 별도 보관): <a className="underline" href={stock.snapshot.pageUrl} target="_blank" rel="noreferrer">원본 페이지</a> · 제작자 {stock.snapshot.creatorName ?? "확인 불가"} · 파일 {stock.rendition.width}×{stock.rendition.height} · 선택 {new Date(stock.snapshot.selectedAt).toLocaleString("ko-KR")}
          {stock.placeReview.placeRequirement === "specific_place"
            ? <> · {stock.placeReview.humanConfirmation
              ? <>장소 확인: <a className="underline" href={stock.placeReview.humanConfirmation.evidenceUrl} target="_blank" rel="noreferrer">근거 URL</a>{stock.placeReview.humanConfirmation.note ? ` “${stock.placeReview.humanConfirmation.note}”` : ""}</>
              : "장소 확인 없음"} (메타데이터 표기 {stock.placeReview.metadataEvidence ? "있음" : "없음"})</>
            : stock.placeReview.misattributionReviewed ? " · 일반 장면 오인 위험 검토함" : " · 오인 위험 검토 기록 없음"}</p>
        <PlaceReviewUpdate key={view.selection?.fingerprint ?? "none"} scene={scene} state={state} />
        <p>구간 클립: {clip && clip.provider === stock.provider && clip.videoId === stock.videoId ? (clip.approved ? "승인됨 · 최종 렌더에 사용" : CLIP_LABEL[clip.status] ?? clip.status) : "아직 없음"}</p>
        {clip?.errorCode && <p>{CLIP_ERROR[clip.errorCode] ?? "클립을 만들지 못했습니다."} 최종 렌더는 이미지로 자동 대체하지 않습니다. 다시 만들거나 이미지 모션을 선택해주세요.</p>}
        {clip?.status === "completed" && clip.output && clip.original && <div className="space-y-1">
          <video key={clip.output.sha256} className="max-h-72" controls preload="metadata" src={`${endpoint}/clips/${clip.jobId}`} />
          <p className="text-xs">정규화된 장면 클립 · 720×1280 · 30fps · {clip.output.frameCount}프레임 · 소리 없음 (내레이션은 렌더에서 합성) · 최종 렌더 입력과 같은 파일</p>
          <p className="text-xs">원본 {clip.original.width}×{clip.original.height} · {seconds(clip.original.durationMs)} · 평균 {clip.original.avgFrameRate}fps · 다운로드 {new Date(clip.original.downloadedAt).toLocaleString("ko-KR")} · <a className="underline" href={clip.provenance.pageUrl} target="_blank" rel="noreferrer">원본 페이지</a> · 제작자 {clip.provenance.creatorName ?? "확인 불가"}</p>
          <AdminButton type="button" variant="primary" disabled={!editable || clip.approved || !view.selection?.fingerprint} onClick={() => void mutate({ action: "approve-clip", expectedSelectionFingerprint: view.selection?.fingerprint, visualId, jobId: clip.jobId,
            expectedOriginalSha256: clip.original!.sha256, expectedOutputSha256: clip.output!.sha256 }, "정규화된 구간 클립을 승인했습니다.")}>이 클립 승인</AdminButton>
        </div>}
        {(!clip || clip.status === "failed" || clip.status === "stale" || clip.provider !== stock.provider || clip.videoId !== stock.videoId) &&
          <AdminButton type="button" variant="secondary" disabled={!editable || !view.workerAvailable || !view.selection?.fingerprint} onClick={() => void mutate({ action: "make-clip", expectedSelectionFingerprint: view.selection?.fingerprint, visualId }, "구간 클립을 다시 요청했습니다.")}>구간 클립 만들기</AdminButton>}
        {!view.workerAvailable && <p>영상 실행기가 연결되지 않았습니다. 연결 후 구간 클립을 만들 수 있습니다.</p>}
        <AdminButton type="button" variant="secondary" disabled={!editable} onClick={() => void mutate({ action: "use-image-motion", expectedSelectionFingerprint: view.selection?.fingerprint ?? null, visualId }, "이미지 모션으로 전환했습니다. 스톡 원본·클립 파일과 이미지·모션 승인은 삭제하지 않았습니다.")}>이미지 모션 사용</AdminButton>
        <p className="text-xs">{scene.motion?.approved ? "이미지 모션으로 돌아가면 기존에 승인된 최신 모션을 그대로 사용합니다." : "이미지 모션으로 돌아가면 아래 '문장별 이미지 움직임'에서 생성·승인이 필요합니다."}</p>
      </div>}
      <details><summary className="cursor-pointer">검색 조건 보기·수정</summary><div className="mt-2"><SearchConditions scene={scene} value={value} disabled={!editable} onEdit={patch => edit(visualId, patch)} /></div></details>
      <div className="flex flex-wrap gap-2">
        {!scene.search?.current
          ? <AdminButton type="button" variant="secondary" disabled={!editable || !view.searchPlan || !!dirty[visualId] || !scene.searchScene?.searchEnabled} onClick={() => void mutate({ action: "search", ...searchBody }, "검색 결과를 저장했습니다.")}>스톡 영상 찾기 (외부 호출)</AdminButton>
          : <AdminButton type="button" variant="secondary" disabled={!editable || !!dirty[visualId] || !scene.searchScene?.searchEnabled} onClick={() => { if (window.confirm("현재 검색 결과를 보관하고 계획의 검색어로 새로 검색할까요? 외부 호출이 발생하며, 검토 기록과 선택은 그대로 유지됩니다.")) void mutate({ action: "search", newSession: true, ...searchBody }, "새 검색 세션을 시작했습니다. 이전 결과는 보관했습니다."); }}>새 검색 시작 (외부 호출 · 이전 결과 보관)</AdminButton>}
        {scene.search?.current && scene.search.canRevealMore && <AdminButton type="button" variant="secondary" disabled={!editable} onClick={() => void mutate({ action: "reveal-more", ...searchBody }, "저장된 후보를 더 표시했습니다.")}>저장된 후보 더 보기 (외부 호출 없음 · {scene.search.storedNotShown}개 남음)</AdminButton>}
        {scene.search?.current && scene.search.canFetchNextPage && <AdminButton type="button" variant="secondary" disabled={!editable} onClick={() => void mutate({ action: "fetch-next-page", ...searchBody }, "다음 페이지를 검색했습니다.")}>다음 페이지 검색 (외부 호출)</AdminButton>}
      </div>
      {!view.searchPlan && <p>먼저 위에서 검색 계획을 만들거나 검색 조건을 직접 입력해 저장해주세요.</p>}
      {scene.search && <div className="space-y-2">
        <p>검색 결과: {OUTCOME_LABEL[scene.search.outcome]} · 표시 {scene.search.shown.length} · 저장 {scene.search.total}{scene.search.rejected.length ? ` · 맞지 않음 ${scene.search.rejected.length}` : ""}{scene.search.current ? "" : " · 이전 검색 조건 기준"}</p>
        {Object.keys(scene.search.excludedSummary).length > 0 && <p className="text-xs">기술 조건으로 자동 제외 (내용 판단 아님): {Object.entries(scene.search.excludedSummary).map(([reason, count]) => `${EXCLUSION_LABEL[reason] ?? reason} ${count}건`).join(", ")}</p>}
        <details className="text-xs"><summary className="cursor-pointer">provider 호출 기록</summary><ul className="list-disc pl-5">{scene.search.attempts.map((a, i) => <li key={i}>{PROVIDER_LABEL[a.provider]} “{a.query}” {a.page}쪽 · {a.status}{a.status === "cache_hit" ? "(캐시)" : ""} · {a.rawCount}건{a.message ? ` · ${a.message}` : ""}</li>)}</ul></details>
        {scene.search.current && scene.search.shown.map((candidate, i) => <CandidateCard key={`${candidate.provider}:${candidate.videoId}`} candidate={candidate} index={i} scene={scene} state={state} />)}
        {scene.search.current && scene.search.rejected.length > 0 && <details className="rounded border border-[var(--border)] p-2"><summary className="cursor-pointer">맞지 않음으로 표시한 후보 {scene.search.rejected.length}개 (이 장면 조건에서만 적용 · 다시 보기·판단 변경 가능)</summary>
          <div className="mt-2 space-y-2">{scene.search.rejected.map((candidate, i) => <CandidateCard key={`${candidate.provider}:${candidate.videoId}`} candidate={candidate} index={i} scene={scene} state={state} label={`맞지 않음 ${i + 1}`} />)}</div></details>}
        {scene.search.current && <SupplementPanel scene={scene} state={state} />}
      </div>}
      {scene.requirement?.searchEnabled && <NoSuitableToggle scene={scene} state={state} />}
      <SceneSearchHistory scene={scene} />
      <QueryHistoryPanel revisions={scene.queryHistory} editing={value.queries} disabled={!editable}
        onReuse={q => edit(visualId, { queries: [...value.queries, { text: q.text, strategy: q.strategy ?? SEARCH_STRATEGIES.find(s => !value.queries.some(r => r.strategy === s)) ?? "synonym", purpose: `${q.revision}차 계획 검색어 재사용`, ...(q.pixabayText ? { pixabayText: q.pixabayText } : {}) }] })} />
      <SceneSearchMetricsPanel scene={scene} />
    </div>
  </details>;
}
