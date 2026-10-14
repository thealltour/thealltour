import { z } from "zod";
/**
 * Stock-video sources for Narration scenes. Every artifact here is separate from the scene plan, the image
 * ledger and motion jobs: none of them adds fields to visualPrompt or changes an existing contract hash.
 */
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const uuid = z.string().uuid();
const httpsUrl = z.string().url().max(2000).refine(value => value.startsWith("https://"), "https URL만 사용할 수 있습니다.");
const asciiText = /^[\x20-\x7E]+$/;
export const STOCK_PROVIDERS = ["pexels", "pixabay"] as const;
export const stockProviderSchema = z.enum(STOCK_PROVIDERS);
export const providerVideoIdSchema = z.string().regex(/^[0-9]{1,20}$/);
const query = z.string().trim().min(2).max(100).regex(asciiText, "검색어는 영어(ASCII)로 입력해주세요.");
const line = (max: number) => z.string().trim().min(1).max(max);

export const placeRequirementSchema = z.enum(["specific_place", "generic_allowed"]);
export const stockSceneSearchPlanBaseSchema = z.object({
  visualId: uuid,
  /** false = this scene is not a stock search target; the image path is used. */
  searchEnabled: z.boolean(),
  subject: z.string().trim().max(200),
  visibleAction: z.string().trim().max(200),
  environment: z.string().trim().max(200),
  mustMatch: z.array(line(160)).max(6),
  exclude: z.array(line(160)).max(8),
  placeRequirement: placeRequirementSchema,
  placeName: z.string().trim().min(2).max(120).regex(asciiText, "장소명은 출처 페이지에 표기된 영문으로 입력해주세요.").nullable(),
  misattributionRisk: z.string().trim().max(400),
  queries: z.array(query).max(3),
  humanChecks: z.array(line(200)).max(6),
}).strict();
export const stockSceneSearchPlanSchema = stockSceneSearchPlanBaseSchema.superRefine((scene, context) => {
  const issue = (message: string) => context.addIssue({ code: "custom", message });
  if (!scene.searchEnabled) return;
  if (!scene.subject) issue("검색 대상 장면에는 보여야 할 피사체가 필요합니다.");
  if (!scene.queries.length) issue("검색 대상 장면에는 영어 검색어가 1개 이상 필요합니다.");
  if (new Set(scene.queries.map(q => q.toLowerCase())).size !== scene.queries.length) issue("같은 검색어가 중복되었습니다.");
  if (scene.placeRequirement === "specific_place") { if (!scene.placeName) issue("특정 장소가 필요한 장면에는 장소명이 필요합니다."); }
  else if (!scene.misattributionRisk) issue("일반 장면도 내레이션과 함께 특정 장소로 오인될 위험을 적어주세요.");
});
export const stockSearchPlanV1Schema = z.object({
  contract: z.literal("narration-stock-search-plan-v1"), revision: z.number().int().positive(), fingerprint: hash,
  scenePlanFingerprint: hash, origin: z.enum(["hermes_draft", "human_edited"]),
  scenes: z.array(stockSceneSearchPlanSchema).min(1).max(16), updatedAt: z.string().datetime(),
}).strict();

/**
 * v2 states the scene requirement explicitly. v1 files stay readable as they are (no defaults are injected, so their
 * fingerprints do not move); every new save writes a v2 revision.
 */
export const SEARCH_STRATEGIES = ["place_subject", "subject_action", "synonym", "allowed_mood"] as const;
export const searchStrategySchema = z.enum(SEARCH_STRATEGIES);
export const PLACE_SCOPES = ["specific_place", "city_region", "any"] as const;
const placeText = z.string().trim().min(2).max(120).regex(asciiText, "장소·지역명은 출처 페이지에 표기된 영문으로 입력해주세요.");
/**
 * pixabayText: optional shorter wording sent to Pixabay instead of text (Pixabay matches tags, so 2-3 words work best).
 * Each query is still one request per provider, so the budget does not change.
 */
