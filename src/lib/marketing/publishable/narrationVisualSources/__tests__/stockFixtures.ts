import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Shapes follow the documented Pexels /v1/videos/search and Pixabay /api/videos/ responses; values are made up. */
const pexelsFile = (id: number, width: number, height: number, link: string) => ({ id, quality: width >= 1080 ? "hd" : "sd", file_type: "video/mp4", width, height, fps: 30, link });
const pexelsVideo = (id: number, slug: string, duration: number, files: ReturnType<typeof pexelsFile>[], width = 1080, height = 1920) => ({
  id, width, height, url: `https://www.pexels.com/video/${slug}-${id}/`, image: `https://images.pexels.com/videos/${id}/poster.jpeg`, duration,
  user: { id: 77, name: "Fixture Creator", url: "https://www.pexels.com/@fixture" }, video_files: files, video_pictures: [] });
export const PEXELS_SEARCH = { page: 1, per_page: 15, total_results: 5, url: "https://www.pexels.com/search/videos/fixture/", videos: [
  pexelsVideo(1001, "people-crossing-a-busy-street", 6, [pexelsFile(9011, 1080, 1920, "https://videos.pexels.com/video-files/1001/cfr-1080x1920.mp4"), pexelsFile(9012, 540, 960, "https://videos.pexels.com/video-files/1001/cfr-540x960.mp4")]),
  pexelsVideo(1003, "myeongdong-street-at-night", 6, [pexelsFile(9031, 1080, 1920, "https://videos.pexels.com/video-files/1003/a-1080x1920.mp4")]),
  pexelsVideo(1004, "traffic-light-change", 6, [pexelsFile(9041, 1080, 1920, "https://videos.pexels.com/video-files/1004/b-1080x1920.mp4")]),
  pexelsVideo(1005, "bus-stop-queue", 6, [pexelsFile(9051, 1080, 1920, "https://videos.pexels.com/video-files/1005/c-1080x1920.mp4")]),
  pexelsVideo(1006, "highway-aerial", 6, [pexelsFile(9061, 1920, 1080, "https://videos.pexels.com/video-files/1006/d-1920x1080.mp4")], 1920, 1080),
] };
const pixabaySize = (url: string, width: number, height: number) => ({ url, width, height, size: url ? 1_000_000 : 0, thumbnail: url ? url.replace(".mp4", ".jpg") : "" });
export const PIXABAY_SEARCH = { total: 2, totalHits: 2, hits: [
  { id: 2001, pageURL: "https://pixabay.com/videos/id-2001/", type: "film", tags: "seoul, street, traffic, crosswalk", duration: 6,
    videos: { large: pixabaySize("", 0, 0), medium: pixabaySize("https://cdn.pixabay.com/video/2026/2001-medium.mp4", 1080, 1920), small: pixabaySize("https://cdn.pixabay.com/video/2026/2001-small.mp4", 540, 960), tiny: pixabaySize("https://cdn.pixabay.com/video/2026/2001-tiny.mp4", 360, 640) },
    views: 1, downloads: 1, likes: 0, comments: 0, user_id: 4242, user: "fixture_user", userImageURL: "" },
  { id: 2002, pageURL: "https://pixabay.com/videos/id-2002/", type: "film", tags: "street", duration: 2,
    videos: { large: pixabaySize("", 0, 0), medium: pixabaySize("https://cdn.pixabay.com/video/2026/2002-medium.mp4", 1080, 1920), small: pixabaySize("", 0, 0), tiny: pixabaySize("", 0, 0) },
    views: 1, downloads: 1, likes: 0, comments: 0, user_id: 4243, user: "other_user", userImageURL: "" },
] };

export type FetchLog = { url: string; method: string; headers: Record<string, string>; kind: "provider_api" | "download" | "preview" | "blocked" };
/**
 * Replaces global fetch. Provider API hosts get fixture JSON, allowlisted video hosts get local files; anything else is
 * recorded as blocked and fails, so no request can leave the machine.
 */
