import { NextResponse } from "next/server";
import { getPendingBulkJobIds, processSmsBulkJobBatch } from "@/lib/sms/smsBulk";

function isProductionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";

  if (isProductionRuntime()) {
    if (!cronSecret) {
      return NextResponse.json({ message: "Cron disabled: CRON_SECRET missing." }, { status: 401 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  } else if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const jobIds = await getPendingBulkJobIds(3);
  const results = [];

  for (const jobId of jobIds) {
    const result = await processSmsBulkJobBatch(jobId);
    results.push({ jobId, ...result });
    if (!result.completed) break;
  }

  return NextResponse.json({ ok: true, processedJobs: results.length, results });
}
