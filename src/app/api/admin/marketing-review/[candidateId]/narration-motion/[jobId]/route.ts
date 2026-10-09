import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { requireMotionOutput } from "@/lib/marketing/publishable/narrationMotion/service";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ candidateId: string; jobId: string }> }) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId, jobId } = await context.params; const { root } = await loadSceneApiContext(candidateId, false);
    const { job, path } = requireMotionOutput(root, candidateId, jobId); const size = job.output!.byteSize;
    let start = 0; let end = size - 1; let status = 200; const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      if (match[1]) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; }
      else start = Math.max(0, size - Number(match[2]));
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size || (!match[1] && Number(match[2]) <= 0)) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      status = 206;
    }
    const body = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream<Uint8Array>;
    return new Response(body, { status, headers: { "Content-Type": "video/mp4", "Cache-Control": "no-store", "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1),
      ...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}) } });
  } catch (error) { return sceneApiError(error); }
}
