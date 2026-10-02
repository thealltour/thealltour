import { createReadStream, readFileSync } from "node:fs";
import { Readable } from "node:stream";
import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { requireFreshShortformOutput } from "@/lib/marketing/publishable/narrationShortform/service";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ candidateId: string; jobId: string }> }) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId, jobId } = await context.params; const { root } = await loadSceneApiContext(candidateId, false);
    const { videoPath, subtitlesPath, output } = requireFreshShortformOutput(root, candidateId, jobId);
    if (new URL(request.url).searchParams.get("format") === "srt") return new Response(new Uint8Array(readFileSync(subtitlesPath)), {
      headers: { "Content-Type": "application/x-subrip; charset=utf-8", "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="narration-subtitles.srt"' },
    });
    let start = 0; let end = output.byteSize - 1; let status = 200;
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${output.byteSize}` } });
      if (match[1]) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; }
      else start = Math.max(0, output.byteSize - Number(match[2]));
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= output.byteSize || (!match[1] && Number(match[2]) <= 0)) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${output.byteSize}` } });
      status = 206;
    }
    const stream = Readable.toWeb(createReadStream(videoPath, { start, end })) as ReadableStream<Uint8Array>;
    return new Response(stream, { status, headers: { "Content-Type": "video/mp4", "Cache-Control": "no-store", "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1), ...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${output.byteSize}` } : {}) } });
  } catch (error) { return sceneApiError(error); }
}