export const strategyQuerySchema = z.object({ text: query, strategy: searchStrategySchema, purpose: z.string().trim().min(1).max(160), pixabayText: query.optional() }).strict();
const axisTerms = z.array(z.string().trim().min(2).max(60).regex(asciiText, "의미 축 용어는 영어로 입력해주세요.")).max(6);
/** Words a scene can be searched and described by, per axis. Search vocabulary only: not part of the review requirement. */
export const searchAxesSchema = z.object({ location: axisTerms, subject: axisTerms, action: axisTerms, context: axisTerms }).strict();
const normalizedQuery = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
export function strategyQueryIssues(queries: Array<{ text: string; strategy: string }>, region: string | null) {
  const issues: string[] = [];
  if (new Set(queries.map(q => normalizedQuery(q.text))).size !== queries.length) issues.push("같은 검색어가 중복되었습니다.");
  if (new Set(queries.map(q => q.strategy)).size !== queries.length) issues.push("검색어마다 서로 다른 전략을 지정해주세요.");
  if (region && queries.length && !queries.some(q => normalizedQuery(q.text).includes(normalizedQuery(region)))) issues.push("필수 지역은 검색어 하나 이상에 남겨주세요. 지역을 빼려면 장소 요구를 직접 수정해주세요.");
  return issues;
}
export const stockSceneSearchPlanV2BaseSchema = z.object({
  visualId: uuid,
  searchEnabled: z.boolean(),
  coreSubject: z.string().trim().max(200),
  coreAction: z.string().trim().max(200),
  /** specific_place = that venue; city_region = any footage from that city/region; any = place does not matter. */
  place: z.object({ scope: z.enum(PLACE_SCOPES), name: placeText.nullable(), region: placeText.nullable() }).strict(),
  required: z.array(line(160)).max(6),
  preferred: z.array(line(160)).max(6),
  exclude: z.array(line(160)).max(8),
  /** Only these may be dropped by a supplement suggestion; required conditions never are. */
  relaxable: z.array(line(160)).max(6),
  misattributionRisk: z.string().trim().max(400),
  humanChecks: z.array(line(200)).max(6),
  queries: z.array(strategyQuerySchema).max(3),
  axes: searchAxesSchema.optional(),
}).strict();
export const stockSceneSearchPlanV2Schema = stockSceneSearchPlanV2BaseSchema.superRefine((scene, context) => {
  const issue = (message: string) => context.addIssue({ code: "custom", message });
  if (!scene.searchEnabled) return;
  const { scope, name, region } = scene.place;
  if (scope === "specific_place" && !name) issue("특정 장소 장면에는 장소명이 필요합니다.");
  if (scope === "city_region" && (!region || name)) issue("도시·지역 장면에는 지역명만 적어주세요.");
  if (scope === "any" && (name || region)) issue("장소 무관 장면에는 장소·지역명을 적지 않습니다.");
  const required = new Set(scene.required.map(normalizedQuery));
  if (scene.relaxable.some(r => required.has(normalizedQuery(r)))) issue("반드시 유지할 조건은 완화 가능한 조건에 함께 넣을 수 없습니다.");
  if (!scene.coreSubject) issue("검색 대상 장면에는 핵심 피사체가 필요합니다.");
  if (!scene.queries.length) issue("검색 대상 장면에는 영어 검색어가 1개 이상 필요합니다.");
  if (scene.queries.some(q => q.strategy === "place_subject") && scope === "any") issue("장소 무관 장면에는 '장소 + 피사체' 전략을 쓸 수 없습니다.");
  for (const message of strategyQueryIssues(scene.queries, region)) issue(message);
  if (scope !== "specific_place" && !scene.misattributionRisk) issue("일반 장면도 내레이션과 함께 특정 장소로 오인될 위험을 적어주세요.");
  if (scene.axes && scope === "any" && scene.axes.location.length) issue("장소 무관 장면에는 장소 축 용어를 넣지 않습니다.");
  for (const q of scene.queries) if (q.pixabayText && normalizedQuery(q.pixabayText) === normalizedQuery(q.text)) issue(`Pixabay용 표현이 원래 검색어와 같습니다: ${q.text}`);
});
const axisWords = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(w => w.length > 1);
/** Which axes a query draws on, for display: an axis counts when one of its terms appears in the query with all of its words. */
export function queryAxes(text: string, axes: z.infer<typeof searchAxesSchema>) {
  const words = new Set(axisWords(text));
  return (["location", "subject", "action", "context"] as const).filter(axis => axes[axis].some(term => { const needed = axisWords(term); return needed.length > 0 && needed.every(w => words.has(w)); }));
}
export const stockSearchPlanV2Schema = z.object({
  contract: z.literal("narration-stock-search-plan-v2"), revision: z.number().int().positive(), fingerprint: hash,
  scenePlanFingerprint: hash, origin: z.enum(["hermes_draft", "human_edited"]),
  scenes: z.array(stockSceneSearchPlanV2Schema).min(1).max(16), updatedAt: z.string().datetime(),
}).strict();
export const stockSearchPlanSchema = z.discriminatedUnion("contract", [stockSearchPlanV1Schema, stockSearchPlanV2Schema]);

