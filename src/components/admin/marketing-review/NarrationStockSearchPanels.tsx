"use client";
import { useState } from "react";
import AdminButton from "@/components/admin/ui/AdminButton";
import { queryAxes, REJECT_REASONS, SEARCH_STRATEGIES, type RejectReason, type SearchAxes, type SearchStrategy, type StockProvider, type StrategyQuery } from "@/lib/marketing/publishable/narrationVisualSources/contracts";
import { queryIdentity } from "@/lib/marketing/publishable/narrationVisualSources/metadataText";
import type { QueryHistoryRevision } from "@/lib/marketing/publishable/narrationVisualSources/queryHistory";
import { AXIS_LABEL, emptyAxes, STRATEGY_LABEL } from "@/lib/marketing/publishable/narrationVisualSources/requirements";
import type { Candidate, StockScene, VisualSourcesState } from "./NarrationStockSceneSource";

export const PROVIDER_LABEL: Record<StockProvider, string> = { pexels: "Pexels", pixabay: "Pixabay" };
export const EXCLUSION_LABEL: Record<string, string> = { too_short: "장면보다 짧음", excessive_crop: "9:16 변환 시 과도한 잘림", upscale_required: "확대 필요(해상도 부족)", no_usable_rendition: "사용할 파일 없음", malformed: "응답 형식 오류" };
const REJECT_LABEL: Record<RejectReason, string> = { place_culture_mismatch: "장소·문화권 불일치", subject_action_mismatch: "피사체·행동 불일치", composition_mismatch: "구도 불일치",
  time_mood_mismatch: "시간대·분위기 불일치", insufficient_motion: "움직임 부족", unsuitable_vertical: "세로 화면에 부적합", already_used: "이미 사용한 영상", other: "기타 (메모)" };
const KIND_LABEL = { initial: "초기 검색", supplement: "보완 검색", next_page: "다음 페이지" } as const;
const HINT_LABEL: Record<string, string> = {
  few_results: "기술 조건을 통과한 후보가 적습니다. 완화 가능한 부가 조건을 빼거나 흔한 동의어를 써 볼 수 있습니다.",
  mostly_landscape: "가로 영상이 많아 9:16 변환 시 잘림으로 제외된 경우가 많습니다. 검색어보다 기술 조건 문제일 수 있습니다.",
  too_generic: "provider 설명에 핵심 피사체가 드물거나, 내용이 맞지 않아 탈락시킨 후보가 많습니다. 핵심 피사체·행동·지역을 더 구체적으로 써 볼 수 있습니다.",
  place_unconfirmed_not_mismatch: "provider 설명에 장소명이 있는 후보가 없습니다. 장소 미확인은 내용 불일치가 아닙니다.",
};
const counts = (record: Record<string, number>, labels: Record<string, string> = {}) => Object.entries(record).map(([k, n]) => `${labels[k] ?? STRATEGY_LABEL[k as SearchStrategy] ?? k} ${n}`).join(", ");

