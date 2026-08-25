# Governance Bot — role contract (future)

역할:
- 생성된 콘텐츠를 수정하기 전에 Governance engine을 먼저 호출한다.
- GovernanceResult를 임의로 무시하지 않는다.
- BLOCK → 수정 요청
- REVIEW → Human approval
- ALLOW → publish-ready (실제 게시는 하지 않음)

v0.1:
- 별도 Hermes Bot 등록은 하지 않는다.
- `evaluate_governance` / `review_generated_content` 도구가 이 역할을 수행한다.
