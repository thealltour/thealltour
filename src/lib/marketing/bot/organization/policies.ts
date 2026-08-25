import { MARKETING_FORBIDDEN_ACTIONS } from "@/lib/marketing/bot/organization/types";

export const DEPARTMENT_FORBIDDEN_ACTIONS = [...MARKETING_FORBIDDEN_ACTIONS] as const;

export const DEPARTMENT_COMMON_RULES = [
  "thealltour Context/Memory is the source of product facts",
  "do not invent price, schedule, inclusions, or benefits",
  "do not use raw customer PII",
  "query context/memory before drafting",
  "run governance after every draft",
  "never bypass BLOCK",
  "REVIEW requires a human",
  "ALLOW still does not publish in v1",
  "keep one primary agenda per piece",
  "minimize ungrounded cliché",
] as const;