export const stockRenditionSchema = z.object({
  /** Pexels video_file id or Pixabay size key; identifies the same rendition across URL refreshes. */
  fileKey: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  url: httpsUrl, width: z.number().int().positive(), height: z.number().int().positive(), fps: z.number().positive().nullable(),
}).strict();
export const renditionFitSchema = z.object({
  /** Scale needed to cover 720x1280; > 1 means upscaling. */
  scale: z.number().positive(),
  /** Share of the source frame area left after the center crop. */
  retainedArea: z.number().min(0).max(1),
  orientation: z.enum(["portrait", "square", "landscape"]),
}).strict();
export const metadataPlaceEvidenceSchema = z.object({ field: z.enum(["tags", "page_url"]), matchedText: z.string().max(300) }).strict();
export const stockCandidateSchema = z.object({
  provider: stockProviderSchema, videoId: providerVideoIdSchema, pageUrl: httpsUrl,
  creatorName: z.string().max(200).nullable(), creatorUrl: httpsUrl.nullable(),
  /** Provider-declared length (whole seconds). The downloaded file is probed again before use. */
  declaredDurationMs: z.number().int().positive(),
  posterUrl: httpsUrl.nullable(), previewRendition: stockRenditionSchema.nullable(),
  renderRendition: stockRenditionSchema, fit: renditionFitSchema,
  sourceMetadata: z.object({ tags: z.array(z.string().max(80)).max(40), pageSlug: z.string().max(300).nullable() }).strict(),
  /**
   * Set only when provider metadata (Pixabay tags, or the page URL slug that both providers derive from the video title)
   * names the required place. null = metadata is silent ("장소 미확인"), not a mismatch. Never a verification by itself.
   */
  placeEvidence: metadataPlaceEvidenceSchema.nullable(),
  /** Scene words (subject, visible action, must-match) found in the provider's slug or tags. Orders candidates; not a content judgement. */
  metadataMatch: z.array(z.string().max(40)).max(30).optional(),
  foundBy: z.array(z.object({ query, page: z.number().int().positive(), providerRank: z.number().int().positive(),
    strategy: searchStrategySchema.nullable().optional(), attemptId: uuid.optional() }).strict()).min(1).max(9),
}).strict();
/** Missing place metadata is never an exclusion reason; such candidates stay visible as "장소 미확인". */
export const exclusionReasonSchema = z.enum(["too_short", "excessive_crop", "upscale_required", "no_usable_rendition", "malformed"]);
export const searchAttemptSchema = z.object({
  provider: stockProviderSchema, query, page: z.number().int().positive(),
  status: z.enum(["ok", "empty", "cache_hit", "rate_limited", "auth_failed", "error", "disabled", "cap_reached"]),
  rawCount: z.number().int().nonnegative(), message: z.string().max(200).nullable(),
}).strict();
export const SEARCH_OUTCOMES = ["candidates", "no_suitable_candidate", "search_failed", "not_applicable"] as const;
const countByReason = z.record(z.string().max(40), z.number().int().nonnegative());
export const SUPPLEMENT_HINTS = ["few_results", "mostly_landscape", "too_generic", "place_unconfirmed_not_mismatch"] as const;
/** Observable facts behind a supplement suggestion; computed by code, never by the model. */
export const searchDiagnosisSchema = z.object({
  rawCount: z.number().int().nonnegative(), duplicateCount: z.number().int().nonnegative(), technicalPassCount: z.number().int().nonnegative(),
  technicalExcluded: countByReason, shownCount: z.number().int().nonnegative(), shortlisted: z.number().int().nonnegative(), rejectedByReason: countByReason,
  evidence: z.object({ subjectMatch: z.number().int().nonnegative(), actionMatch: z.number().int().nonnegative(), placeMatch: z.number().int().nonnegative(), conflicts: z.number().int().nonnegative() }).strict(),
  hints: z.array(z.enum(SUPPLEMENT_HINTS)).max(4),
}).strict();
export const supplementProposalSchema = z.object({
  proposalId: uuid, createdAt: z.string().datetime(), origin: z.enum(["hermes", "human"]), changeReason: z.string().trim().min(1).max(600),
  queries: z.array(strategyQuerySchema).min(1).max(3), diagnosis: searchDiagnosisSchema,
}).strict();
export const sessionQuerySchema = z.object({ text: query, strategy: searchStrategySchema.nullable(), purpose: z.string().max(160).nullable(), batch: z.enum(["initial", "supplement"]), pixabayText: query.optional() }).strict();
export const stockSceneSearchSchema = z.object({
  contract: z.literal("narration-stock-scene-search-v1"), visualId: uuid, scenePlanFingerprint: hash,
  searchPlanFingerprint: hash, sceneSearchKey: hash, frameCount: z.number().int().positive(),
  outcome: z.enum(SEARCH_OUTCOMES), attempts: z.array(searchAttemptSchema).max(40),
  candidates: z.array(stockCandidateSchema).max(90),
  excluded: z.array(z.object({ provider: stockProviderSchema, videoId: providerVideoIdSchema, reasons: z.array(exclusionReasonSchema).min(1) }).strict()).max(400),
  shownCount: z.number().int().nonnegative(), pagesFetched: z.number().int().min(1).max(3), searchedAt: z.string().datetime(),
  /** Session fields are absent in files written before search sessions; such a file is one session without a supplement. */
  sessionId: uuid.optional(), sessionStartedAt: z.string().datetime().optional(),
  sessionQueries: z.array(sessionQuerySchema).max(6).optional(),
  supplement: z.object({ proposal: supplementProposalSchema.nullable(), ranAttemptId: uuid.nullable() }).strict().optional(),
}).strict();