type QueryRow = StrategyQuery;
const withoutEmptyPixabay = ({ pixabayText, ...row }: QueryRow): QueryRow => pixabayText?.trim() ? { ...row, pixabayText } : row;
export function QueryRows({ rows, axes, disabled, onChange }: { rows: QueryRow[]; axes?: SearchAxes; disabled: boolean; onChange: (rows: QueryRow[]) => void }) {
  const padded = [0, 1, 2].map(i => rows[i] ?? { text: "", strategy: SEARCH_STRATEGIES.find(s => !rows.some(r => r.strategy === s)) ?? "synonym", purpose: "" });
  const update = (i: number, patch: Partial<QueryRow>) => onChange(padded.map((row, j) => j === i ? { ...row, ...patch } : row).filter(row => row.text.trim()).map(withoutEmptyPixabay));
  return <div className="grid gap-1">{padded.map((row, i) => <div key={i} className="grid gap-1">
    <div className="grid gap-1 sm:grid-cols-[2fr_1fr_2fr]">
      <input className="rounded border bg-[var(--bg)] p-1" value={row.text} disabled={disabled} placeholder={`검색어 ${i + 1} (영어)`} onChange={e => update(i, { text: e.target.value })} />
      <select className="rounded border bg-[var(--bg)] p-1" value={row.strategy} disabled={disabled} aria-label={`검색어 ${i + 1} 전략`} onChange={e => update(i, { strategy: e.target.value as SearchStrategy })}>
        {SEARCH_STRATEGIES.map(s => <option key={s} value={s}>{STRATEGY_LABEL[s]}</option>)}</select>
      <input className="rounded border bg-[var(--bg)] p-1" value={row.purpose} disabled={disabled} placeholder="이 검색어로 찾으려는 것" onChange={e => update(i, { purpose: e.target.value })} />
    </div>
    {row.text.trim() && <div className="grid gap-1 text-xs sm:grid-cols-[2fr_3fr]">
      <input className="rounded border bg-[var(--bg)] p-1" value={row.pixabayText ?? ""} disabled={disabled} placeholder="(선택) Pixabay용 짧은 표현 2~3단어" onChange={e => update(i, { pixabayText: e.target.value })} />
      {axes && <span className="self-center">의미 축: {queryAxes(row.text, axes).map(a => AXIS_LABEL[a]).join(" + ") || "해당 없음"}</span>}
    </div>}
  </div>)}</div>;
}
const axisList = (value: string) => value.split(",").map(v => v.trim()).filter(Boolean);
/** Optional search vocabulary per axis. Empty axes are not saved, so a plan without them keeps its old shape. */
export function AxesEditor({ axes, disabled, onChange }: { axes: SearchAxes | undefined; disabled: boolean; onChange: (axes: SearchAxes | undefined) => void }) {
  const value = axes ?? emptyAxes();
  const update = (axis: keyof SearchAxes, text: string) => { const next = { ...value, [axis]: axisList(text) }; onChange(Object.values(next).some(list => list.length) ? next : undefined); };
  return <details className="text-xs" open={!!axes}><summary className="cursor-pointer">(선택) 의미 축 · 검색어를 장소·피사체·행동·맥락으로 나눠 조합할 때 사용</summary>
    <div className="mt-1 grid gap-1">
      <p>영어로, 쉼표로 구분합니다. 장소 축은 실제 장소가 필요한 장면에만 씁니다. 분위기만 맞으면 되는 보조 장면은 맥락 축을 쓰세요. provider 설명의 장소 표기는 확인이 아닙니다.</p>
      {(Object.keys(AXIS_LABEL) as Array<keyof SearchAxes>).map(axis => <label key={axis}>{AXIS_LABEL[axis]}
        <input className="block w-full rounded border bg-[var(--bg)] p-1" defaultValue={value[axis].join(", ")} disabled={disabled} onBlur={e => update(axis, e.target.value)} /></label>)}
    </div></details>;
}
type ReuseQuery = { text: string; strategy: SearchStrategy | null; pixabayText?: string; revision: number };
/** Earlier revisions' queries with what they returned. Reuse only copies a query into the plan being edited; nothing runs. */
export function QueryHistoryPanel({ revisions, editing, disabled, onReuse }: { revisions: QueryHistoryRevision[]; editing: QueryRow[]; disabled: boolean; onReuse: (query: ReuseQuery) => void }) {
  if (revisions.length < 2 && !revisions.some(r => r.rows.some(row => row.ran))) return null;
  const inPlan = new Set(editing.map(q => queryIdentity(q.text)));
  return <details className="text-xs"><summary className="cursor-pointer">검색 계획 개정별 검색어 이력 ({revisions.length}개 개정판 · 다시 실행하지 않음)</summary>
    <ul className="mt-1 space-y-1 pl-2">{revisions.map(revision => <li key={revision.fingerprint}>
      <p className="font-medium">{revision.revision}차{revision.current ? " (현재)" : ""} · {new Date(revision.updatedAt).toLocaleString("ko-KR")}</p>
      {revision.rows.length === 0 ? <p>검색어 없음</p> : <ul className="list-disc pl-5">{revision.rows.map(row => <li key={`${row.provider}:${row.query}`}>
        {PROVIDER_LABEL[row.provider]} “{row.query}”{row.strategy ? ` (${STRATEGY_LABEL[row.strategy]})` : ""} · {row.ran
          ? `실행 ${row.runs}회 · provider 결과 ${row.rawCount}건 · 기술 통과 ${row.technicalPassCount}건 · 검토 후보·선택 ${row.adopted ?? "알 수 없음"}`
          : "실행 기록 없음 (이전 형식이었거나 실행하지 않음)"}{row.resultRefs.length ? ` · 저장 결과 ${row.resultRefs.length}개` : ""}
        {!revision.current && row.provider === "pexels" && <> · <button type="button" className="underline disabled:no-underline disabled:opacity-50"
          disabled={disabled || editing.length >= 3 || inPlan.has(queryIdentity(row.planQuery))} title={editing.length >= 3 ? "검색어 3개가 이미 있습니다" : undefined}
          onClick={() => { const pixabay = revision.rows.find(r => r.provider === "pixabay" && r.planQuery === row.planQuery); onReuse({ text: row.planQuery, strategy: row.strategy, revision: revision.revision, ...(pixabay && pixabay.query !== row.planQuery ? { pixabayText: pixabay.query } : {}) }); }}>
          편집 중인 계획에 추가</button></>}
      </li>)}</ul>}
    </li>)}</ul>
    <p className="mt-1">이전 결과는 현재 후보에 합치지 않습니다. 추가한 검색어는 검색 조건을 저장한 뒤 &lsquo;새 검색 시작&rsquo;을 눌러야 실행됩니다.</p>
  </details>;
}

