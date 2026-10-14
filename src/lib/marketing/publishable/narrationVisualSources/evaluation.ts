import { STOCK_PROVIDERS, type StockCandidate } from "./contracts";
import { describedTerms, placeEvidence, terms, uniqueTerms } from "./metadataText";
import type { SceneRequirement } from "./requirements";
import { conceptsIn, GENERIC_TERMS, sequencesOf, specificTerms, withNarrower, type Concept, type Sequences } from "./vocabulary";

/**
 * Content fit, kept apart from technical fit (duration, crop, resolution in fit.ts). It reads only what the provider wrote
 * about the video: Pixabay tags and the page-URL slug (the uploader's title). Creator names and our own queries never
 * count, and a word missing from tags is "no information", never a conflict.
 *
 * Extension point: a later frame-based assessor returns the same shape with basis "video_frames" and videoReviewed true,
 * after looking at sampled frames of the preview rendition. It would run only on an explicit request, store its result
 * next to the search session (never in selection, clip or render inputs) and be shown beside this metadata reading.
 */
export type FacetStatus = "match" | "conflict" | "no_info" | "not_required";
/** weak: only generic words (eat, walk) matched; shown, never used to move a candidate up. */
export type Facet = { status: FacetStatus; evidence: string[]; weak?: boolean };
export type ContentEvidence = {
  basis: "provider_metadata";
  videoReviewed: false;
  /** Which descriptive fields the provider supplied at all; none means every facet is no_info. */
  describedBy: Array<"tags" | "page_title">;
  facets: { subject: Facet; action: Facet; context: Facet; place: Facet; exclusion: Facet };
  /** Generic scene words (people, table, street...) present in the metadata; listed for transparency, never counted. */
  genericOnly: string[];
  requiredMatched: string[];
  preferredMatched: string[];
};
type Described = Pick<StockCandidate, "pageUrl" | "sourceMetadata">;

/** What the requirement asks for, read once per requirement. */
type Reading = {
  subjectRoots: Array<{ concept: Concept; phrase: string }>; subjectAccepted: Map<string, { root: Concept; phrase: string }>; subjectCategories: Set<string>; subjectFallback: string[];
  actionConcepts: Array<{ concept: Concept; phrase: string }>; actionFallback: string[];
  contextAccepted: Set<string>; contextFallback: string[][];
  placeLabels: string[]; sceneGeneric: Set<string>;
};
const readings = new WeakMap<SceneRequirement, Reading>();
function readRequirement(r: SceneRequirement): Reading {
  const cached = readings.get(r); if (cached) return cached;
  const subjectSeqs = sequencesOf([...r.axes.subject, ...r.required]);
  const subjectRoots = conceptsIn(subjectSeqs, "subject");
  const subjectAccepted = new Map<string, { root: Concept; phrase: string }>();
  for (const root of subjectRoots) for (const id of withNarrower(root.concept.id)) if (!subjectAccepted.has(id)) subjectAccepted.set(id, { root: root.concept, phrase: root.phrase });
  const subjectFallback = subjectRoots.length ? [] : [...new Set(r.axes.subject.flatMap(specificTerms))];
  const actionConcepts = conceptsIn(sequencesOf(r.axes.action), "action");
  const subjectWords = new Set(r.axes.subject.flatMap(s => terms(s)));
  const actionFallback = actionConcepts.length ? [] : [...new Set(r.axes.action.flatMap(specificTerms))].filter(t => !subjectWords.has(t));
  const contextPhrases = [...r.axes.context, ...r.required];
  const contextRoots = conceptsIn(sequencesOf(contextPhrases), "context");
  const contextAccepted = new Set(contextRoots.flatMap(c => [...withNarrower(c.concept.id)]));
  // Context phrases outside the vocabulary still count when all of their specific words appear.
  const contextFallback = r.axes.context.filter(p => !conceptsIn(sequencesOf([p])).length).map(specificTerms).filter(t => t.length > 0);
  const placeLabels = r.placeScope === "any" ? [] : r.axes.location;
  const sceneGeneric = new Set(terms([...r.axes.subject, ...r.axes.action, ...r.axes.context, ...r.required].join(" ")).filter(t => GENERIC_TERMS.has(t)));
  const reading = { subjectRoots, subjectAccepted, subjectCategories: new Set(subjectRoots.flatMap(s => s.concept.category ? [s.concept.category] : [])), subjectFallback,
    actionConcepts, actionFallback, contextAccepted, contextFallback, placeLabels, sceneGeneric };
  readings.set(r, reading); return reading;
}
const phraseIn = (phrase: string, described: Set<string>) => { const needed = uniqueTerms([phrase]); return needed.length > 0 && needed.every(t => described.has(t)); };
const sameWords = (a: string, b: string) => terms(a).join(" ") === terms(b).join(" ");
const NONE: Facet = { status: "no_info", evidence: [] };

