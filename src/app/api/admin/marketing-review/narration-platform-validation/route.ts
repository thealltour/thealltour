import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requireAdminPermission } from "@/lib/apiAuth";
import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
import { addPlatformValidationRecord, platformEvidencePath, platformLabels, platformValidationInputSchema, platformValidationSummary, readPlatformValidationRecords } from "@/lib/marketing/publishable/narrationShortform/platformValidation";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const qaDirectory = () => process.env.NARRATION_PLATFORM_QA_DIR || join(process.cwd(), "artifacts/narration-platform-qa");
const QA_FILES = { "720x1280": "qa-720x1280-clean.mp4", "1080x1920": "qa-1080x1920-clean.mp4" } as const;
const error = (e: unknown) => Response.json({ message: e instanceof NarrationError ? e.message : "검수 기록을 처리하지 못했습니다." }, { status: e instanceof NarrationError ? e.status : 500 });
export async function GET(request: Request) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const params = new URL(request.url).searchParams; const evidence = params.get("evidence"); const qa = params.get("qa") as keyof typeof QA_FILES | null;
    if (evidence) {
      const record = readPlatformValidationRecords().flatMap(r => r.evidence).find(e => e.fileName === evidence); if (!record) throw new NarrationError("증빙 파일을 찾을 수 없습니다.", 404);
      const bytes = readFileSync(platformEvidencePath(evidence)); if (sha256Buffer(bytes) !== record.sha256) throw new NarrationError("증빙 파일이 기록과 다릅니다.", 409);
      return new Response(new Uint8Array(bytes), { headers: { "Content-Type": record.mediaType, "Content-Length": String(bytes.length), "Cache-Control": "private, no-store" } });
    }
    if (qa) {
      const name = QA_FILES[qa]; if (!name || !existsSync(join(qaDirectory(), name))) throw new NarrationError("검수용 영상이 아직 없습니다. 검수 영상 생성 스크립트를 먼저 실행해주세요.", 404);
      const bytes = readFileSync(join(qaDirectory(), name));
      return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "video/mp4", "Content-Length": String(bytes.length), "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
    }
    const qaVideos = Object.entries(QA_FILES).map(([size, name]) => { const path = join(qaDirectory(), name); return { size, available: existsSync(path), sha256: existsSync(path) ? sha256Buffer(readFileSync(path)) : null }; });
    return Response.json({ summary: platformValidationSummary(), records: readPlatformValidationRecords().slice(-50).reverse(), labels: platformLabels, qaVideos });
  } catch (e) { return error(e); }
}
export async function POST(request: Request) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const form = await request.formData().catch(() => null); if (!form) throw new NarrationError("검수 기록 형식을 확인해주세요.", 400);
    let raw: unknown = null; try { raw = JSON.parse(String(form.get("record") ?? "")); } catch { raw = null; }
    const parsed = platformValidationInputSchema.safeParse(raw);
    if (!parsed.success) throw new NarrationError(parsed.error.issues.some(i => i.message === "real_device_only") ? "통과는 실제 기기 앱에서 확인한 기록만 가능합니다." : "검수 기록 항목을 확인해주세요.", 400);
    const files = await Promise.all(form.getAll("evidence").filter((f): f is File => f instanceof File && f.size > 0).map(async f => ({ name: f.name, type: f.type, bytes: Buffer.from(await f.arrayBuffer()) })));
    const record = addPlatformValidationRecord(parsed.data, files);
    return Response.json({ record, summary: platformValidationSummary() }, { status: 201 });
  } catch (e) { return error(e); }
}