/** Review notes only: never a selection, a clip approval or a production approval, and never applied to other scenes. */
export function CandidateReviewControls({ candidate, scene, state }: { candidate: Candidate; scene: StockScene; state: VisualSourcesState }) {
  const { view, busy, mutate } = state; const editable = !!view?.canEdit && !busy; const review = candidate.review;
  const [note, setNote] = useState(review?.note ?? "");
  const target = { visualId: scene.visualId, provider: candidate.provider, videoId: candidate.videoId };
  const record = (verdict: "shortlist" | "reject", reason: RejectReason | null) =>
    void mutate({ action: "review-candidate", ...target, verdict, reason, note: note.trim() || null }, verdict === "shortlist" ? "검토 후보로 표시했습니다." : "맞지 않음으로 기록했습니다.");
  return <div className="grid gap-1 rounded border border-dashed border-[var(--border)] p-2 text-xs">
    <p>검토 기록 (구간 선택·클립 승인과 별개): {review ? (review.verdict === "shortlist" ? "검토 후보" : `맞지 않음 · ${REJECT_LABEL[review.reason!]}`) : "기록 없음"}{review?.note ? ` · “${review.note}”` : ""}</p>
    <input className="rounded border bg-[var(--bg)] p-1" value={note} maxLength={300} disabled={!editable} onChange={e => setNote(e.target.value)} placeholder="(선택) 메모 · 먼저 적은 뒤 아래에서 판단을 고르면 함께 기록됩니다" />
    <div className="flex flex-wrap items-center gap-2">
      {review?.verdict !== "shortlist" && <AdminButton type="button" variant="secondary" disabled={!editable} onClick={() => record("shortlist", null)}>검토 후보로 표시</AdminButton>}
      <select className="rounded border bg-[var(--bg)] p-1" value="" disabled={!editable} aria-label="맞지 않음 이유" onChange={e => { if (e.target.value) record("reject", e.target.value as RejectReason); }}>
        <option value="">{review?.verdict === "reject" ? "맞지 않음 이유 바꾸기" : "맞지 않음 (이유 선택)"}</option>
        {REJECT_REASONS.map(r => <option key={r} value={r}>{REJECT_LABEL[r]}</option>)}</select>
      {review && <AdminButton type="button" variant="secondary" disabled={!editable} onClick={() => void mutate({ action: "clear-review", ...target }, "판단을 취소했습니다.")}>판단 취소</AdminButton>}
    </div>
  </div>;
}

