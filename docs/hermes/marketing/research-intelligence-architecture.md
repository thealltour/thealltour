# Research Intelligence — Architecture & Domain Model (STEP 3-1)

> **Capability layer, not a fifth Hermes Bot by default.**  
> Runtime migration (C10 COMPLETE) is unchanged. No Hermes profile edits in this STEP.

**Executed:** 2026-09-02  
**Code:** `src/lib/marketing/research/`  
**Migration:** `supabase/migrations/20260902101500_research_intelligence_schema.sql`

---

## 1. Purpose

Research Intelligence answers:

> **What meaningful travel-related signals exist in the external world and internal assets right now?**

It structures signals with evidence, freshness, credibility, and travel relevance — then produces **ResearchBrief** and **AgendaCandidate** inputs for Marketing Manager. It does **not** select final agenda, draft content, approve governance, or publish.

---

## 2. Responsibility boundary

| Owns | Does NOT own |
|---|---|
| Source discovery / input normalization | Final agenda selection |
| Signal ingestion & enrichment | Content priority decision |
| Evidence / provenance | Content drafting / copywriting |
| Freshness / credibility / relevance metadata | Governance approval |
| Deduplication foundation | Human Approval |
| Topic / entity normalization | Publication / SNS mutation |
| ResearchBrief construction | Campaign execution |
| AgendaCandidate **input** foundation | |

**Invariant:** Research reports *what is happening*; Marketing Manager decides *what to do*.

---

## 3. Existing Bot ownership (unchanged)

| Bot | Role |
|---|---|
| **Marketing Manager** | Agenda selection, specialist coordination, interprets research |
| **Content Strategist** | Expression, format, draft strategy |
| **Governance Auditor** | Factuality / policy review |
| **Performance Analyst** | Measurement, feedback, memory |

Research Intelligence is consumed by MM (deterministic service first; optional future Bot — see §16).

---

## 4. Research pipeline (target)

```
External + Internal + Performance Sources
  → Raw Research Inputs
  → Normalizer
  → ResearchSignal[]
  → Evidence validation
  → Freshness / credibility / relevance enrichment
  → Deduplication / clustering
  → ResearchBrief[]
  → AgendaCandidate[]
  → Marketing Manager
```

**STEP 3-1:** Domain + deterministic foundations + in-memory pipeline. **No** live web collectors.

---

## 5. External vs internal signals

| Class | Examples | `ResearchSourceType` |
|---|---|---|
| External official | tourism boards, government visa | `official_government`, `tourism_board` |
| External industry | airlines, hotels, news | `airline`, `travel_industry`, `news` |
| External ambient | weather, FX, trends | `weather`, `fx`, `search_trend` |
| Internal | products, site content, retrieval corpus | `internal_product`, `internal_content` |
| Performance-derived | snapshots, fatigue memory | `performance_memory` |

Internal adapters reuse **existing Retrieval / BGE-M3 / pgvector** (`src/lib/marketing/retrieval/`, `semantic/`) — no new embedding stack.

---

## 6. Evidence / provenance model

Every **claim-bearing** signal carries `ResearchEvidence[]` with traceable `sourceId`, optional `url`, `evidenceType`, and timestamps.

| `evidenceType` | Meaning |
|---|---|
| `direct_source` | Primary document / page |
| `official_statement` | Issued by authority |
| `search_result` | Retrieved via search API (future) |
| `internal_record` | DB / catalog row |
| `structured_api` | Machine-readable feed |
| `derived_signal` | Computed from other signals (must reference upstream) |

**LLM-generated summary** is stored separately from **source-derived claims** (`claimSource: "source" | "derived" | "llm_summary"` on signal).

Signals without sufficient provenance are **rejected**, not silently promoted.

---

## 7. Freshness model

Not pure `publishedAt` sort. Each signal carries:

```typescript
FreshnessMetadata {
  publishedAt?, observedAt, expiresAt?, halfLifeHours?, freshnessScore?
}
```

Signal-type half-lives (heuristic, calibrate later):

| Signal type | Typical half-life |
|---|---|
| `disruption`, `safety` | 6–24h |
| `weather`, `airfare`, `exchange_rate` | 24–72h |
| `visa`, `policy_change`, `entry_requirement` | weeks–months |
| `festival`, `event` | until `expiresAt` |
| `internal_product` | long / evergreen |

---

## 8. Credibility model

Deterministic policy — **LLM does not finalize credibility**.

`CredibilityAssessment { score, level, reasons[] }` where `level ∈ high | medium | low | unknown`.

Factors: official source type, primary vs secondary evidence, authority level on `ResearchSource`, corroboration count, provenance completeness.

---

## 9. Deduplication model