function subjectFacet(reading: Reading, seqs: Sequences, described: Set<string>): Facet {
  const hits = seqs.length ? conceptsIn(seqs, "subject") : [];
  const matched = hits.flatMap(hit => { const accepted = reading.subjectAccepted.get(hit.concept.id); if (!accepted) return [];
    if (hit.concept.id !== accepted.root.id) return [`${hit.phrase} (${accepted.root.id}의 하위어)`];
    return [sameWords(hit.phrase, accepted.phrase) ? hit.phrase : `${hit.phrase} (${accepted.phrase}와 같은 개념)`]; });
  if (matched.length) return { status: "match", evidence: matched };
  if (reading.subjectRoots.length) {
    // Another subject of the same kind is named and none of the required ones is: a mismatch clue, not a verdict.
    const others = hits.filter(hit => hit.concept.category && reading.subjectCategories.has(hit.concept.category) && !reading.subjectRoots.some(root => withNarrower(hit.concept.id).has(root.concept.id)));
    return others.length ? { status: "conflict", evidence: others.map(h => h.phrase) } : NONE;
  }
  const need = Math.min(2, reading.subjectFallback.length); const found = reading.subjectFallback.filter(t => described.has(t));
  return need > 0 && found.length >= need ? { status: "match", evidence: found } : NONE;
}
function actionFacet(reading: Reading, seqs: Sequences, described: Set<string>): Facet {
  if (reading.actionConcepts.length) {
    const hits = conceptsIn(seqs, "action").filter(hit => reading.actionConcepts.some(a => a.concept.id === hit.concept.id));
    return hits.length ? { status: "match", evidence: hits.map(h => h.phrase), weak: hits.every(h => h.concept.generic) } : NONE;
  }
  if (!reading.actionFallback.length) return { status: "not_required", evidence: [] };
  const found = reading.actionFallback.filter(t => described.has(t));
  return found.length ? { status: "match", evidence: found } : NONE;
}
function contextFacet(reading: Reading, seqs: Sequences, described: Set<string>): Facet {
  if (!reading.contextAccepted.size && !reading.contextFallback.length) return { status: "not_required", evidence: [] };
  const hits = conceptsIn(seqs, "context").filter(hit => reading.contextAccepted.has(hit.concept.id)).map(h => h.phrase);
  const extra = reading.contextFallback.filter(words => words.every(w => described.has(w))).map(words => words.join(" "));
  const evidence = [...new Set([...hits, ...extra])];
  return evidence.length ? { status: "match", evidence } : NONE;
}
export function assessContent(candidate: Described, requirement: SceneRequirement): ContentEvidence {
  const reading = readRequirement(requirement);
  const video = { tags: candidate.sourceMetadata.tags, pageUrl: candidate.pageUrl };
  const described = describedTerms(video);
  const seqs = sequencesOf([candidate.sourceMetadata.pageSlug, ...candidate.sourceMetadata.tags]);
  const placeHits = reading.placeLabels.filter(label => placeEvidence(video, label));
  const conflicts = requirement.exclude.filter(phrase => phraseIn(phrase, described));
  return {
    basis: "provider_metadata", videoReviewed: false,
    describedBy: [...(candidate.sourceMetadata.tags.length ? ["tags" as const] : []), ...(candidate.sourceMetadata.pageSlug && terms(candidate.sourceMetadata.pageSlug).length ? ["page_title" as const] : [])],
    facets: {
      subject: subjectFacet(reading, seqs, described),
      action: actionFacet(reading, seqs, described),
      context: contextFacet(reading, seqs, described),
      place: !reading.placeLabels.length ? { status: "not_required", evidence: [] } : placeHits.length ? { status: "match", evidence: placeHits } : NONE,
      exclusion: conflicts.length ? { status: "conflict", evidence: conflicts } : NONE,
    },
    genericOnly: [...reading.sceneGeneric].filter(t => described.has(t)),
    requiredMatched: requirement.required.filter(phrase => phraseIn(phrase, described)),
    preferredMatched: requirement.preferred.filter(phrase => phraseIn(phrase, described)),
  };
}

