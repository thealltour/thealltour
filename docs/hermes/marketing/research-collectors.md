# Research Collectors — MVP (STEP 3-2)

> Read-only external source collection for Research Intelligence.  
> **No Hermes Bot. No MM integration. No publication side effects.**

**Executed:** 2026-09-02  
**Code:** `src/lib/marketing/research/collectors/`, `src/lib/marketing/research/collection/`  
**Persistence:** `src/lib/marketing/research/repository/supabaseResearchRepository.ts`

---

## 1. Chosen MVP sources

| # | Source | Type | Feed | Auth | Why chosen |
|---|---|---|---|---|---|
| A | **UK FCDO Foreign Travel Advice** | `official_government` | `https://www.gov.uk/foreign-travel-advice.atom` | None | Stable Atom feed, official travel advisory, canonical URLs, publishedAt |
| B | **NYT Travel RSS** | `news` | `https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml` | None | Stable public RSS, travel-focused, direct article URLs |

### Rejected candidates

| Source | Reason |
|---|---|
| BBC Travel RSS (`feeds.bbci.co.uk/news/travel/rss.xml`) | 404 at audit time |
| CDC Travel Notices RSS | 404 at audit time |
| JNTO / japan.travel RSS | 301→404; feed URL unstable |
| The Guardian Travel | 302 redirect chain; less deterministic |
| Travel Weekly RSS | 403 without agreement |
| Paid news/trends APIs | Out of MVP scope (no paid signup prerequisite) |
| HTML scraping | Fragile; deferred unless RSS unavailable |

---

## 2. Collector architecture

```
ResearchCollector.collect()
  → RawResearchItem[]
  → mapRawResearchItemToSignalInput()
  → runResearchPipeline()
  → ResearchBrief / AgendaCandidate
```

Collectors do **not** build briefs or agenda candidates directly.

Implemented collectors:

- `uk-gov-travel-advice` — official Atom → `official_statement` evidence
- `nyt-travel-rss` — news RSS → `direct_source` evidence

---

## 3. Source credibility assumptions

- UK Gov: high authority baseline via `defaultCredibility=0.88`, `authorityLevel=official`, but **content is not auto-truth** — deterministic scorer still applies.
- NYT Travel: secondary news baseline `defaultCredibility=0.62`; conservative claim from source excerpt only.
- No LLM parsing or claim fabrication in collectors.

---

## 4. HTTP / retry model

`fetchResearchDocument()` (`collectors/httpClient.ts`):

| Behavior | Policy |
|---|---|
| Timeout | 15s default |
| Max body | 1MB |
| User-Agent | `TheallTourBot/1.0 (+https://thealltour.com; research-readonly)` |
| 4xx (except 429) | Fail fast |
| 429 / 5xx / network | Bounded retry (max 2) |
| Collector failure | Isolated — other collectors continue |

---

## 5. Persistence

Migration: `supabase/migrations/20260902101500_research_intelligence_schema.sql`

- Tables: `research_sources`, `research_signals`, `research_evidence`, `research_briefs`, `research_brief_signals`, `agenda_candidates`
- Dedup: unique `raw_fingerprint`, index on `normalized_fingerprint`, partial unique `(source_id, external_id)`
- RLS: service_role only (matches social persistence pattern)
- **No credentials stored**

Repository: `SupabaseResearchRepository` + `createResearchRepository()` factory.

---

## 6. Idempotency

Signal upsert keys:

1. `raw_fingerprint` (primary)
2. `normalized_fingerprint` (lookup)
3. `source_id + external_id` (DB index)

Second collection of the same feed item updates `observed_at` and merges evidence — no unbounded duplicate rows.

---

## 7. Brief grouping (MVP)

- Group eligible signals by first destination or `signalType`
- L1/L2 dedup within pipeline batch
- **No semantic/BGE-M3 clustering** (STEP 3-3)

---

## 8. Environment

| Variable | Default | Purpose |
|---|---|---|
| `RESEARCH_COLLECTION_ENABLED` | unset → enabled in dev script | Master switch |
| `RESEARCH_UK_GOV_TRAVEL_ADVICE_ENABLED` | true unless `false` | Collector toggle |
| `RESEARCH_NYT_TRAVEL_RSS_ENABLED` | true unless `false` | Collector toggle |
| `RESEARCH_USE_SUPABASE` | false in script | Use Supabase repo vs in-memory |

Public feeds require **no secrets**.

---

## 9. Real-run result (2026-09-02)

Command: `RESEARCH_COLLECTION_ENABLED=true npx tsx scripts/research-collection-run.ts`

| Metric | Result |
|---|---|
| UK Gov observed / accepted | 15 / 15 |
| NYT observed / accepted | 15 / 15 |
| Pipeline accepted | 30 |
| Rejected | 0 |
| Duplicates (first run) | 0 |
| Briefs | 20 |
| Agenda candidates | 20 |
| Cycle status | `success` |

Sample signals preserved source URLs and conservative summaries (no fabricated claims observed).

---

## 10. Known limitations

- Semantic dedup L3 requires BGE-M3 availability; pipeline degrades to L1/L2 when unavailable
- Supabase quality-scoring columns require migration `20260902143000_research_quality_scoring.sql` (apply via `supabase db push`)
- MM workflow not connected (by design — STEP 3-4)
- English-only sources in MVP
- Public interest remains heuristic-only (no Trends API)

---

## 11. Pipeline integration (STEP 3-3)

Collection cycle now runs:

```
collect → normalize → enrich → L1/L2 dedup → L3 semantic dedup → cluster briefs → ranked AgendaCandidates
```

- Semantic adapter: `runSemanticDedup()` reuses `@/lib/marketing/semantic/embeddingProvider`
- Quality report: `npx tsx scripts/research-quality-report.ts`
- Calibration docs: `research-quality-calibration.md`

---

## 12. Next STEP (3-4)

- Marketing Manager context/MCP consumption path
- Final agenda selection remains MM-owned