export function NoSuitableToggle({ scene, state }: { scene: StockScene; state: VisualSourcesState }) {
  const { view, busy, mutate } = state; const editable = !!view?.canEdit && !busy;
  const [note, setNote] = useState(scene.noSuitable?.note ?? "");
  return <div className="grid gap-1 text-xs">
    <label className="flex items-start gap-2"><input type="checkbox" checked={!!scene.noSuitable} disabled={!editable}
      onChange={e => void mutate({ action: "scene-no-suitable", visualId: scene.visualId, noSuitable: e.target.checked, note: note.trim() || null }, e.target.checked ? "이 장면을 '적합한 후보 없음'으로 기록했습니다." : "'적합한 후보 없음' 기록을 취소했습니다.")} />
      이 장면 조건으로는 적합한 후보가 없음 (기록만 남깁니다 · 소스를 자동으로 바꾸지 않습니다)</label>
    {!scene.noSuitable && <input className="rounded border bg-[var(--bg)] p-1" value={note} maxLength={300} disabled={!editable} onChange={e => setNote(e.target.value)} placeholder="(선택) 메모" />}
    {scene.noSuitable?.note && <p>메모: {scene.noSuitable.note}</p>}
  </div>;
}

/** Shows the facts first; Hermes only suggests, the reviewer edits and runs once per session. */
export function SupplementPanel({ scene, state }: { scene: StockScene; state: VisualSourcesState }) {
  const search = scene.search!; const supplement = search.supplement; const proposal = supplement.proposal;
  return <SupplementForm key={proposal?.proposalId ?? "none"} scene={scene} state={state} ran={supplement.ran} available={supplement.available} />;
}
function SupplementForm({ scene, state, ran, available }: { scene: StockScene; state: VisualSourcesState; ran: boolean; available: boolean }) {
  const { view, busy, mutate } = state; const editable = !!view?.canEdit && !busy;
  const search = scene.search!; const proposal = search.supplement.proposal; const diagnosis = search.supplement.diagnosis; const r = scene.requirement;
  const [manual, setManual] = useState(false); const [reason, setReason] = useState(proposal?.changeReason ?? ""); const [rows, setRows] = useState<QueryRow[]>(proposal?.queries ?? []);
  if (ran) return <p className="text-xs">이 검색 세션의 보완 검색을 실행했습니다 (세션당 1회). 더 찾으려면 &lsquo;새 검색 시작&rsquo;을 눌러주세요. 이전 이력은 보관됩니다.</p>;
  if (!available || !r) return null;
  const body = { expectedSearchPlanFingerprint: view?.searchPlan?.fingerprint, visualId: scene.visualId };
  const used = (search.sessionQueries ?? []).map(q => q.text);
  const rejected = diagnosis ? Object.values(diagnosis.rejectedByReason).reduce((a, b) => a + b, 0) : 0;
  return <details className="rounded border border-[var(--border)] p-2 text-xs"><summary className="cursor-pointer">결과를 반영해 다시 찾기 (세션당 1회 · 검색어 최대 3개)</summary>
    <div className="mt-2 space-y-2">
      {diagnosis && <ul className="list-disc pl-5">
        <li>provider 결과 {diagnosis.rawCount}건 · 중복 {diagnosis.duplicateCount} · 기술 조건 통과 {diagnosis.technicalPassCount} · 표시 {diagnosis.shownCount}</li>
        {Object.keys(diagnosis.technicalExcluded).length > 0 && <li>기술 조건 제외: {counts(diagnosis.technicalExcluded, EXCLUSION_LABEL)}</li>}
        <li>사람 판단: 검토 후보 {diagnosis.shortlisted} · 맞지 않음 {rejected}{rejected ? ` (${counts(diagnosis.rejectedByReason, REJECT_LABEL)})` : ""} · 판단하지 않은 후보는 실패로 세지 않습니다.</li>
        <li>provider 설명 근거 ({diagnosis.technicalPassCount}개 중): 피사체 언급 {diagnosis.evidence.subjectMatch} · 행동 {diagnosis.evidence.actionMatch} · 장소 {diagnosis.evidence.placeMatch} · 제외 조건 언급 {diagnosis.evidence.conflicts}</li>
        {diagnosis.hints.map(h => <li key={h}>{HINT_LABEL[h] ?? h}</li>)}
      </ul>}
      <p>유지할 조건: 피사체 “{r.coreSubject}”{r.coreAction ? ` · 행동 “${r.coreAction}”` : ""}{r.required.length ? ` · 반드시 유지 ${r.required.join(", ")}` : ""}{r.region ? ` · 지역 ${r.region}` : ""}{r.placeName ? ` · 장소 ${r.placeName}` : ""}. 보완 검색은 이 조건을 바꾸지 않습니다. 바꾸려면 검색 조건을 직접 수정해 저장하세요.{r.relaxable.length ? ` 뺄 수 있는 부가 조건: ${r.relaxable.join(", ")}.` : ""}</p>
      <p>이 세션에서 이미 쓴 검색어: {used.length ? used.map(q => `“${q}”`).join(", ") : "없음"}</p>
      <div className="flex flex-wrap gap-2">
        <AdminButton type="button" variant="secondary" disabled={!editable} onClick={() => void mutate({ action: "propose-supplement", ...body }, "보완 검색어 제안을 받았습니다. 실행 전에 확인·수정해주세요.")}>보완 검색어 제안 받기 (Hermes · 검색은 아직 하지 않음)</AdminButton>
        {!proposal && !manual && <AdminButton type="button" variant="secondary" disabled={!editable} onClick={() => setManual(true)}>직접 입력</AdminButton>}
      </div>
      {(proposal || manual) && <div className="grid gap-1">
        {proposal && <p>{proposal.origin === "hermes" ? "Hermes 제안" : "사람 입력"} · {new Date(proposal.createdAt).toLocaleString("ko-KR")} · 실행 전에 고칠 수 있습니다.</p>}
        <label>변경 이유<textarea className="block w-full rounded border bg-[var(--bg)] p-1" value={reason} maxLength={600} disabled={!editable} onChange={e => setReason(e.target.value)} /></label>
        <QueryRows rows={rows} disabled={!editable} onChange={setRows} />
        <AdminButton type="button" variant="primary" disabled={!editable || !reason.trim() || !rows.length} onClick={() => { if (window.confirm("보완 검색을 실행할까요? 외부 호출이 발생하며, 이 검색 세션에서 한 번만 할 수 있습니다.")) void mutate({ action: "run-supplement", ...body,
          proposalId: proposal?.proposalId ?? null, changeReason: reason.trim(), queries: rows.map(q => ({ ...q, text: q.text.trim(), purpose: q.purpose.trim() || "보완 검색" })) }, "보완 검색 결과를 저장했습니다."); }}>보완 검색 실행 (외부 호출)</AdminButton>
      </div>}
    </div></details>;
}

