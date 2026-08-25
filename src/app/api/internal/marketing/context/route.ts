import { marketingBotHttpResponse } from "@/lib/marketing/bot/httpResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return marketingBotHttpResponse("get_marketing_context", request);
}
