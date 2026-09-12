import {
  applyAngleQualityGate,
  pickRecommendedAngle,
} from "@/lib/marketing/audienceResearch/angleQuality";
import { externalEvidenceToFindings } from "@/lib/marketing/audienceResearch/external/runExternalResearch";
import type { AcrbGatheredInputs } from "@/lib/marketing/audienceResearch/gatherInputs";
import {
  ACRB_CONTRACT_VERSION,
  AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT,
  type AcrbContentAngle,
  type AcrbResearchFinding,
  type AcrbTypedInsight,
  type AudienceContentResearchBrief,
} from "@/lib/marketing/audienceResearch/contracts";
import {
  buildAcrbId,
  buildAcrbLogicalIdentity,
  buildEvidenceFingerprint,
  clamp01,
} from "@/lib/marketing/audienceResearch/validate";

function insight(
  text: string,
  type: AcrbTypedInsight["type"],
  confidence: number,
  evidenceRefs: string[],
): AcrbTypedInsight {
  return { text, type, confidence: clamp01(confidence), evidenceRefs };
}

function finding(
  id: string,
  text: string,
  type: AcrbResearchFinding["type"],
  confidence: number,
  evidenceRefs: string[],
  sourceClass: AcrbResearchFinding["sourceClass"],
  provenanceNote: string | null,
): AcrbResearchFinding {
  return {
    findingId: id,
    text,
    type,
    confidence: clamp01(confidence),
    evidenceRefs,
    sourceClass,
    provenanceNote,
  };
}

function channelFit(partial: Partial<AcrbContentAngle["channelFit"]>): AcrbContentAngle["channelFit"] {
  return {
    threads: clamp01(partial.threads ?? 0.5),
    naver_blog: clamp01(partial.naver_blog ?? 0.4),
    naver_band: clamp01(partial.naver_band ?? 0.35),
    kakao_channel: clamp01(partial.kakao_channel ?? 0.35),
    shortform: clamp01(partial.shortform ?? 0.55),
    cardnews: clamp01(partial.cardnews ?? 0.4),
  };
}

function topicTokens(title: string, summary: string): string[] {
  return `${title} ${summary}`
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 12);
}

/**
 * Deterministic ACRB skeleton from available agenda/assignment/Meta editorial.
 * Used when LLM is unavailable, and as baseline merged with LLM output.
 */