export function SceneSearchHistory({ scene }: { scene: StockScene }) {
  if (!scene.attemptHistory.length) return null;
  return <details className="text-xs"><summary className="cursor-pointer">검색 시도 이력 {scene.attemptHistory.length}건 (최근 순 · 결과와 별도 보관)</summary>
    <ul className="mt-1 list-disc space-y-1 pl-5">{scene.attemptHistory.map(a => <li key={a.attemptId}>
      {KIND_LABEL[a.kind]} · {new Date(a.startedAt).toLocaleString("ko-KR")} · 외부 호출 {a.totals.networkRequests} · 캐시 {a.totals.cacheHits} · provider 결과 {a.totals.rawCount} · 중복 {a.totals.duplicateCount} · 새 후보 {a.totals.technicalPassCount}
      {Object.keys(a.totals.excludedByReason).length > 0 && ` · 기술 제외 ${counts(a.totals.excludedByReason, EXCLUSION_LABEL)}`}
      {a.stoppedReason === "rate_limited" && ` · 429로 즉시 중단 (보내지 않은 요청 ${a.notRunRequests})`}{!a.stoppedReason && a.notRunRequests > 0 && ` · 보내지 않은 요청 ${a.notRunRequests} (인증 실패 provider)`}
      {a.changeReason && <div>변경 이유: {a.changeReason}</div>}
      <div>검색어: {a.queries.map(q => `“${q.text}”${q.strategy ? ` (${STRATEGY_LABEL[q.strategy]}${q.purpose ? ` · ${q.purpose}` : ""})` : ""}`).join(", ")}</div>
    </li>)}</ul></details>;
}

