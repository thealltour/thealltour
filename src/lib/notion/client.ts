import { Client } from "@notionhq/client";

const NOTION_TOKEN = process.env.NOTION_TOKEN;

const notionClient = NOTION_TOKEN
  ? new Client({ auth: NOTION_TOKEN })
  : null;

export function ensureNotionClient() {
  if (!notionClient) {
    throw new Error("NOTION_TOKEN 환경변수가 설정되어 있지 않습니다.");
  }
  return notionClient;
}