export function fixtureFetch(input: { files: Record<string, string>; pexels?: (url: URL) => unknown; pixabay?: (url: URL) => unknown; status?: (url: URL) => number | null }) {
  const log: FetchLog[] = [];
  const impl = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof resource === "string" ? resource : resource instanceof URL ? resource.href : resource.url);
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const forced = input.status?.(url) ?? null;
    if (url.hostname === "api.pexels.com" || (url.hostname === "pixabay.com" && url.pathname.startsWith("/api/"))) {
      log.push({ url: url.href, method: init?.method ?? "GET", headers, kind: "provider_api" });
      if (forced) return new Response("{}", { status: forced });
      const lookupId = url.pathname.match(/\/v1\/videos\/videos\/(\d+)$/)?.[1];
      const body = url.hostname === "api.pexels.com" ? (lookupId ? PEXELS_SEARCH.videos.find(v => String(v.id) === lookupId) ?? {} : (input.pexels ?? (() => PEXELS_SEARCH))(url))
        : url.searchParams.get("id") ? { ...PIXABAY_SEARCH, hits: PIXABAY_SEARCH.hits.filter(h => String(h.id) === url.searchParams.get("id")) } : (input.pixabay ?? (() => PIXABAY_SEARCH))(url);
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }
    const file = input.files[url.href];
    if (file !== undefined) {
      log.push({ url: url.href, method: init?.method ?? "GET", headers, kind: "download" });
      if (forced) return new Response("gone", { status: forced, headers: { "content-type": "text/plain" } });
      const bytes = readFileSync(file);
      return new Response(bytes, { status: 200, headers: { "content-type": "video/mp4", "content-length": String(bytes.length) } });
    }
    log.push({ url: url.href, method: init?.method ?? "GET", headers, kind: "blocked" });
    throw new TypeError(`blocked_external_request:${url.hostname}`);
  };
  return { impl, log };
}

/** Uniform frames whose luma is 16 + slope·t (t = source timestamp), so the extracted range and its speed can be read back. */
export function rampVideo(path: string, options: { seconds: number; width?: number; height?: number; fps?: number; slope?: number; audio?: boolean; vfr?: boolean }) {
  const { seconds, width = 1080, height = 1920, fps = 30, slope = 30 } = options;
  const source = `nullsrc=s=16x16:r=${options.vfr ? 60 : fps}:d=${seconds},geq=lum='16+${slope}*T':cb=128:cr=128,scale=${width}:${height}:flags=neighbor`;
  // VFR: 20 fps before 3 s, 60 fps after (timestamps kept), so a CFR resampler has to follow real time across the switch.
  const filter = options.vfr ? `${source},select='lt(t\\,3)*not(mod(n\\,3))+gte(t\\,3)'` : source;
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", filter,
    ...(options.audio ? ["-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`, "-c:a", "aac", "-shortest"] : []),
    ...(options.vfr ? ["-fps_mode", "vfr"] : []), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "10", "-pix_fmt", "yuv420p", path]);
  return path;
}
export function corruptVideo(path: string) { writeFileSync(path, Buffer.concat([Buffer.from("not an mp4 file"), Buffer.alloc(4096, 7)])); return path; }
/** Mean luma of an 8x8 downscale of every frame, optionally of a crop first. */
export function frameLumas(path: string, crop?: string) {
  const raw = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", path, "-vf", `${crop ? `crop=${crop},` : ""}scale=8:8,format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 64 * 1024 * 1024 });
  const lumas: number[] = []; for (let i = 0; i + 64 <= raw.length; i += 64) { let sum = 0; for (let j = 0; j < 64; j++) sum += raw[i + j]!; lumas.push(sum / 64); }
  return lumas;
}
export function probeStreams(path: string) {
  return JSON.parse(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-show_entries", "stream=codec_type,width,height,r_frame_rate,avg_frame_rate,nb_read_frames,duration", "-of", "json", path], { encoding: "utf8" })) as
    { streams: Array<{ codec_type: string; width?: number; height?: number; r_frame_rate?: string; avg_frame_rate?: string; nb_read_frames?: string; duration?: string }> };
}
export const fixturePath = (directory: string, name: string) => join(directory, name);
