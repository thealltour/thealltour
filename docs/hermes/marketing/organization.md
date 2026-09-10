# 조직도 — TheAllTour Marketing Agents Organization v2.1 (LOCKED)

> Locked: 2026-09-10. Core Hermes Bot count remains **4**. No new Agents activated.
> Observability: OBS-1~6 ready. Next UI: OBS-7 Organization Overview Graph.

```
                         Human Owner
                              │
                              ▼
                    Marketing Manager / CMO
                         [CORE AGENT]
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
 Content Strategy       Governance / QA     Performance Intelligence
          │                   │                   │
          ▼                   ▼                   ▼
 Content Strategist    Governance Auditor   Performance Analyst
   [CORE AGENT]          [CORE AGENT]          [CORE AGENT]
          │
          ├──────── OPTIONAL SPECIALISTS (PREPARE — not registered) ──┐
          │                                                           │
          ▼                                                           ▼
 Channel Producer                                          Creative Director
    [PREPARE]                                                   [PREPARE]

────────────────── SHARED SERVICES / STAFF (not Hermes Bots) ──────────────────
Research Intelligence
Deliverable Requirements
Evidence Pack Builder
Completeness Validator
Semantic / Dedupe
Media Pipeline
Human Review
Publication Governance
Observability / Analytics
```

Hermes Bot profile / registry slots remain:
`marketing-manager`, `content-strategist`, `governance-auditor`, `performance-analyst`.

Human Owner만 최종 게시 권한을 가질 수 있다. 현재 게시 tool 자체가 없으므로 모든 Agent의 게시 권한은 **없음**. APPROVE는 게시 가능 상태일 뿐 SNS 실행이 아니다.

