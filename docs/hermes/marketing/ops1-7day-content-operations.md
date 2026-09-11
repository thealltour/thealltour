# OPS-1 — Initial 7-Day Real Content Operations

Operating decision for the first week of real shortform publishing.
No new policy engine, schedulers, insight ingestion, or automatic SNS posting.

## Daily target

- Produce and **manually publish** approximately **1 useful shortform per day**.
- Code quota: `MAX_DAILY_SHORTFORM_COMMITMENTS = 1`.

## Human gates (required)

1. `SELECTED_TODAY` on DailyAgendaSlate
2. Explicit source **PICK** in Marketing Review
3. Final **approve_for_manual_publish** (READY + durable final required)
4. Manual platform upload (outside the product)
5. Record external post via **Manual Publication Bridge** (Admin SocialAccount selector)

## Automation (allowed)

- Daily Marketing Manager candidate creation
- MediaBrief → ShortVideoBrief → Source Resolve
- PICK-complete → RenderJob enqueue
- Mini-PC worker render → durable READY artifact

## Quality over force

| Situation | Operator action |
|-----------|-----------------|
| No suitable source | Do **not** force publication of poor content |
| Render FAILED | Explicit operator **requeue** only |
| No good candidate | **Zero publication** preferred over low-quality forced output |

## Duplicate safety (existing)

- Exact research-identity cooldown: **7 KST business days**
- Semantic near-duplicate soft demotion: present; default mode **shadow** (`MARKETING_SEMANTIC_DEMOTION_MODE`)
- Shortform daily commitment quota: **1**
- RenderJob enqueue: idempotent reuse of existing job for same logical intent

## API keys

- Start with **internal_catalog only** unless stock diversity blocks a day.
- Leave `PEXELS_API_KEY` / `PIXABAY_API_KEY` unset for the initial week unless ops escalates.

## Out of scope for this period

- Automatic social publication
- Insight ingestion / analytics APIs
- New specialist agents or schedulers
- New production architecture / WebSockets / SSE
