# Research Quality Calibration — Semantic Dedup L3 & Scoring (STEP 3-3)

> **Read-only intelligence.** No Marketing Manager integration. No publication side effects.

**Executed:** 2026-09-02  
**Code:** `src/lib/marketing/research/services/semantic*.ts`, `scoringPolicy.ts`, `corroborationScorer.ts`, `noveltyScorer.ts`  
**Migration:** `supabase/migrations/20260902143000_research_quality_scoring.sql`  
**Report script:** `scripts/research-quality-report.ts`

---

## 1. Purpose

STEP 3-3 connects BGE-M3-based **L3 semantic dedup / clustering foundation** to the Research Intelligence pipeline and calibrates **research ranking quality** on real and synthetic fixtures.

Research still answers: *What is happening and how strong is the evidence?*  
Marketing Manager final agenda selection remains out of scope.

---

## 2. Semantic stack reuse (no new embedding system)

| Component | Location | Reuse |
|---|---|---|
| Embedding provider | `@/lib/marketing/semantic/embeddingProvider` | BGE-M3 client |
| Provider interface | `@/lib/marketing/semantic/types` | `EmbeddingProvider` |
| Vector similarity | `cosineSimilarity.ts` | Same convention as retrieval stack |
| pgvector / cache | Existing semantic/retrieval infra | Not duplicated |

**Adapter:** `runSemanticDedup()` in `semanticDeduplicator.ts` wraps the existing provider. Tests use `createDeterministicEmbeddingProvider()` — not a production model.

---

## 3. Semantic text representation

`buildSemanticResearchText(signal)` produces deterministic embedding input:

```
type:{signalType}
title:{normalized title}
summary:{normalized summary}
dest:{destinations}
topics:{topics}
entities:{entities}
```

Raw article bodies are **not** embedded. Source boilerplate is excluded.

---

## 4. Candidate prefilter (before cosine compare)

Not all signal pairs are compared. Eligibility requires:

- Different signal IDs
- **Signal type compatibility** (`signalTypeCompatibility.ts` groups)
- Destination **or** topic overlap
- Published/observed anchor within **30 days**

`enumerateSemanticCandidatePairs()` yields candidate pairs only.

---

## 5. Threshold policy

`SemanticDedupPolicy` (not magic numbers inline):

| Field | Default | Role |
|---|---|---|
| `candidateThreshold` | 0.72 | Minimum similarity to track |
| `uncertainThreshold` | 0.82 | Link-only band |
| `mergeThreshold` | 0.88 | Auto-merge when guards pass |
| `strongMergeThreshold` | 0.93 | Strong merge even with weaker temporal overlap |
| `maxTimeSensitiveAgeHours` | 72 | Weather/airfare/festival temporal guard |

**Philosophy:** precision over recall. False merges are worse than missed duplicates.

`resolveDuplicateDecision()` maps similarity → `merge | link | distinct`.

---

## 6. False-positive protections

Beyond cosine similarity, `passesSemanticMergeGuards()` blocks:

| Case | Guard |
|---|---|
| Same destination, different event | Signal type incompatibility |
| Weather vs airfare same destination | Type group mismatch |
| Festival different year | `year_mismatch` |
| Weather/airfare different forecast window | `temporal_gap_*h` |
| Visa vs tourism promotion | `visa_vs_promotion_boundary` |
| No shared destination/topic | `no_destination_or_topic_overlap` |

Merge blocked by guard downgrades to `link` or `distinct` unless `strongMergeThreshold` met.

---

## 7. Cluster model (service-level, no new table)

**Decision:** No `research_clusters` DB table for MVP. Clusters are **in-memory / pipeline artifacts**:

```typescript
ResearchCluster {
  id, primarySignalId, signalIds[], clusterType?, createdAt, updatedAt
}
```

Persisted indirectly via:

- `research_briefs.cluster_id`
- `research_briefs.corroboration` (JSON)
- `duplicateOfSignalId` on merged signals

Rationale: avoids schema churn; cluster is derivable from merge groups + brief linkage.

---

## 8. Primary signal selection

Within a cluster, `selectPrimarySignal()` priority:

1. Official / primary source (`isOfficial`, `official_government`)
2. Higher credibility score
3. Earlier `publishedAt`
4. Richer provenance (evidence count)

Secondary sources are **not deleted** — they remain as corroboration evidence on the brief.

---

## 9. Source diversity / corroboration

`scoreCorroboration()` features:

- `sourceDiversityCount` — distinct `sourceId`
- `independentSourceCount` — distinct source family (`provider:sourceType`)
- `corroborationScore` — 0–1 composite

Bonuses:

- Multi-source observation
- Independent source families
- Official + news corroboration

Penalty:

- **Syndicated family** — many `sourceId` but one family (wire copy)

---

## 10. Credibility integration