| Level | Mechanism |
|---|---|
| L1 | Exact `canonicalUrl` or `externalId` |
| L2 | `normalizedFingerprint` (title + claim + geography hash) |
| L3 | **BGE-M3 semantic similarity** — `runSemanticDedup()` with prefilter + guards (STEP 3-3) |

Duplicates link via `duplicateOfSignalId`; primary signal retains enriched scores. Same-event clusters produce one **ResearchBrief** with corroboration metadata.

See `research-quality-calibration.md` for threshold policy and false-positive guards.

---

## 10. Topic / entity normalization

Signals carry `topics[]`, `destinations[]`, `entities[]` (ISO-ish destination codes / normalized slugs). Normalizer lowercases, trims, dedupes arrays — no LLM required for MVP.

---

## 11. ResearchBrief role

Aggregated, evidence-preserving research unit — **not** a content draft.

**Forbidden on ResearchBrief:** caption, hook, CTA, hashtags, channel copy.

Contains: `signalIds[]`, merged claims/evidence, assessment snapshots, `risks[]`, `openQuestions[]`.

---

## 12. AgendaCandidate boundary

Handoff artifact for Marketing Manager — **not** final agenda.

**Forbidden fields:** `selectedForToday`, `finalPriority`, `publishDecision`.

Status: `candidate | shortlisted | rejected | expired` (MM-owned transitions later).

`compositeResearchScore` is a **research ranking** hint only.

---

## 13. Performance feedback input

Performance Analyst produces analysis; Research ingests **normalized performance-derived signals** (`signalType: content_performance | demand_signal`) without duplicating PA scoring logic.

---

## 14. Hermes vs deterministic ownership

| Layer | Owner |
|---|---|
| Collectors (future) | Deterministic services / adapters |
| Normalization, scoring, dedup, brief/candidate build | Deterministic TypeScript |
| Agenda selection | Marketing Manager (Hermes Bot) |
| Content creation | Content Strategist (Hermes Bot) |

Initial path: **Research service → ResearchBrief / AgendaCandidate → MM MCP/context** (future STEP).

---

## 15. Runtime relationship

Research Intelligence does **not** replace Runtime Gateway or Hermes inference. Optional LLM enrichment (future) runs **after** provenance capture and cannot drop evidence links.

No changes to PA/CS/GA/MM Runtime profiles in STEP 3-1.

---

## 16. Future Market Researcher Bot criteria

Consider a dedicated Bot when **all** become true persistently:

- Multi-step source exploration requires independent long-running reasoning
- Research memory pollutes MM context
- Corroboration / comparison becomes a standalone conversational workflow
- Recurring autonomous research dialogue is product-required

Until then: **deterministic Research Intelligence service**.

---

## 17. Non-goals (STEP 3-1)

- Market Researcher Bot
- Web crawlers, Trends/news/airline/weather/FX APIs
- SNS scraping, browser automation
- Auto publication, Human Review UI, cron activation
- Full Agenda Intelligence / Content Planning Intelligence products

---

## 18. Safety / external side-effect boundary

Read-only intelligence. Collectors (future): **GET/read only**.  
`PUBLICATION_FLOW_INACTIVE=true` preserved. No External Action Gateway in scope.

---

## 19. Initial MVP scope (STEP 3-1)

Implemented:

- Domain types + Zod validation
- Deterministic scorers (freshness, credibility, relevance)
- Dedup L1/L2
- Brief + AgendaCandidate builders
- In-memory repository + pipeline
- DB migration schema (not wired to Supabase repo yet)
- ~15 unit tests with synthetic fixtures

---

## 20. Future roadmap

| STEP | Focus |
|---|---|
| 3-2 | **DONE** — read-only collectors (UK Gov Atom, NYT Travel RSS), Supabase repo, collection cycle. See `research-collectors.md`. |
| 3-3 | **DONE** — L3 semantic dedup (BGE-M3), clustering foundation, corroboration/novelty scoring, calibration. See `research-quality-calibration.md`. |
| 3-4 | **DONE** — MM read-only research context via `get_research_context` MCP tool. See below. |
| 3-5 | Optional Market Researcher Bot evaluation |

---

## Entity distinction (no duplication)

| Entity | Research | Existing |
|---|---|---|
| Signal vs metrics | `ResearchSignal` | `PerformanceSnapshot` (SNS metrics) |
| Brief vs post | `ResearchBrief` | `MarketingPost` / `ai_contents` |
| Evidence vs governance | `ResearchEvidence` | `GovernanceDecision` |
| Candidate vs plan | `AgendaCandidate` | Daily marketing plan / `ai_agendas` final selection |

---

## Decision record

**Agenda Intelligence** and **Content Planning Intelligence** are **stages/capabilities**, not automatically separate Bots.

**Research → discovers/evidences · MM → selects · CS → plans/creates · GA → reviews · PA → measures**
