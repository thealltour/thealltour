# Daily Marketing Incident Recovery Runbook

Operator guide for triaging and safely recovering failed `daily-marketing-plan` runs.
Read-only inspection first; no SNS/Telegram/external publication during recovery.

## 1. Detect incident

- Open **Marketing Operations**: `/theall_manager_only/marketing-operations`
- Or inspect cron output / `daily_marketing_runs` for `status = failed`
- Common failure reasons:
  - `GOVERNANCE_TECHNICAL_FAILURE` — Governance Auditor never completed (Runtime/Hermes/parse)
  - `GOVERNANCE_BLOCKED` — policy BLOCK after revision (business outcome)
  - `GOVERNANCE_FAILED` — legacy alias for technical governance failure (pre-STEP-3-11)
  - `RUNTIME_PROVIDER_FAILED` — MM/CS/GA provider invocation failed

## 2. Identify businessDate / runId

From Operations **추적 ID** or DB:

```sql
SELECT logical_run_key, run_id, correlation_id, status, payload->>'failureReason'
FROM daily_marketing_runs
WHERE business_date_kst = '2026-09-02';
```

Freeze evidence (read-only):

```bash
npx tsx scripts/freeze-marketing-incident-evidence.ts --businessDate=2026-09-02
```

## 3. Inspect Operations page

Check **Governance / 인시던트 트리아지**:

| Field | Meaning |
|-------|---------|
| `incidentClass` | Deterministic classification (`runtime_unavailable`, `business_rule_block`, …) |
| `recoveryDisposition` | `no_retry`, `safe_retry`, `retry_after_fix`, `human_action_required` |
| `concernSummary` | Why governance stopped |
| `recommendedOperatorAction` | Next step |

## 4. Inspect DB / Runtime correlation

Match `correlation_id` in `ai_runtime_observability_events`:

- `manager_decision` + `content_draft` success but **no `governance` workload** → technical failure before GA
- `governance` success + BLOCK → legitimate policy block

## 5. Classify failure

Use `incidentClass` from Operations or `classifyMarketingIncident()`:

- **business_rule_block** → do not weaken governance; no automatic retry
- **governance_review_required** → human review queue
- **runtime_unavailable** / **provider_transient** → safe retry after Runtime recovery
- **malformed_model_output** → safe retry after GA JSON contract verified
- **provider_auth** → fix credentials first (`retry_after_fix`)

## 6. Retry ownership (no double-retry)

| Layer | Owns retry? | Notes |
|-------|-------------|-------|
| Hermes messaging | No auto-retry for daily plan | Next cron tick only |
| AI Runtime provider fallback | Internal per-request | Does not re-run full pipeline |
| Scheduler logical retry | No | One run per `logicalRunKey` per day |
| BLOCK revision loop | One round max | Only on BLOCK, not REVIEW/technical |
| Operator recovery script | Yes | Explicit `recoveryMode` with history preservation |

**Today's GOVERNANCE_FAILED (2026-09-02):** no automatic retry was correct. Use operator recovery after Runtime is healthy.

## 7. Decide retry / no-retry / human-action

| `recoveryDisposition` | Action |
|-----------------------|--------|
| `no_retry` | Document policy block; no rerun |
| `safe_retry` | Run recovery script after infra green |
| `retry_after_fix` | Fix root cause (auth, Supabase) then retry |
| `human_action_required` | Human Review queue; no blind rerun |

## 8. Safe rerun command

Dry-run first:

```bash
npx tsx scripts/recover-daily-marketing-run.ts --businessDate=2026-09-02 --dry-run
```

Execute (no external publication):

```bash
npx tsx scripts/recover-daily-marketing-run.ts --businessDate=2026-09-02 --execute
```

Refuses when:

- production candidate already exists
- run is `started` (ambiguous)
- run already `completed` with candidate

## 9. Verify idempotency

- Original failed run preserved in `metadata.incidentHistory`
- `executionAttempt` increments
- `completed_marketing_candidates` has at most one row per `logical_run_key`
- Re-running recovery after success → `refused: production_candidate_already_exists`

## 10. Confirm Human Review

After successful recovery:

- Candidate `ready_for_human_review` or `needs_human_review`
- Exactly one HumanMarketingReview per candidate
- Operations overall status should not show duplicate candidates

## 11. Never publish during recovery

- `PUBLICATION_FLOW_INACTIVE=true` — SNS adapters blocked
- Recovery script does not invoke publication adapters
- Manual publish only after human approval outside this pipeline

## 12. Escalation cases

- Duplicate production candidates → stop; investigate `logical_run_key` upsert
- Repeated `GOVERNANCE_TECHNICAL_FAILURE` → Runtime gateway / quota / GA structured output
- Legitimate BLOCK after revision → escalate to content policy owner, not infra

## Examples

### Legitimate Governance BLOCK

> Governance blocked unsupported price claim after one revision. No retry recommended.

- `incidentClass`: `business_rule_block`
- `recoveryDisposition`: `no_retry`
- Candidate may exist with `status: blocked`

### Malformed GA output

> Governance Auditor response could not be parsed into ALLOW/REVIEW/BLOCK.

- `incidentClass`: `malformed_model_output`
- `recoveryDisposition`: `safe_retry`

### Runtime unavailable

> Marketing Manager and Content Strategist completed, but Governance Auditor invocation failed before telemetry.

- `incidentClass`: `runtime_unavailable`
- `recoveryDisposition`: `safe_retry`

### Supabase failure

- `incidentClass`: `persistence_failure`
- `recoveryDisposition`: `retry_after_fix`

### Duplicate candidate protection

Recovery script exits with `production_candidate_already_exists` — do not delete rows manually.