Semantic clusters feed brief-level corroboration. Credibility scorer (STEP 3-1) unchanged; cluster corroboration is a **separate feature** on `ResearchBrief.corroboration` and `AgendaCandidate.corroborationScore`.

Community-only multi-source ≠ high credibility automatically.

---

## 11. Novelty / duplication penalty

`scoreNovelty()` foundation:

- Within-cycle topic repetition vs prior briefs in same pipeline run
- Penalty applied to `researchScoreComponents.novelty`
- Risk flag `topic_repetition` when penalty ≥ 0.3

No long-term fatigue model in STEP 3-3.

---

## 12. Scoring calibration

### Previous weights (STEP 3-1/3-2 audit)

```
freshness 0.20, credibility 0.25, relevance 0.25,
publicInterest 0.15, commercial 0.10, seasonality 0.05
```

### Calibrated weights (STEP 3-3)

```
freshness 0.18, credibility 0.22, travelRelevance 0.22,
publicInterest 0.14, corroboration 0.08, novelty 0.07,
seasonality 0.04, commercial 0.05
```

**Commercial guardrail:** `commercial` capped at **0.05** — bonus only. High-interest, no-product topics can rank above low-value product-linked signals.

### Explainability

Each `AgendaCandidate` carries:

- `researchScoreComponents` — all dimension scores
- `scoreReasons` — top 4 components (deterministic sort)
- `compositeResearchScore` — weighted sum, clamped 0–1

---

## 13. Public interest limitations

`publicInterest` remains a **deterministic heuristic** from available metadata (signal type, destination breadth, urgency keywords). No Google Trends / external trend API in STEP 3-3.

Interface remains open for future `TrendSignalAdapter`.

---

## 14. Calibration dataset

Engineering fixture in `semanticCalibrationFixtures.ts`:

- 3 labeled pair categories: `same_event`, `related_but_distinct`, `unrelated`
- Synthetic hard cases in `semanticCalibration.test.ts`
- Real data: replay via `RESEARCH_USE_SUPABASE=true` in quality report script (read-only)

Labels are for engineering calibration, not ML training.

---

## 15. Semantic evaluation metrics

`evaluateSemanticCalibration()` computes:

- `trueMerge`, `falseMerge`, `missedDuplicate`
- `precision`, `recall`, `F1`

**MVP priority:** precision ≥ 0.99, `falseMerge = 0` on fixture set.

---

## 16. BGE-M3 failure behavior

| Condition | Pipeline behavior |
|---|---|
| Provider null | L3 skipped, `statusReason: embedding_provider_unavailable` |
| embedMany throws | L3 degraded, L1/L2 preserved, pipeline continues |
| Single signal | `insufficient_signals`, no semantic compare |

Silent fallback is forbidden — metrics record status + reason.

---

## 17. Performance / batching

- One embedding per unique signal text
- `embedMany` in batches of 50 (`EMBED_BATCH_SIZE`)
- Pair comparisons only on prefiltered candidates — not O(N²) embeddings

---

## 18. Observability

`SemanticDedupMetrics`:

```
signalsInput, candidatePairs, comparisons, merges, uncertainLinks,
serviceFailures, clusters, avgClusterSize, status, statusReason
```

Raw article bodies are not logged.

---

## 19. ResearchBrief changes

`buildResearchBriefFromCluster()`:

- One cluster → one brief
- Primary signal drives title/summary
- Evidence union from all cluster members (not flattened/deleted)
- `corroboration` assessment attached

---

## 20. Persistence changes

New migration `20260902143000_research_quality_scoring.sql`:

- `research_briefs.cluster_id`, `research_briefs.corroboration`
- `agenda_candidates.corroboration_score`, `research_score_components`, `score_reasons`

Prior applied migration **not modified**.

---

## 21. Quality gate checklist

| Check | Expected |
|---|---|
| Same event, different headline | Merge |
| Official + news same event | One brief, corroboration bonus |
| Same destination, different event | No merge |
| Productless high-value topic | Ranks above stale commercial |
| Official urgent restriction | Top rank band |
| Low credibility rumor | Penalized + risk flag |
| Syndicated copies | Not overcounted as independent |
| Provenance | Evidence preserved on brief |

Run: `npx tsx scripts/research-quality-report.ts`

---

## 22. Known limitations

- L3 depends on BGE-M3 availability; degraded mode skips semantic merge
- Public interest is heuristic-only
- Cluster IDs not stored on signals (only brief + duplicate links)
- No MM consumption path (STEP 3-4)
- Calibration fixture is small; production threshold tuning needs ongoing real-data review

---

## 23. Architecture boundary (unchanged)

```
Research Intelligence → ResearchBrief / AgendaCandidate (ranked input)
Marketing Manager     → selectedForToday / final priority (future)
```

High research score ≠ auto-selected agenda.
