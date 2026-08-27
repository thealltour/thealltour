# AI Marketing Department v1

더올투어 마케팅을 Hermes Agent 4역할로 조율한다. Desktop profile은 배포됨. Cron은 STEP 2-4.8B에서 **task-only**로 활성화됐다 (SNS 게시 없음).

## 조직

```
Human Owner
   ↓
Marketing Manager
   ├── Content Strategist
   ├── Governance Auditor
   └── Performance Analyst
```

작성자가 자기 글을 최종 승인하지 않는다. 검사는 Governance Auditor가 독립 수행한다.

## MCP

서버 `thealltour-marketing` (publish/send/post 없음):

- `get_marketing_context`
- `search_marketing_memory`
- `build_content_brief`
- `evaluate_governance`
- `prepare_marketing_task`
- `review_generated_content`
- `get_performance_evidence` (08:30 cron과 같은 Daily Performance Brief contract. SNS 수집 없음)
- `run_department_orchestration` (실제 specialist profile dispatch + evidence + Manager synthesis. 게시 없음)

Agent별 권한은 현재 **prompt-level**이다. MCP 서버가 Agent identity를 받지 않으므로 server ACL은 아직 없다. 표: [skill-matrix.md](./skill-matrix.md)

## 문서

| 층 | 경로 |
|---|---|
| 조직도 | [organization.md](./organization.md) |
| 공통 정책 | [department-policy.md](./department-policy.md) |
| Prompt A/B | [prompts/](./prompts/) |
| Handoff | [handoffs.md](./handoffs.md) |
| Runtime handoff | [runtime-handoff.md](./runtime-handoff.md) |
| Runtime integration audit (STEP 2-5.4A) | [runtime-integration-audit.md](./runtime-integration-audit.md) |
| Human Approval | [human-approval.md](./human-approval.md) |
| Cron (활성) | [cron-plan.md](./cron-plan.md) |
| Performance collection | [performance-collection.md](./performance-collection.md) |
| SNS integration (STEP 3-1 contracts) | [sns-integration-architecture.md](./sns-integration-architecture.md) |
| SNS capability matrix (STEP 3-2) | [sns-capability-matrix.md](./sns-capability-matrix.md) |
| Social accounts & credentials (STEP 3-3) | [social-account-credentials.md](./social-account-credentials.md) |
| Desktop New Agent | [agents/](./agents/) |
| Machine contract | `src/lib/marketing/bot/contracts/` |
| TS config | `src/lib/marketing/bot/organization/` |
| Social ports | `src/lib/marketing/social/` |

## SNS (STEP 3-1 / 3-2 / 3-3)

PublicationAdapter와 PerformanceCollector를 **분리**한 계약 + 채널별 **공식 API capability matrix** + **SocialAccount / AuthorizationGrant / CredentialReference** 계약.  
공식 API 호출·OAuth·credential 저장·migration·게시 **없음**. `SNS_SIDE_EFFECTS_STEP_3_3 = 0`.  
`PUBLICATION_FLOW_INACTIVE` 유지.

## Cron (요약)

| 시각 (Asia/Seoul) | Job | Profile |
|---|---|---|
| 08:30 | AI Marketing - Daily Performance | performance-analyst |
| 09:00 | AI Marketing - Daily Plan | marketing-manager |

task-only · no publish · Performance brief artifact handoff · 상세: [cron-plan.md](./cron-plan.md)

## 수동 테스트 (Agent / Cron)

Marketing Manager:

> 스페인/포르투갈 상품으로 오늘 Threads 콘텐츠를 준비해줘. 게시하지 말고 governance 결과까지 보여줘.

Performance Analyst:

> 최근 30일 이 상품의 확인 가능한 성과만 정리해.

Cron manual:

```bash
hermes -p performance-analyst cron run <job_id>
hermes -p marketing-manager cron run <job_id>
```

## Official SNS (STEP 3)

- [sns-integration-architecture.md](./sns-integration-architecture.md)
- [sns-capability-matrix.md](./sns-capability-matrix.md)
- [social-account-credentials.md](./social-account-credentials.md)
- [social-persistence.md](./social-persistence.md) (STEP 3-4 schema)
- [social-repository.md](./social-repository.md) (STEP 3-5 repository)

게시 흐름은 비활성 (`PUBLICATION_FLOW_INACTIVE`). SNS side effects = 0.

## Desktop / Profile 배포

Pi에 실제 profile이 있다. 생성 방식과 Bot 목록 조건: [desktop-deployment.md](./desktop-deployment.md).

## Human Approval

REVIEW는 DB에 저장하지 않는다. 흐름: [human-approval.md](./human-approval.md). APPROVE여도 SNS 게시는 없다.

## 게시

v1 모든 역할 `autoPublishAllowed = false`. ALLOW여도 publish_ready에서 중단.

## Internal runtime (Pi)

localhost MCP 서버 운영: [internal-runtime.md](./internal-runtime.md). public website(Vercel)와 별개다.