/**
 * Ranking constants. RRF uses each (provider, query) list once with the best rank the video had in it. Adjustments are
 * in units of one top-ranked hit, 1/(k+1), so they read against RRF: a subject clue is worth about one more query that
 * ranked the video first. Generic words and weak actions add nothing, so they can never outweigh a missing subject.
 */
export const RANKING = {
  rrfK: 60,
  adjust: { subjectMatch: 1, actionMatch: 0.5, contextMatch: 0.25, placeMention: 0.25, subjectConflict: -0.75 },
  /** Within the first `depth` places, avoid the same creator twice in a row and more than `maxPerCreator` in the first `window`. */
  diversity: { depth: 12, lookahead: 3, window: 6, maxPerCreator: 2 },
} as const;
export const candidateKey = (candidate: { provider: string; videoId: string }) => `${candidate.provider}:${candidate.videoId}`;
/** Best rank per (provider, query) list; a candidate belongs to one provider, so this is per query. */
export function queryRanks(candidate: Pick<StockCandidate, "foundBy">) {
  const best = new Map<string, number>();
  for (const f of candidate.foundBy) best.set(f.query, Math.min(best.get(f.query) ?? Infinity, f.providerRank));
  return [...best.entries()].map(([query, rank]) => ({ query, rank })).sort((a, b) => a.rank - b.rank || (a.query < b.query ? -1 : 1));
}
export const rrfScore = (candidate: Pick<StockCandidate, "foundBy">) => queryRanks(candidate).reduce((sum, q) => sum + 1 / (RANKING.rrfK + q.rank), 0);
export function rankingAdjustment(evidence: ContentEvidence) {
  const a = RANKING.adjust; const f = evidence.facets;
  const units = (f.subject.status === "match" ? a.subjectMatch : f.subject.status === "conflict" ? a.subjectConflict : 0)
    + (f.action.status === "match" && !f.action.weak ? a.actionMatch : 0) + (f.context.status === "match" ? a.contextMatch : 0) + (f.place.status === "match" ? a.placeMention : 0);
  return units / (RANKING.rrfK + 1);
}
const creatorOf = (candidate: StockCandidate) => (candidate.creatorUrl ?? candidate.creatorName)?.trim().toLowerCase() || null;
function diversify(items: StockCandidate[]) {
  const { depth, lookahead, window, maxPerCreator } = RANKING.diversity;
  const out: StockCandidate[] = []; const rest = [...items];
  while (rest.length) {
    let pick = 0;
    if (out.length < depth) {
      const previous = out.length ? creatorOf(out[out.length - 1]!) : null;
      const inWindow = (creator: string) => out.slice(0, window).filter(c => creatorOf(c) === creator).length;
      const fits = (candidate: StockCandidate) => { const creator = creatorOf(candidate); return creator === null || (creator !== previous && (out.length >= window || inWindow(creator) < maxPerCreator)); };
      const found = rest.slice(0, lookahead + 1).findIndex(fits); pick = found < 0 ? 0 : found;
    }
    out.push(rest.splice(pick, 1)[0]!);
  }
  return out;
}
/**
 * Order: provider rank → RRF across queries → subject/action/context/place adjustment → exclusion and human rejection
 * (exclusions after the rest, rejections last) → creator diversity. Ties break on the best provider rank, provider and
 * id, so the same input always gives the same order.
 */