/** One search action (initial batch, supplement batch or next page). Kept apart from results; never holds request URLs. */
export const searchRequestRecordSchema = z.object({
  provider: stockProviderSchema, query, strategy: searchStrategySchema.nullable(), page: z.number().int().positive(),
  status: searchAttemptSchema.shape.status, cacheHit: z.boolean(), networkRequests: z.number().int().min(0).max(1),
  rawCount: z.number().int().nonnegative(), duplicateCount: z.number().int().nonnegative(), technicalPassCount: z.number().int().nonnegative(),
  excludedByReason: countByReason, message: z.string().max(200).nullable(),
}).strict();
export const searchAttemptRecordSchema = z.object({
  attemptId: uuid, sessionId: uuid, kind: z.enum(["initial", "supplement", "next_page"]), parentAttemptId: uuid.nullable(), changeReason: z.string().max(600).nullable(),
  searchPlanFingerprint: hash, searchPlanRevision: z.number().int().positive().optional(), sceneSearchKey: hash, startedAt: z.string().datetime(), finishedAt: z.string().datetime(),
  queries: z.array(z.object({ text: query, strategy: searchStrategySchema.nullable(), purpose: z.string().max(160).nullable(), pixabayText: query.optional() }).strict()).max(6),
  requests: z.array(searchRequestRecordSchema).max(40),
  totals: z.object({ networkRequests: z.number().int().nonnegative(), cacheHits: z.number().int().nonnegative(), rawCount: z.number().int().nonnegative(),
    duplicateCount: z.number().int().nonnegative(), technicalPassCount: z.number().int().nonnegative(), excludedByReason: countByReason }).strict(),
  /** rate_limited stops the whole action at once; notRunRequests counts the planned requests that were therefore not sent. */
  stoppedReason: z.enum(["rate_limited"]).nullable(), notRunRequests: z.number().int().nonnegative(),
}).strict();
export const searchAttemptLogSchema = z.object({
  contract: z.literal("narration-stock-search-attempts-v1"), visualId: uuid, scenePlanFingerprint: hash, attempts: z.array(searchAttemptRecordSchema).max(200),
}).strict();

