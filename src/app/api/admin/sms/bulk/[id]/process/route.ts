import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { processSmsBulkJobBatch } from "@/lib/sms/smsBulk";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const result = await processSmsBulkJobBatch(id);
  return NextResponse.json({ ok: true, ...result });
}
