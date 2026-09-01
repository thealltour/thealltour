import { requireAdminPermission } from "@/lib/apiAuth";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { queueFilterSchema } from "@/lib/marketing/review/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const filterRaw = url.searchParams.get("filter") ?? "all";
  const parsed = queueFilterSchema.safeParse(filterRaw);
  if (!parsed.success) {
    return Response.json({ message: "invalid filter" }, { status: 400 });
  }

  try {
    const service = await createHumanMarketingReviewService();
    const result = await service.listHumanReviewQueue(parsed.data);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}