export const REJECT_REASONS = ["place_culture_mismatch", "subject_action_mismatch", "composition_mismatch", "time_mood_mismatch", "insufficient_motion", "unsuitable_vertical", "already_used", "other"] as const;
export const rejectReasonSchema = z.enum(REJECT_REASONS);
const reviewNote = z.string().trim().max(300).nullable();
/**
 * A reviewer's judgement on one candidate for one scene requirement. It is never a selection or an approval, and it does
 * not travel to other scenes, other requirements or other contents.
 */
export const candidateReviewSchema = z.object({
  provider: stockProviderSchema, videoId: providerVideoIdSchema, requirementKey: hash,
  verdict: z.enum(["shortlist", "reject"]), reason: rejectReasonSchema.nullable(), note: reviewNote, decidedAt: z.string().datetime(), sessionId: uuid.nullable(),
}).strict().refine(r => (r.verdict === "reject") === (r.reason !== null), "맞지 않음에는 사유가 하나 필요합니다.");
export const candidateReviewFileSchema = z.object({
  contract: z.literal("narration-stock-candidate-reviews-v1"), visualId: uuid, scenePlanFingerprint: hash,
  reviews: z.array(candidateReviewSchema).max(400),
  sceneVerdicts: z.array(z.object({ requirementKey: hash, noSuitable: z.literal(true), note: reviewNote, decidedAt: z.string().datetime() }).strict()).max(20),
  history: z.array(z.object({ at: z.string().datetime(), requirementKey: hash, event: z.enum(["shortlist", "reject", "clear", "scene_no_suitable", "scene_clear"]),
    provider: stockProviderSchema.nullable(), videoId: providerVideoIdSchema.nullable(), reason: rejectReasonSchema.nullable(), note: reviewNote }).strict()).max(1000),
}).strict();

const confirmationNote = z.string().trim().max(300);
/**
 * What the reviewer submits. Review fields are optional records, not selection gates. Metadata evidence is copied by the
 * server from the candidate, never taken from the client.
 */
export const placeReviewInputSchema = z.discriminatedUnion("placeRequirement", [
  z.object({ placeRequirement: z.literal("generic_allowed"), misattributionReviewed: z.boolean() }).strict(),
  z.object({ placeRequirement: z.literal("specific_place"), placeName: z.string().min(2).max(120), sourceChecked: z.boolean(),
    evidenceUrl: httpsUrl.nullable(), note: confirmationNote.nullable() }).strict(),
]);
export const placeReviewSchema = z.discriminatedUnion("placeRequirement", [
  z.object({ placeRequirement: z.literal("generic_allowed"), misattributionReviewed: z.boolean() }).strict(),
  z.object({ placeRequirement: z.literal("specific_place"), placeName: z.string().min(2).max(120),
    /** Provider metadata at selection time; null = metadata did not name the place. Not a confirmation. */
    metadataEvidence: metadataPlaceEvidenceSchema.nullable(),
    /** The only confirmation: a person checked this URL. Search queries never count. null = selected without confirmation. */
    humanConfirmation: z.object({ evidenceUrl: httpsUrl, note: confirmationNote, confirmedAt: z.string().datetime() }).strict().nullable() }).strict(),
]);
/** Identity of the video file: stays the same across download-URL refreshes. */
export const stockFileIdentitySchema = stockRenditionSchema.omit({ url: true });
/** Provider facts copied at selection time, so re-searching, cache expiry or search-plan edits cannot change or drop them. */
export const stockSourceSnapshotSchema = z.object({
  pageUrl: httpsUrl, creatorName: z.string().max(200).nullable(), creatorUrl: httpsUrl.nullable(), declaredDurationMs: z.number().int().positive(),
  posterUrl: httpsUrl.nullable(), tags: z.array(z.string().max(80)).max(40), pageSlug: z.string().max(300).nullable(),
  selectedFrom: z.object({ searchPlanFingerprint: hash, sceneSearchKey: hash, searchedAt: z.string().datetime() }).strict(),
  selectedAt: z.string().datetime(),
}).strict();
export const sceneSourceChoiceSchema = z.discriminatedUnion("source", [
  z.object({ visualId: uuid, source: z.literal("image_motion") }).strict(),
  z.object({ visualId: uuid, source: z.literal("stock_video"), provider: stockProviderSchema, videoId: providerVideoIdSchema,
    rendition: stockFileIdentitySchema, snapshot: stockSourceSnapshotSchema,
    /** Source time, not a source frame number: the original may be VFR or not 30fps. */
    startMs: z.number().int().nonnegative().max(3_600_000), placeReview: placeReviewSchema }).strict(),
]);
export const visualSourceSelectionSchema = z.object({
  contract: z.literal("narration-visual-source-selection-v1"), revision: z.number().int().positive(), fingerprint: hash,
  planFingerprint: hash, scenes: z.array(sceneSourceChoiceSchema).min(1).max(16),
}).strict();
/** Refreshable download locations, kept outside the selection fingerprint and the render input. */
export const stockLocatorsSchema = z.record(uuid, z.object({ provider: stockProviderSchema, videoId: providerVideoIdSchema, fileKey: stockRenditionSchema.shape.fileKey,
  downloadUrl: httpsUrl, capturedAt: z.string().datetime() }).strict());