export function buildDeterministicAcrb(input: {
  gathered: AcrbGatheredInputs;
  now?: Date;
  synthesisMode?: AudienceContentResearchBrief["provenance"]["synthesisMode"];
}): AudienceContentResearchBrief {
  const nowIso = (input.now ?? new Date()).toISOString();
  const { gathered } = input;
  const evidenceRefs = gathered.assignment.evidenceRefs ?? [];
  const evidenceIds = evidenceRefs.map((e) => e.evidenceId);
  const primaryEvidence = evidenceIds.slice(0, 3);
  const fingerprint = buildEvidenceFingerprint(evidenceRefs);
  const preselectionId =
    gathered.selectedAgenda.provenance.researchBriefId ??
    gathered.compactBrief?.researchBriefId ??
    null;
  const logicalIdentity = buildAcrbLogicalIdentity({
    selectedAgendaId: gathered.selectedAgenda.id,
    assignmentId: gathered.assignment.assignmentId,
    evidenceFingerprint: fingerprint,
    preselectionResearchBriefId: preselectionId,
  });

  const editorial = gathered.editorial;
  const officialEvidence = evidenceRefs.some((e) => e.isOfficial);
  const weakSocialOnly =
    evidenceRefs.length > 0 &&
    evidenceRefs.every((e) => !e.isOfficial) &&
    evidenceRefs.every(
      (e) =>
        e.evidenceType === "derived_signal" ||
        e.sourceType === "social" ||
        (e.credibilityHint != null && e.credibilityHint < 0.45),
    );

  const title = gathered.selectedAgenda.title;
  const summary = gathered.selectedAgenda.summary;
  const tokens = topicTokens(title, summary);
  const hasCruise = tokens.some((t) => /크루즈|cruise/i.test(t));
  const hasBusan = tokens.some((t) => /부산|busan/i.test(t));
  const hasChuseok = tokens.some((t) => /추석|연휴/i.test(t));
  const hasBoarding = /탑승|동선|체크|가이드|boarding/i.test(`${title} ${summary}`);

  const findings: AcrbResearchFinding[] = [];
  for (const ref of evidenceRefs.slice(0, 6)) {
    if (!ref.excerpt?.trim()) continue;
    findings.push(
      finding(
        `ev_${ref.evidenceId.slice(0, 8)}`,
        ref.excerpt.trim(),
        ref.isOfficial ? "verified_fact" : "observed_signal",
        ref.isOfficial ? 0.85 : ref.credibilityHint != null ? clamp01(ref.credibilityHint + 0.2) : 0.45,
        [ref.evidenceId],
        ref.isOfficial ? "official" : ref.sourceType === "social" ? "public_social_content" : "derived_signal",
        ref.reference ?? ref.url,
      ),
    );
  }

  if (editorial?.hookSignals?.length) {
    for (const [i, hook] of editorial.hookSignals.slice(0, 3).entries()) {
      findings.push(
        finding(
          `meta_hook_${i + 1}`,
          `Meta hook seed: ${hook}`,
          "observed_signal",
          0.5,
          primaryEvidence,
          "derived_signal",
          "meta_editorial.hookSignals",
        ),
      );
    }
  }

  const personaSeeds = editorial?.personaHints?.filter(Boolean) ?? [];
  const painSeeds = editorial?.audiencePainPoints?.filter(Boolean) ?? [];
  const questionSeeds = editorial?.audienceQuestions?.filter(Boolean) ?? [];
  // Meta contentAngles remain seeds for LLM prompts only — never emitted as wrapper angles.

  const primaryAudience: AcrbTypedInsight[] = [];
  if (personaSeeds.length) {
    for (const persona of personaSeeds.slice(0, 2)) {
      primaryAudience.push(insight(persona, "observed_signal", 0.55, primaryEvidence));
    }
  } else if (hasCruise && hasBusan) {
    primaryAudience.push(
      insight(
        hasChuseok
          ? "부산·경남 거주, 추석 연휴에 부모님/가족과 첫 크루즈를 검토하는 다세대 여행자"
          : "부산·경남에서 출발하는 크루즈를 처음 고려하는 가족·커플 여행자",
        "inference",
        0.55,
        primaryEvidence,
      ),
    );
  } else {
    primaryAudience.push(
      insight(
        `${gathered.assignment.audience || "한국 아웃바운드 여행 고려자"} — 주제: ${title.slice(0, 40)}`,
        "hypothesis",
        0.4,
        primaryEvidence,
      ),
    );
  }

  const anxieties: AcrbTypedInsight[] = [];
  if (painSeeds.length) {
    for (const pain of painSeeds.slice(0, 4)) {
      anxieties.push(insight(pain, "observed_signal", 0.55, primaryEvidence));
    }
  }
  if (hasBoarding) {
    anxieties.push(
      insight(
        "첫 크루즈에서 배 안 시설보다 탑승 직전 동선·수속·짐 처리가 더 막막하다는 불안",
        "inference",
        0.6,
        primaryEvidence,
      ),
    );
  }
  if (hasChuseok) {
    anxieties.push(
      insight(
        "연휴 기간 이동·혼잡·가족 일정 조율 실패에 대한 부담",
        "hypothesis",
        0.5,
        primaryEvidence,
      ),
    );
  }
  if (anxieties.length === 0) {
    anxieties.push(
      insight("주제 관련 실무 정보가 부족한지에 대한 불확실성", "hypothesis", 0.35, primaryEvidence),
    );
  }

  const motivations: AcrbTypedInsight[] = [
    insight(
      hasBusan
        ? "공항 이동 부담을 줄이고 부산항 출발로 여행 진입 장벽을 낮추고 싶음"
        : "실질적으로 도움이 되는 여행 준비 포인트를 미리 알고 싶음",
      hasBusan ? "inference" : "hypothesis",
      0.55,
      primaryEvidence,
    ),
  ];
  const objections: AcrbTypedInsight[] = [
    insight(
      "공개 소셜 관측만으로는 공식 절차·요금·정책을 신뢰하기 어렵다",
      "inference",
      0.65,
      primaryEvidence,
    ),
  ];
  const decisionTriggers: AcrbTypedInsight[] = [
    insight(
      hasBoarding
        ? "탑승 전 체크리스트처럼 ‘무엇을 미리 보면 되는지’가 한눈에 보이면 탐색을 이어감"
        : "구체적 다음 확인 항목이 보이면 관심 유지",
      "hypothesis",
      0.5,
      primaryEvidence,
    ),
  ];

  const questions: AcrbTypedInsight[] = [];
  for (const q of questionSeeds.slice(0, 5)) {
    questions.push(insight(q, "observed_signal", 0.55, primaryEvidence));
  }
  if (hasCruise && hasBusan) {
    const defaults = [
      "부산항 크루즈 탑승 전 동선은 어떻게 확인하나요",
      "첫 크루즈 수하물·보안검색은 공항과 어떻게 다른가요",
      "가족과 함께 탈 때 미리 보면 좋은 포인트는",
    ];
    if (hasChuseok) defaults.unshift("추석 연휴 부산 출발 크루즈 일정은 언제 확정되나요");
    for (const q of defaults) {
      if (!questions.some((item) => item.text === q)) {
        questions.push(insight(q, "hypothesis", 0.45, primaryEvidence));
      }
    }
  }
  if (questions.length === 0) {
    questions.push(insight(`${title} 관련해서 무엇을 미리 확인해야 하나요`, "hypothesis", 0.4, primaryEvidence));
  }

  const queries = questions.slice(0, 5).map((q) =>
    insight(q.text.replace(/\?$/, "").replace(/요$/, ""), "hypothesis", q.confidence, q.evidenceRefs),
  );

  const observedPatterns: AcrbTypedInsight[] = [];
  if (summary.trim()) {
    observedPatterns.push(insight(summary.trim(), "observed_signal", 0.55, primaryEvidence));
  }
  for (const hook of editorial?.hookSignals?.slice(0, 2) ?? []) {
    observedPatterns.push(insight(`반복 훅 패턴: ${hook}`, "observed_signal", 0.5, primaryEvidence));
  }

  const competitorHooks: AcrbTypedInsight[] = (editorial?.hookSignals ?? [])
    .slice(0, 3)
    .map((hook, i) => insight(hook, "observed_signal", 0.5, primaryEvidence));

  const saturatedAngles: AcrbTypedInsight[] = [];
  if (gathered.nearDuplicate || gathered.cooledIdentity) {
    saturatedAngles.push(
      insight(
        "최근 내부 콘텐츠/쿨다운과 주제가 강하게 겹침 — 동일 각도 재사용은 포화 위험",
        "inference",
        0.7,
        primaryEvidence,
      ),
    );
  }
  for (const match of gathered.historicalMatches.slice(0, 3)) {
    if (match.similarityHint >= 0.6) {
      saturatedAngles.push(
        insight(
          `최근 유사 후보: ${match.title}`,
          "observed_signal",
          match.similarityHint,
          primaryEvidence,
        ),
      );
    }
  }

  const contentGaps: AcrbTypedInsight[] = [];
  if (hasBoarding && weakSocialOnly) {
    contentGaps.push(
      insight(
        "‘관측됐다’ 수준의 재진술이 아니라, 탑승 직전 불안을 다루는 체크리스트형 각도가 비어 있음(단, 공식 절차 단정 금지)",
        "inference",
        0.6,
        primaryEvidence,
      ),
    );
  }
  for (const q of questions.slice(0, 3)) {
    contentGaps.push(
      insight(`미답변성 질문 후보: ${q.text}`, q.type, q.confidence, q.evidenceRefs),
    );
  }
  if (contentGaps.length === 0 && !gathered.nearDuplicate) {
    contentGaps.push(
      insight("현재 증거만으로는 새로운 실용 각도를 특정하기 어려움", "hypothesis", 0.3, primaryEvidence),
    );
  }

  const angles: AcrbContentAngle[] = [];
  const pushAngle = (partial: Omit<AcrbContentAngle, "angleId"> & { angleId?: string }) => {
    angles.push({
      angleId: partial.angleId ?? `angle_${angles.length + 1}`,
      ...partial,
    });
  };

  // Meta seeds become inputs — re-evaluate into strategic angles.
  if (hasBoarding) {
    pushAngle({
      angle: "첫 크루즈, 배 안보다 탑승 직전이 더 헷갈린다",
      hook: "첫 크루즈에서 가장 헷갈리는 순간은 배 안보다 탑승 직전이라는 긴장",
      audienceTension: "동선·수속·짐에 대한 막연한 불안 vs 공식 세부 정보 부재",
      interestScore: 0.78,
      noveltyScore: gathered.nearDuplicate ? 0.25 : 0.7,
      evidenceStrength: weakSocialOnly ? 0.35 : officialEvidence ? 0.7 : 0.45,
      channelFit: channelFit({ threads: 0.82, shortform: 0.8, naver_blog: 0.55, cardnews: 0.6 }),
      rationale: "관측 신호의 ‘탑승 동선’을 재진술하지 않고 관객 긴장으로 재구성",
      supportingFindingRefs: findings.slice(0, 2).map((f) => f.findingId),
      limitations: [
        "터미널·시간·수하물 규정 등 공식 사실은 현재 증거로 단정 불가",
        "가설/추론을 사실처럼 쓰면 안 됨",
      ],
    });
  }

  if (hasBusan && hasCruise) {
    pushAngle({
      angle: "공항 대신 부산항 — 이동 부담을 줄이려는 가족의 선택 기준",
      hook: "비행기보다 가까운 출발이 끌릴 때, 가족이 먼저 확인하는 것",
      audienceTension: "접근성 매력 vs 크루즈 초보 정보 공백",
      interestScore: 0.72,
      noveltyScore: gathered.nearDuplicate ? 0.3 : 0.65,
      evidenceStrength: weakSocialOnly ? 0.35 : 0.5,
      channelFit: channelFit({ threads: 0.7, naver_blog: 0.75, naver_band: 0.55, shortform: 0.6 }),
      rationale: "부산 출발 맥락을 지역·가족 이동 심리로 확장",
      supportingFindingRefs: findings.slice(0, 2).map((f) => f.findingId),
      limitations: ["선사/스케줄 확정 사실은 미확보"],
    });
  }

  if (hasChuseok) {
    pushAngle({
      angle: "추석 연휴 크루즈를 볼 때 가족 일정 조율이 먼저다",
      hook: "연휴 크루즈 관심은 ‘배’보다 ‘누가 언제 움직일 수 있나’에서 시작",
      audienceTension: "연휴 관심 상승 vs 일정·혼잡 불확실",
      interestScore: 0.68,
      noveltyScore: 0.55,
      evidenceStrength: 0.35,
      channelFit: channelFit({ threads: 0.65, kakao_channel: 0.55, naver_band: 0.6, shortform: 0.55 }),
      rationale: "시즌성(추석)을 의사결정 트리거로 사용",
      supportingFindingRefs: findings.slice(0, 1).map((f) => f.findingId),
      limitations: ["연휴 수요는 가설 비중 큼"],
    });
  }

  // Meta contentAngles are seeds only — never emit placeholder "시드 재평가:" wrappers.
  // Prefer tension-bearing angles already built above; pad with safe fallbacks below.

  if (angles.length < 3 && !gathered.nearDuplicate) {
    pushAngle({
      angle: "공개 후기에서 건질 포인트만 고르는 법",
      hook: "소셜에 떠다니는 여행 정보, 어디까지를 ‘참고’로 둘까",
      audienceTension: "유용해 보이는 관측 vs 검증되지 않은 세부",
      interestScore: 0.6,
      noveltyScore: 0.5,
      evidenceStrength: 0.4,
      channelFit: channelFit({ threads: 0.75, shortform: 0.65, naver_blog: 0.5 }),
      rationale: "약한 증거에서도 가능한 안전한 전략 각도",
      supportingFindingRefs: findings.slice(0, 1).map((f) => f.findingId),
      limitations: ["실용 디테일 단정 금지"],
    });
  }

  while (angles.length > 5) angles.pop();

  const external = gathered.externalResearch;
  const externalUsed = Boolean(external?.available && (external.queryCount > 0 || external.evidence.length > 0));

  if (externalUsed && external) {
    for (const f of externalEvidenceToFindings(external)) {
      findings.push({
        findingId: f.findingId,
        text: f.text,
        type: f.type,
        confidence: f.confidence,
        evidenceRefs: f.evidenceRefs,
        sourceClass: f.sourceClass,
        provenanceNote: f.provenanceNote,
      });
    }
    for (const q of external.observedAudienceQuestions.slice(0, 4)) {
      if (!questions.some((item) => item.text === q)) {
        questions.push(insight(q, "observed_signal", 0.5, [external.evidence[0]?.evidenceId].filter(Boolean) as string[]));
      }
    }
    for (const hook of external.observedCompetitorHooks.slice(0, 4)) {
      competitorHooks.push(insight(hook, "observed_signal", 0.45, []));
    }
    if (external.officialSourceCount === 0) {
      contentGaps.push(
        insight(
          "조사 표본에서 시설/후기형 콘텐츠는 보이지만, 공식 탑승·터미널 안내를 충분히 확인하지 못함(표본 한정)",
          "inference",
          0.55,
          [],
        ),
      );
    }
    if (external.socialCommunitySourceCount > 0) {
      anxieties.push(
        insight(
          "공개 후기/커뮤니티 표본에서 탑승·준비 관련 질문이 반복되는 패턴이 관측됨",
          "observed_signal",
          0.55,
          external.evidence.slice(0, 2).map((e) => e.evidenceId),
        ),
      );
    }
  }

  const gatedAngles = applyAngleQualityGate(angles);

  const limitations: string[] = [
    ...(externalUsed
      ? []
      : ["외부 웹검색 미사용 또는 비활성 — 공식 선사/터미널 세부 미확인"]),
    ...(external?.limitations ?? []),
    ...(weakSocialOnly && !(external && external.officialSourceCount > 0)
      ? ["증거 대부분이 비공식 derived_signal/social — verified_fact 승격 금지"]
      : []),
    ...(gathered.semanticAvailable
      ? []
      : ["시맨틱 검색 미사용 또는 실패 — novelty는 lexical/history 기반"]),
    ...(editorial
      ? []
      : ["Meta editorialIntelligence 미로드 — audience/angle seed 제한적"]),
  ];

  const hasExternalVerified = findings.some((f) => f.type === "verified_fact" && f.findingId.startsWith("ext_"));
  const officialResolved =
    Boolean(external && external.officialSourceCount > 0 && hasExternalVerified) || officialEvidence;

  let researchVerdict: AudienceContentResearchBrief["researchVerdict"] = "PROCEED_WITH_CAUTION";
  const verdictReasons: AudienceContentResearchBrief["verdictReasons"] = [];

  if (gathered.nearDuplicate || gathered.cooledIdentity) {
    researchVerdict = "SKIP";
    verdictReasons.push("near_duplicate_recent");
    if (contentGaps.every((g) => g.confidence < 0.7)) {
      verdictReasons.push("no_useful_content_gap");
    }
  } else if (evidenceRefs.length === 0 && !(external && external.evidence.length > 0)) {
    researchVerdict = "SKIP";
    verdictReasons.push("insufficient_evidence", "research_failed_unavailable");
  } else if (gatedAngles.length === 0) {
    researchVerdict = "SKIP";
    verdictReasons.push("no_credible_takeaway", "saturated_only");
  } else if (officialResolved && gatedAngles.length > 0 && contentGaps.some((g) => g.confidence >= 0.5)) {
    researchVerdict = "PROCEED";
    verdictReasons.push("angles_available", "useful_audience_tension");
  } else if (weakSocialOnly || !officialResolved) {
    researchVerdict = "PROCEED_WITH_CAUTION";
    verdictReasons.push("limited_source_coverage", "weak_unofficial_evidence", "useful_audience_tension");
    if (gatedAngles.length) verdictReasons.push("angles_available");
  } else {
    researchVerdict = "PROCEED";
    verdictReasons.push("angles_available", "useful_audience_tension");
  }

  const recommended =
    researchVerdict === "SKIP" ? null : pickRecommendedAngle(gatedAngles);

  const metaEditorial = Boolean(editorial);
  const researchStatus: AudienceContentResearchBrief["researchStatus"] =
    input.synthesisMode === "llm" && (metaEditorial || externalUsed)
      ? externalUsed && officialResolved
        ? "complete"
        : "partial"
      : "partial";

  return {
    contract: AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT,
    version: ACRB_CONTRACT_VERSION,
    id: buildAcrbId(logicalIdentity),
    logicalIdentity,
    generatedAt: nowIso,
    selectedAgendaId: gathered.selectedAgenda.id,
    assignmentId: gathered.assignment.assignmentId,
    researchStatus,
    sourceCoverage: {
      assignmentEvidence: evidenceRefs.length > 0,
      metaEditorial,
      internalResearchSignals: Boolean(gathered.compactBrief || gathered.fullResearchBrief),
      semanticRetrieval: gathered.semanticAvailable,
      historicalContent: gathered.historicalMatches.length > 0,
      externalWebSearch: externalUsed,
      notes: [
        ...(metaEditorial ? ["meta_editorial_seeds_used"] : ["meta_editorial_missing"]),
        ...(gathered.nearDuplicate ? ["near_duplicate_risk"] : []),
        ...(externalUsed
          ? [`external_provider:${external?.providerId ?? "unknown"}`]
          : ["external_web_search_unavailable"]),
      ],
    },
    audience: {
      primary: primaryAudience,
      secondary: personaSeeds.slice(2, 4).map((p) => insight(p, "observed_signal", 0.45, primaryEvidence)),
      motivations,
      anxieties,
      objections,
      decisionTriggers,
    },
    searchIntent: {
      primaryIntent: hasBoarding ? "planning" : "informational",
      secondaryIntents: hasCruise ? ["problem_solving", "comparison"] : ["planning"],
      queries: [
        ...queries,
        ...((external?.queries ?? []).slice(0, 4).map((q) => insight(q, "hypothesis", 0.4, []))),
      ].slice(0, 10),
      questions,
    },
    marketSignals: {
      observedPatterns,
      competitorHooks,
      saturatedAngles,
      contentGaps,
    },
    researchFindings: findings,
    contentAngles: gatedAngles,
    recommendedAngleId: recommended?.angleId ?? null,
    recommendedAngleReason: recommended
      ? [
          `why:${recommended.rationale.slice(0, 120)}`,
          `tension:${recommended.audienceTension.slice(0, 80)}`,
          `interest=${recommended.interestScore.toFixed(2)}`,
          `novelty=${recommended.noveltyScore.toFixed(2)}`,
          `evidence=${recommended.evidenceStrength.toFixed(2)}`,
        ].join(" | ")
      : null,
    researchVerdict,
    verdictReasons,
    limitations: [...new Set(limitations)].slice(0, 16),
    provenance: {
      preselectionResearchBriefId: preselectionId,
      agendaCandidateId:
        gathered.selectedAgenda.provenance.agendaCandidateId ??
        gathered.compactCandidate?.agendaCandidateId ??
        null,
      evidenceFingerprint: fingerprint,
      synthesisMode: input.synthesisMode ?? "deterministic_fallback",
      documentCount:
        evidenceRefs.length +
        (editorial ? 1 : 0) +
        gathered.historicalMatches.length +
        (external?.fetchedDocumentCount ?? 0),
      queryCount: externalUsed ? (external?.queryCount ?? 0) : 0,
      semanticUsed: gathered.semanticAvailable,
      historicalMatchCount: gathered.historicalMatches.length,
      externalResearchUsed: externalUsed,
      searchProvider: externalUsed ? (external?.providerId ?? null) : (external?.providerId ?? "disabled"),
      externalResultCount: external?.resultCount ?? 0,
      fetchedDocumentCount: external?.fetchedDocumentCount ?? 0,
      totalFetchedBytes: external?.totalFetchedBytes ?? 0,
      externalResearchRuntimeMs: external?.runtimeMs ?? 0,
      officialSourceCount: external?.officialSourceCount ?? 0,
      socialCommunitySourceCount: external?.socialCommunitySourceCount ?? 0,
    },
  };
}