export function rankCandidates(candidates: StockCandidate[], requirement: SceneRequirement, rejected: Set<string>) {
  const scored = candidates.map(candidate => {
    const evidence = assessContent(candidate, requirement);
    const tier = rejected.has(candidateKey(candidate)) ? 2 : evidence.facets.exclusion.status === "conflict" ? 1 : 0;
    return { candidate, tier, score: rrfScore(candidate) + rankingAdjustment(evidence), bestRank: queryRanks(candidate)[0]?.rank ?? Infinity };
  }).sort((a, b) => a.tier - b.tier || b.score - a.score || a.bestRank - b.bestRank
    || STOCK_PROVIDERS.indexOf(a.candidate.provider) - STOCK_PROVIDERS.indexOf(b.candidate.provider) || (a.candidate.videoId < b.candidate.videoId ? -1 : a.candidate.videoId > b.candidate.videoId ? 1 : 0));
  return [...diversify(scored.filter(s => s.tier === 0).map(s => s.candidate)), ...scored.filter(s => s.tier > 0).map(s => s.candidate)];
}
/** Plain-language reason for a candidate's position, built only from the ranking inputs above; never a score. */
export function priorityReason(candidate: StockCandidate, evidence: ContentEvidence, rejected: boolean) {
  if (rejected) return "같은 장면 조건에서 사람이 '맞지 않음'으로 표시해 뒤로 보냈습니다.";
  const parts: string[] = []; const f = evidence.facets;
  if (f.exclusion.status === "conflict") parts.push(`제외 조건과 충돌(${f.exclusion.evidence.join(", ")})해 뒤로 보냄`);
  const ranks = queryRanks(candidate);
  parts.push(ranks.length > 1 ? `검색어 ${ranks.length}개에서 발견 (provider 순위 ${ranks.map(r => `${r.rank}위`).join(", ")})` : `검색어 1개에서 provider ${ranks[0]?.rank ?? "?"}위`);
  if (f.subject.status === "match") parts.push(`핵심 피사체 단서: ${f.subject.evidence.join(", ")}`);
  else if (f.subject.status === "conflict") parts.push(`다른 피사체 언급(${f.subject.evidence.join(", ")}) · 핵심 피사체 단서 없음`);
  else parts.push("피사체 정보 부족");
  if (f.action.status === "match") parts.push(f.action.weak ? `일반 행동어(${f.action.evidence.join(", ")})만 일치 · 순서 근거로 쓰지 않음` : `행동 단서: ${f.action.evidence.join(", ")}`);
  if (f.context.status === "match") parts.push(`장면 맥락 단서: ${f.context.evidence.join(", ")}`);
  if (f.place.status === "match") parts.push(`장소 표기(${f.place.evidence.join(", ")}) · 실제 장소는 확인 필요`);
  else if (f.place.status === "no_info") parts.push("장소 일치 여부는 확인 필요");
  const counted = f.subject.status === "match" || (f.action.status === "match" && !f.action.weak) || f.context.status === "match";
  if (!counted && evidence.genericOnly.length) parts.push(`일반어만 일치(${evidence.genericOnly.join(", ")}) · 근거로 쓰지 않음`);
  return parts.join(" · ");
}