export const STOCK_CLIP_NORMALIZE_CONFIG = {
  version: "stock-clip-normalize-v1", width: 720, height: 1280, fps: 30, fit: "cover_center_crop", maxScale: 1, minRetainedArea: 0.6,
  audio: "dropped", seek: "decoded_input_time", shortSource: "reject", videoCodec: "libx264", crf: 16, preset: "medium", pixelFormat: "yuv420p",
} as const;
export const stockClipConfigSchema = z.object({
  version: z.literal("stock-clip-normalize-v1"), width: z.literal(720), height: z.literal(1280), fps: z.literal(30),
  fit: z.literal("cover_center_crop"), maxScale: z.literal(1), minRetainedArea: z.literal(0.6), audio: z.literal("dropped"),
  seek: z.literal("decoded_input_time"), shortSource: z.literal("reject"), videoCodec: z.literal("libx264"), crf: z.literal(16),
  preset: z.literal("medium"), pixelFormat: z.literal("yuv420p"),
}).strict();
export const stockClipSourceSchema = z.object({
  candidateId: z.string().min(1), planFingerprint: hash, sentenceId: uuid, visualId: uuid,
  startFrame: z.number().int().nonnegative(), endFrame: z.number().int().positive(),
  provider: stockProviderSchema, videoId: providerVideoIdSchema, pageUrl: httpsUrl,
  creatorName: z.string().max(200).nullable(), creatorUrl: httpsUrl.nullable(),
  rendition: stockRenditionSchema.omit({ url: true }), startMs: z.number().int().nonnegative(), placeReview: placeReviewSchema,
}).strict();
export const stockOriginalSchema = z.object({
  relativePath: z.string(), sha256: hash, byteSize: z.number().int().positive(), downloadedAt: z.string().datetime(), downloadHost: z.string().max(200),
  width: z.number().int().positive(), height: z.number().int().positive(), durationMs: z.number().int().positive(), avgFrameRate: z.string().max(40), hadAudio: z.boolean(),
}).strict();
export const stockClipOutputSchema = z.object({
  relativePath: z.string(), sha256: hash, byteSize: z.number().int().positive(), width: z.literal(720), height: z.literal(1280), fps: z.literal(30),
  frameCount: z.number().int().positive(), durationMs: z.number().int().positive(), provenanceRelativePath: z.string(), provenanceSha256: hash,
}).strict();
export const stockClipJobSchema = z.object({
  contract: z.literal("narration-stock-clip-job-v1"), jobId: uuid, inputFingerprint: hash, source: stockClipSourceSchema, config: stockClipConfigSchema,
  /** Latest known download URL; refreshed only for the same provider/videoId/fileKey and kept out of the input fingerprint. */
  downloadUrl: httpsUrl,
  status: z.enum(["queued", "running", "completed", "failed", "stale"]), errorCode: z.string().max(80).nullable(),
  createdAt: z.string().datetime(), startedAt: z.string().datetime().nullable(), heartbeatAt: z.string().datetime().nullable(), completedAt: z.string().datetime().nullable(),
  original: stockOriginalSchema.nullable(), output: stockClipOutputSchema.nullable(),
  approval: z.object({ inputFingerprint: hash, originalSha256: hash, outputSha256: hash, approvedAt: z.string().datetime() }).strict().nullable(),
}).strict();
/** Written next to the normalized clip. Terms fields hold only what the provider documents; the APIs return no per-video license. */
export const stockProvenanceSchema = z.object({
  contract: z.literal("narration-stock-clip-provenance-v1"), jobId: uuid, inputFingerprint: hash,
  provider: stockProviderSchema, videoId: providerVideoIdSchema, creatorName: z.string().max(200).nullable(), creatorUrl: httpsUrl.nullable(), pageUrl: httpsUrl,
  rendition: stockRenditionSchema.omit({ url: true }), downloadedAt: z.string().datetime(), downloadHost: z.string().max(200), originalSha256: hash, originalByteSize: z.number().int().positive(),
  usedRange: z.object({ startMs: z.number().int().nonnegative(), durationMs: z.number().int().positive(), frameCount: z.number().int().positive() }).strict(),
  normalization: stockClipConfigSchema, normalizationFingerprint: hash, resultSha256: hash, placeReview: placeReviewSchema,
  terms: z.object({ providerTermsUrl: httpsUrl, apiTermsUrl: httpsUrl, perVideoLicenseFromApi: z.null() }).strict(),
}).strict();