export function SceneSearchMetricsPanel({ scene }: { scene: StockScene }) {
  const m = scene.metrics; if (!m || (!m.searchActions.initial && !m.searchActions.supplement && !m.searchActions.next_page && !m.reviews.shortlisted && !m.reviews.rejected)) return null;
  const bucketRows = (record: typeof m.byStrategy, label: (key: string) => string) => Object.entries(record).map(([key, b]) =>
    <li key={key}>{label(key)}: 요청 {b.requests} · 외부 호출 {b.externalRequests} · provider 결과 {b.rawCount} · 기술 통과 {b.technicalPassCount} · 검토 후보 {b.shortlisted} · 맞지 않음 {b.rejected}{b.rejected ? ` (${counts(b.rejectedByReason, REJECT_LABEL)})` : ""} · 구간 생성 {b.usedForRange}</li>);
  const elapsed = m.untilSelection.elapsedSinceFirstSearchMs;
  return <details className="text-xs"><summary className="cursor-pointer">이 장면의 검색 성과 (관찰값)</summary>
    <ul className="mt-1 list-disc pl-5">
      <li>검색 실행: 초기 {m.searchActions.initial} · 보완 {m.searchActions.supplement} · 다음 페이지 {m.searchActions.next_page} · 외부 호출 {m.externalRequests} · 캐시 {m.cacheHits}{m.rateLimitedStops ? ` · 429 중단 ${m.rateLimitedStops}회` : ""}</li>
      <li>{m.untilSelection.selected ? `현재 선택까지: 검색 실행 ${m.untilSelection.searchActions}회 · 외부 호출 ${m.untilSelection.externalRequests}회${elapsed !== null ? ` · 첫 검색부터 선택까지 ${Math.round(elapsed / 60000)}분 (자리를 비운 시간이 포함될 수 있음)` : ""}` : "아직 스톡 후보를 선택하지 않았습니다."}</li>
      <li>검토 후보 {m.reviews.shortlisted} (그중 구간 생성으로 이어짐 {m.reviews.shortlistedLedToRange}) · 맞지 않음 {m.reviews.rejected}{m.reviews.rejected ? ` (${counts(m.reviews.rejectedByReason, REJECT_LABEL)})` : ""}</li>
      <li>클립 승인 {m.clipApproved ? "있음" : "없음"} · 적합한 후보 없음 기록 {m.noSuitable ? "있음" : "없음"}</li>
      {Object.keys(m.byStrategy).length > 0 && <li>전략별<ul className="list-disc pl-5">{bucketRows(m.byStrategy, k => k === "unspecified" ? "전략 기록 없음(이전 형식)" : STRATEGY_LABEL[k as SearchStrategy] ?? k)}</ul></li>}
      {Object.keys(m.byProvider).length > 0 && <li>provider별<ul className="list-disc pl-5">{bucketRows(m.byProvider, k => PROVIDER_LABEL[k as StockProvider] ?? k)}</ul></li>}
    </ul>
    <p>판단하지 않은 후보는 실패로 세지 않습니다. 한 장면의 적은 표본으로 전략의 우열을 정하지 마세요.</p>
  </details>;
}
