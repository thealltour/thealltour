import { marketingBotHttpResponse } from "@/lib/marketing/bot/httpResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return marketingBotHttpResponse("prepare_marketing_task", request);
}