export const stockRenderAssetSchema = z.object({ sourceKind: z.literal("stock_clip"), visualId: uuid, jobId: uuid, inputFingerprint: hash,
  originalSha256: hash, outputSha256: hash, relativePath: z.string(), frameCount: z.number().int().positive() }).strict();
export const visualSourcesRenderSchema = z.object({ contract: z.literal("narration-visual-source-render-v1"), selectionFingerprint: hash,
  scenes: z.array(z.object({ visualId: uuid, source: z.enum(["image_motion", "stock_video"]) }).strict()).min(1).max(16) }).strict();

const sceneSearchPlanInput = z.array(stockSceneSearchPlanV2Schema).min(1).max(16);
const searchTarget = { expectedPlanFingerprint: hash, expectedSearchPlanFingerprint: hash, visualId: uuid };
export const visualSourceMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("draft-search-plan"), expectedPlanFingerprint: hash, expectedSearchPlanFingerprint: hash.nullable() }).strict(),
  z.object({ action: z.literal("save-search-plan"), expectedPlanFingerprint: hash, expectedSearchPlanFingerprint: hash.nullable(), scenes: sceneSearchPlanInput }).strict(),
  /** newSession: archive the current result and start over; otherwise stored results are returned without calls. */
  z.object({ action: z.literal("search"), ...searchTarget, newSession: z.boolean().optional() }).strict(),
  /** Shows more stored candidates; never contacts a provider. */
  z.object({ action: z.literal("reveal-more"), ...searchTarget }).strict(),
  /** Fetches the next provider page for the session's queries (external requests). */
  z.object({ action: z.literal("fetch-next-page"), ...searchTarget }).strict(),
  z.object({ action: z.literal("propose-supplement"), ...searchTarget }).strict(),
  z.object({ action: z.literal("run-supplement"), ...searchTarget, proposalId: uuid.nullable(), changeReason: z.string().trim().min(1).max(600),
    queries: z.array(strategyQuerySchema).min(1).max(3) }).strict(),
  z.object({ action: z.literal("review-candidate"), expectedPlanFingerprint: hash, visualId: uuid, provider: stockProviderSchema, videoId: providerVideoIdSchema,
    verdict: z.enum(["shortlist", "reject"]), reason: rejectReasonSchema.nullable(), note: reviewNote }).strict(),
  z.object({ action: z.literal("clear-review"), expectedPlanFingerprint: hash, visualId: uuid, provider: stockProviderSchema, videoId: providerVideoIdSchema }).strict(),
  z.object({ action: z.literal("scene-no-suitable"), expectedPlanFingerprint: hash, visualId: uuid, noSuitable: z.boolean(), note: reviewNote }).strict(),
  z.object({ action: z.literal("use-stock"), expectedPlanFingerprint: hash, expectedSelectionFingerprint: hash.nullable(), visualId: uuid,
    provider: stockProviderSchema, videoId: providerVideoIdSchema, startMs: z.number().int().nonnegative().max(3_600_000), placeReview: placeReviewInputSchema }).strict(),
  z.object({ action: z.literal("update-place-review"), expectedPlanFingerprint: hash, expectedSelectionFingerprint: hash, visualId: uuid, placeReview: placeReviewInputSchema }).strict(),
  z.object({ action: z.literal("use-image-motion"), expectedPlanFingerprint: hash, expectedSelectionFingerprint: hash.nullable(), visualId: uuid }).strict(),
  z.object({ action: z.literal("make-clip"), expectedPlanFingerprint: hash, expectedSelectionFingerprint: hash, visualId: uuid }).strict(),
  z.object({ action: z.literal("approve-clip"), expectedPlanFingerprint: hash, expectedSelectionFingerprint: hash, visualId: uuid, jobId: uuid,
    expectedOriginalSha256: hash, expectedOutputSha256: hash }).strict(),
]);
export type StockProvider = z.infer<typeof stockProviderSchema>;
export type StockSceneSearchPlanV1 = z.infer<typeof stockSceneSearchPlanSchema>;
export type StockSceneSearchPlanV2 = z.infer<typeof stockSceneSearchPlanV2Schema>;
export type StockSceneSearchPlan = StockSceneSearchPlanV1 | StockSceneSearchPlanV2;
export type StockSearchPlan = z.infer<typeof stockSearchPlanSchema>;
export type SearchStrategy = z.infer<typeof searchStrategySchema>;
export type StrategyQuery = z.infer<typeof strategyQuerySchema>;
export type SearchAxes = z.infer<typeof searchAxesSchema>;
export type SearchAttemptRecord = z.infer<typeof searchAttemptRecordSchema>;
export type SearchRequestRecord = z.infer<typeof searchRequestRecordSchema>;
export type SearchDiagnosis = z.infer<typeof searchDiagnosisSchema>;
export type SupplementProposal = z.infer<typeof supplementProposalSchema>;
export type CandidateReview = z.infer<typeof candidateReviewSchema>;
export type CandidateReviewFile = z.infer<typeof candidateReviewFileSchema>;
export type RejectReason = z.infer<typeof rejectReasonSchema>;
export type StockRendition = z.infer<typeof stockRenditionSchema>;
export type StockCandidate = z.infer<typeof stockCandidateSchema>;
export type StockSceneSearch = z.infer<typeof stockSceneSearchSchema>;
export type SearchAttempt = z.infer<typeof searchAttemptSchema>;
export type ExclusionReason = z.infer<typeof exclusionReasonSchema>;
export type PlaceReview = z.infer<typeof placeReviewSchema>;
export type PlaceReviewInput = z.infer<typeof placeReviewInputSchema>;
export type StockSourceChoice = Extract<SceneSourceChoice, { source: "stock_video" }>;
export type SceneSourceChoice = z.infer<typeof sceneSourceChoiceSchema>;
export type VisualSourceSelection = z.infer<typeof visualSourceSelectionSchema>;
export type StockClipJob = z.infer<typeof stockClipJobSchema>;
export type StockClipConfig = z.infer<typeof stockClipConfigSchema>;
export type StockProvenance = z.infer<typeof stockProvenanceSchema>;
export type StockRenderAsset = z.infer<typeof stockRenderAssetSchema>;
export type VisualSourcesRender = z.infer<typeof visualSourcesRenderSchema>;
