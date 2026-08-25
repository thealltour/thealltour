export const MARKETING_BOT_INTERNAL_TOKEN_ENV = "MARKETING_BOT_INTERNAL_TOKEN";
export const MARKETING_BOT_VERSION = "marketing-bot-v0.1";
export const MARKETING_BOT_MCP_SERVER_NAME = "thealltour-marketing";

export const BOT_MAX_TEXT_CHARS = 600;
export const BOT_MAX_PREVIEW_CHARS = 280;
export const BOT_MAX_HISTORY_ITEMS = 8;
export const BOT_MAX_MEMORY_MATCHES = 8;
export const BOT_MAX_FACTS = 12;

export const CONTENT_GENERATION_INSTRUCTIONS = [
  "제공된 Context와 Memory에 있는 사실만 사용한다.",
  "데이터에 없는 가격, 일정, 포함/불포함 사항을 만들어내지 않는다.",
  "최근 콘텐츠와 아젠다를 참고해 같은 각도를 반복하지 않는다.",
  "생성 후 반드시 review_generated_content로 거버넌스 검사를 한다.",
  "BLOCK이면 게시 시도를 하지 않고 재작성한다.",
  "REVIEW이면 사람 승인을 기다린다.",
  "ALLOW여도 이번 단계에서는 실제 SNS 게시를 하지 않는다.",
] as const;