Production spine은 `runDepartmentPipeline` / Agenda queue다. Group Chat은 협업 UX일 뿐 pipeline을 대체하지 않는다 — [desktop-deployment.md](./desktop-deployment.md#hermes-desktop-group-topology-ops).

## Core Agents

### Marketing Manager

- **책임:** CMO / department orchestrator — agenda/campaign decision, specialist assignment, cross-department synthesis, Human Owner escalation
- **하지 않음:** final copywriting, evidence discovery, structural completeness, publication, governance override
- **입력:** 사용자 요청, productId/channel/goal, PerformanceBrief (optional)
- **출력:** `{ status, task, selectedAgenda, draft?, governance?, nextAction }`
- **승인/게시 권한:** 없음 (REVIEW는 사람에게)

### Content Strategist

- **책임:** message strategy, content structure, copywriting, channel voice, CTA, revision
- **하지 않음:** Evidence Pack build, Completeness judgment, open research discovery, self approval, publication
- **입력:** ContentDraftRequest (+ `deliverableRequirements`, `evidencePack`)
- **출력:** `{ title?, body, channel, agenda, sourceReferences, contentPlan? }`
- **handoff:** Completeness Validator → Governance Auditor

### Governance Auditor

- **책임:** policy, misleading claims, unsupported factual claims, commercial/legal risk, publication governance judgment
- **하지 않음:** structural completeness, copy rewrite, publication
- **입력:** GovernanceReviewRequest
- **출력:** GovernanceWorkflowResult (ALLOW/REVIEW/BLOCK)

### Performance Analyst

- **책임:** confirmed performance analysis → MM/CS learning loop
- **하지 않음:** mandatory on every ProductionRequest spine
- **흐름:** parallel morning brief cron + optional inject (queue defaults to no PA brief)

## Deterministic / shared staff (NOT Hermes Bots)

| Layer | Role |
|-------|------|
| Research Intelligence | Signals → ResearchBrief → AgendaCandidate (service, not 5th Bot) |
| Deliverable Requirements | Structural destinations/sections for draft |
| Evidence Pack Builder | Lock `allowedForDraft` facts |
| Completeness Validator | Structural gate before GA; shares `MAX_AUTO_REVISION_ROUNDS=1` |
| Semantic / Dedupe | Research + GA evaluators |
| Media Pipeline | Post-candidate MediaBrief → cardnews/TTS/video |
| Human Review | Bootstrap HMR after CompletedMarketingCandidate |
| Publication Governance | Inactive SNS boundary (`PUBLICATION_FLOW_INACTIVE`) |
| Observability / Analytics | OBS-1~6 traces + admin viewer |

**Principle:** judgment / strategy / creative interpretation → Agent.
count / schema / validation / evidence locking / freshness / dedupe / render / persistence / telemetry → deterministic.

## PREPARE specialists (not created / not registered)

### Channel Producer

- **Purpose:** channel-native creative adaptation beyond Threads-first CS draft
- **Handoff:** CS/MM → Channel Producer → Completeness or Media Pipeline
- **cron_default:** false (optional only)
- **Activation:** ≥2 real production channels **and** OBS-6 shows repeated CS duration/revision/quality pain from channel variance

### Creative Director

- **Purpose:** campaign concept, hook direction, cross-channel coherence; Trend Editorial → creative concept
- **Handoff:** MM → Creative Director → CS / optional Channel Producer
- **cron_default:** false
- **Activation:** campaign concept conflict/revision repeatedly observed as MM/CS bottleneck
  (avoid MM responsibility overlap until then)

## LATER (document only)

| Candidate | Current owner |
|-----------|---------------|
| Market Researcher | Research Intelligence service |
| Evidence Editor | Evidence Pack Builder |
| SEO / Blog Specialist | CS + future Channel Producer family |
| Visual Producer | Media Pipeline |
| Video Producer | Media Pipeline |

## Agent promotion policy

Promote to Hermes Bot only when **all** hold:

1. multi-step reasoning required
2. repeated expert judgment required
3. dialogue/context materially affects quality
4. Core Agent bottleneck repeatedly observed in traces/analytics
5. not solvable by deterministic rules
6. quality gain outweighs added invocation / latency / failure surface

**Never promote:** count/check, schema, freshness, dedupe, simple ranking, file conversion, render execution, DB persistence, telemetry.

## Group Chat topology (docs lock — not created this step)

| Group | Members | Lead | Purpose |
|-------|---------|------|---------|
| Marketing Leadership | MM, CS, GA, PA | MM | strategy / escalation |
| Content Review | CS, GA | GA | draft quality discussion (**not** approval SoT) |
| Performance Strategy | MM, CS, PA | PA | learning loop |
| Creative Production | PREPARE: MM, CS, CD, CP when activated | — | concept collaboration |

Group Chat = collaborative UX / memory / manual discussion.
Does **not** replace production pipeline, handoff state, Human Review, or approval SoT.

## Legacy naming (intentional — do not rename)

| Name | Verdict |
|------|---------|
| `ORCHESTRATION_PROJECT_ID=theallcloud` | intentional app/orchestration id |
| MCP `thealltour-marketing` | intentional |
| `PROJECT_DEPARTMENT_REGISTRY.thealltour.marketing` | intentional |
| `/home/ysh/theallcloud` | stale stub — do not use for org work |

## OBS-7 readiness (Organization Overview Graph)

Two layers for the next STEP (React Flow — not implemented here):

1. **Organization topology** — Human Owner, Core 4, Shared Services. PREPARE/LATER as `inactive/planned` metadata only (not live execution nodes).
2. **Execution overlay** — from MarketingTrace/MarketingSpan: `actorId`, `stage`, `status`, `attempt`, `duration`, `parentSpanId` → visual `idle|running|ok|revision_required|blocked|technical_error`.

OBS-1~6 schema unchanged. Analytics ≠ live overlay (OBS-5 live + OBS-6 aggregates remain separate).

## Capability contract

Desktop Hermes `tools.include` must equal skillMatrix **allow ∪ optional** for each Core role.
Source of truth: `src/lib/marketing/bot/organization/skillMatrix.ts`
See [skill-matrix.md](./skill-matrix.md).

Production queue oneshots embed handoff JSON and do **not** require MCP `get_*` tools — that difference is **intentional**.
