// @vitest-environment node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createFileSourceSearchCache } from "@/lib/marketing/assets/shortform/resolver/searchCache";
import { ASTRA_HANDOFF_WRITER_SOUL, SHARED_VISUAL_PLANNER_SOUL } from "@/lib/marketing/publishable/visualOrchestration/hermesIdentity";
import { lookupStockVideo, parsePexelsVideos, parsePixabayVideos, searchStockPage } from "../providers";
import { proxyStockPreview } from "../preview";
import { metadataMatch, placeEvidence, sceneTerms } from "../search";
import { fixtureFetch, PEXELS_SEARCH, PIXABAY_SEARCH } from "./stockFixtures";

const KEYS = { PEXELS_API_KEY: "fixture-pexels-credential", PIXABAY_API_KEY: "fixture-pixabay-credential" };
let work: string;
beforeAll(() => { work = mkdtempSync(join(tmpdir(), "stock-providers-")); });
afterAll(() => { rmSync(work, { recursive: true, force: true }); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const freshEnv = (name: string) => { const state = join(work, name); mkdirSync(state, { recursive: true }); return { ...KEYS, NARRATION_STOCK_STATE_DIR: state }; };
const filesUnder = (directory: string): string[] => existsSync(directory) ? readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)]) : [];

describe("provider response parsing (fixtures shaped like the official docs)", () => {
  it("keeps every usable rendition, ignores empty Pixabay sizes and never invents tags for Pexels", () => {
    const pexels = parsePexelsVideos(PEXELS_SEARCH);
    expect(pexels.map(v => v.videoId)).toEqual(["1001", "1003", "1004", "1005", "1006"]);
    expect(pexels[0]).toMatchObject({ provider: "pexels", pageUrl: "https://www.pexels.com/video/people-crossing-a-busy-street-1001/", creatorName: "Fixture Creator", declaredDurationMs: 6000, tags: [] });
    expect(pexels[0]!.renditions.map(r => [r.fileKey, r.width, r.height])).toEqual([["9011", 1080, 1920], ["9012", 540, 960]]);
    const pixabay = parsePixabayVideos(PIXABAY_SEARCH);
    expect(pixabay[0]!.renditions.map(r => r.fileKey)).toEqual(["tiny", "small", "medium"]);
    expect(pixabay[0]).toMatchObject({ creatorUrl: "https://pixabay.com/users/fixture_user-4242/", tags: ["seoul", "street", "traffic", "crosswalk"] });
    expect(() => parsePexelsVideos({ photos: [] })).toThrow("malformed"); expect(() => parsePixabayVideos({})).toThrow("malformed");
  });

  it("place metadata: Pexels can only match its page slug, Pixabay its tags; the query is never evidence and silence is not a mismatch", () => {
    const [crossing, myeongdong] = parsePexelsVideos(PEXELS_SEARCH); const [seoul] = parsePixabayVideos(PIXABAY_SEARCH);
    expect(placeEvidence(myeongdong!, "Myeongdong")).toEqual({ field: "page_url", matchedText: "myeongdong street at night" });
    expect(placeEvidence(crossing!, "Myeongdong")).toBeNull();
    expect(placeEvidence(seoul!, "Seoul")).toMatchObject({ field: "tags" });
    expect(placeEvidence(seoul!, "Myeongdong")).toBeNull();
  });

  it("scene-word match reads only the provider's slug or tags, stems plurals and -ing, and ignores filler words", () => {
    const scene = sceneTerms({ subject: "low plastic stools and stainless steel table", visibleAction: "people sitting eating seafood at outdoor street table", mustMatch: ["low plastic stools"] });
    expect(scene).toEqual(expect.arrayContaining(["plastic", "stool", "sit", "eat", "seafood", "table"])); expect(scene).not.toContain("and");
    const slug = (s: string) => ({ tags: [], pageUrl: `https://www.pexels.com/video/${s}-1/` });
    expect(metadataMatch(slug("woman-eating-at-an-outdoor-table"), scene)).toEqual(["table", "eat", "outdoor"]);
    expect(metadataMatch(slug("pouring-milk-into-a-container-with-precision"), scene)).toEqual([]);
    expect(metadataMatch({ tags: ["burger", "street food"], pageUrl: "https://pixabay.com/videos/id-381248/" }, scene)).toEqual(["street"]);
  });
});

describe("provider requests: documented parameters, cache, local cap, failure codes", () => {
  it("sends documented filters, caches 24h, never stores the key, and counts no call for cache hits", async () => {
    const env = freshEnv("cache"); const cacheDir = join(work, "cache-files"); const cache = createFileSourceSearchCache({ rootDir: cacheDir });
    const fetch = fixtureFetch({ files: {} }); vi.stubGlobal("fetch", fetch.impl);
    const first = await searchStockPage({ provider: "pexels", query: "busy crosswalk", page: 1, env, cache });
    expect(first.status).toBe("ok"); expect(first.videos).toHaveLength(5);
    const pexelsCall = new URL(fetch.log[0]!.url);
    expect(Object.fromEntries(pexelsCall.searchParams)).toEqual({ query: "busy crosswalk", orientation: "portrait", size: "small", per_page: "15", page: "1" });
    expect(fetch.log[0]!.headers.authorization === KEYS.PEXELS_API_KEY).toBe(true);
    const pixabay = await searchStockPage({ provider: "pixabay", query: "busy crosswalk", page: 1, env, cache });
    expect(pixabay.status).toBe("ok");
    const pixabayCall = new URL(fetch.log[1]!.url); const params = Object.fromEntries(pixabayCall.searchParams);
    expect(params.key === KEYS.PIXABAY_API_KEY).toBe(true);
    expect({ ...params, key: "<redacted>" }).toEqual({ q: "busy crosswalk", video_type: "film", safesearch: "true", min_width: "720", min_height: "1280", per_page: "20", page: "1", key: "<redacted>" });
    const again = await searchStockPage({ provider: "pexels", query: "busy crosswalk", page: 1, env, cache });
    expect(again.status).toBe("cache_hit"); expect(fetch.log).toHaveLength(2);
    const stored = filesUnder(cacheDir).map(path => readFileSync(path, "utf8")).join("\n");
    expect(stored.length).toBeGreaterThan(0); expect(stored.includes(KEYS.PEXELS_API_KEY) || stored.includes(KEYS.PIXABAY_API_KEY)).toBe(false);
    const usage = readFileSync(join(env.NARRATION_STOCK_STATE_DIR, "usage.json"), "utf8"); expect(JSON.parse(usage).pexels).toHaveLength(1); expect(JSON.parse(usage).pixabay).toHaveLength(1);
    // After 24h the entry has expired and the provider is asked again.
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(Date.now() + 24 * 3_600_000 + 60_000);
    expect((await searchStockPage({ provider: "pexels", query: "busy crosswalk", page: 1, env, cache })).status).toBe("ok"); expect(fetch.log).toHaveLength(3);
  });

  it("stops at the local hourly cap without calling the provider; auth, rate-limit and missing key are distinct outcomes", async () => {
    const env = freshEnv("cap"); const cache = createFileSourceSearchCache({ rootDir: join(work, "cap-cache") });
    writeFileSync(join(env.NARRATION_STOCK_STATE_DIR, "usage.json"), JSON.stringify({ pexels: Array.from({ length: 60 }, () => Date.now() - 1000) }));
    const fetch = fixtureFetch({ files: {}, status: url => url.searchParams.get("q") === "auth" ? 401 : url.searchParams.get("q") === "busy" ? 429 : null }); vi.stubGlobal("fetch", fetch.impl);
    expect(await searchStockPage({ provider: "pexels", query: "anything new", page: 1, env, cache })).toMatchObject({ status: "cap_reached", message: "local_hourly_cap" });
    expect(fetch.log).toHaveLength(0);
    expect(await searchStockPage({ provider: "pixabay", query: "auth", page: 1, env, cache })).toMatchObject({ status: "auth_failed", message: "http_401" });
    expect(await searchStockPage({ provider: "pixabay", query: "busy", page: 1, env, cache })).toMatchObject({ status: "rate_limited" });
    expect(await searchStockPage({ provider: "pixabay", query: "x1", page: 1, env: { NARRATION_STOCK_STATE_DIR: env.NARRATION_STOCK_STATE_DIR }, cache })).toMatchObject({ status: "disabled", message: "PIXABAY_API_KEY_absent" });
    expect(fetch.log).toHaveLength(2);
  });

  it("looks a single video up for URL refresh (Pexels object response, Pixabay id search)", async () => {
    const env = freshEnv("lookup"); const fetch = fixtureFetch({ files: {} }); vi.stubGlobal("fetch", fetch.impl);
    const pexels = await lookupStockVideo({ provider: "pexels", videoId: "1001", env });
    expect(pexels?.renditions.find(r => r.fileKey === "9011")?.url).toBe("https://videos.pexels.com/video-files/1001/cfr-1080x1920.mp4");
    expect(new URL(fetch.log[0]!.url).pathname).toBe("/v1/videos/videos/1001");
    const pixabay = await lookupStockVideo({ provider: "pixabay", videoId: "2001", env, cache: createFileSourceSearchCache({ rootDir: join(work, "lookup-cache") }) });
    expect(pixabay?.videoId).toBe("2001"); expect(new URL(fetch.log[1]!.url).searchParams.get("id")).toBe("2001");
  });
});

describe("preview proxy: allowlist, manual redirects, Range passthrough", () => {
  const response = (status: number, headers: Record<string, string>, body: string | null = "x") => new Response(body, { status, headers });
  it("follows allowlisted redirects with the Range header and passes 206 + Content-Range through", async () => {
    const calls: Array<{ url: string; range: string | null; redirect: string | undefined }> = [];
    vi.stubGlobal("fetch", async (url: URL, init: RequestInit) => {
      calls.push({ url: url.href, range: new Headers(init.headers).get("range"), redirect: init.redirect });
      if (url.hostname === "videos.pexels.com") return response(302, { location: "https://player.vimeo.com/external/1.sd.mp4" }, null);
      return response(206, { "content-type": "video/mp4", "content-range": "bytes 0-99/5000", "content-length": "100" }, "a".repeat(100));
    });
    const proxied = await proxyStockPreview("https://videos.pexels.com/video-files/1001/cfr-540x960.mp4", "pexels", "bytes=0-99");
    expect(proxied.status).toBe(206); expect(proxied.headers.get("content-range")).toBe("bytes 0-99/5000"); expect(proxied.headers.get("content-type")).toBe("video/mp4");
    expect(calls.map(c => [new URL(c.url).hostname, c.range, c.redirect])).toEqual([["videos.pexels.com", "bytes=0-99", "manual"], ["player.vimeo.com", "bytes=0-99", "manual"]]);
    expect((await proxied.text()).length).toBe(100);
  });
  it("refuses disallowed hosts (before any request and after a redirect), redirect loops, non-video bodies and malformed ranges", async () => {
    const seen: string[] = []; let mode = "evil";
    vi.stubGlobal("fetch", async (url: URL, init: RequestInit) => {
      seen.push(`${url.hostname}|${new Headers(init.headers).get("range") ?? "-"}`);
      if (mode === "evil") return response(302, { location: "https://evil.example.com/v.mp4" }, null);
      if (mode === "loop") return response(302, { location: "https://videos.pexels.com/loop.mp4" }, null);
      return response(200, { "content-type": "text/html" }, "<html>");
    });
    await expect(proxyStockPreview("https://evil.example.com/v.mp4", "pexels", null)).rejects.toThrow("허용되지 않은"); expect(seen).toEqual([]);
    await expect(proxyStockPreview("http://videos.pexels.com/v.mp4", "pexels", null)).rejects.toThrow("허용되지 않은");
    await expect(proxyStockPreview("https://videos.pexels.com/v.mp4", "pexels", null)).rejects.toThrow("허용되지 않은"); expect(seen).toHaveLength(1);
    mode = "loop"; await expect(proxyStockPreview("https://videos.pexels.com/v.mp4", "pexels", null)).rejects.toThrow("너무 많습니다"); expect(seen).toHaveLength(5);
    mode = "html"; await expect(proxyStockPreview("https://cdn.pixabay.com/video/1.mp4", "pixabay", "bytes=abc")).rejects.toThrow("불러오지 못했습니다");
    expect(seen.at(-1)).toBe("cdn.pixabay.com|-");
    await expect(proxyStockPreview("https://cdn.pixabay.com/video/1.mp4", "pexels", null)).rejects.toThrow("허용되지 않은");
  });
});

describe("Hermes SOUL sync script (temporary HERMES_HOME only)", () => {
  const run = (home: string, ...args: string[]) => spawnSync(process.execPath, ["--import", "tsx", "scripts/sync-hermes-visual-profile-souls.ts", ...args], { cwd: process.cwd(), env: { ...process.env, HERMES_HOME: home }, encoding: "utf8", timeout: 120_000 });
  it("checks read-only, shows a diff, backs up, replaces only SOUL.md and verifies; never creates profiles", () => {
    const home = join(work, "hermes"); const planner = join(home, "profiles/shared-visual-planner"); const astra = join(home, "profiles/astra-handoff-writer");
    mkdirSync(planner, { recursive: true }); mkdirSync(astra, { recursive: true });
    writeFileSync(join(planner, "SOUL.md"), "# Narration workflow mode (manual)\nold planner text\n", { mode: 0o640 }); writeFileSync(join(planner, "config.yaml"), "model: fixture\n");
    writeFileSync(join(astra, "SOUL.md"), `${ASTRA_HANDOFF_WRITER_SOUL.trim()}\n`);
    const configBefore = readFileSync(join(planner, "config.yaml"));

    const check = run(home); expect(check.status).toBe(1); expect(check.stdout).toContain("shared-visual-planner: 불일치"); expect(check.stdout).toContain("astra-handoff-writer: 일치");
    const diff = run(home, "--diff"); expect(diff.status).toBe(1); expect(diff.stdout).toContain("-old planner text"); expect(diff.stdout).toContain("narration-stock-search-planning-v2"); expect(diff.stdout).toContain("narration-stock-search-supplement-v1");
    expect(readFileSync(join(planner, "SOUL.md"), "utf8")).toContain("old planner text");
    expect(readdirSync(planner).sort()).toEqual(["SOUL.md", "config.yaml"]);

    const apply = run(home, "--apply"); expect(apply.status).toBe(0);
    const backups = readdirSync(planner).filter(name => name.startsWith("SOUL.md.before-sync-")); expect(backups).toHaveLength(1);
    expect(readFileSync(join(planner, backups[0]!), "utf8")).toContain("old planner text");
    expect(readFileSync(join(planner, "SOUL.md"), "utf8")).toBe(`${SHARED_VISUAL_PLANNER_SOUL.trim()}\n`);
    expect(statSync(join(planner, "SOUL.md")).mode & 0o777).toBe(0o640);
    expect(readFileSync(join(planner, "config.yaml")).equals(configBefore)).toBe(true); expect(existsSync(join(planner, "profile.yaml"))).toBe(false);
    expect(readdirSync(astra)).toEqual(["SOUL.md"]);
    expect(run(home).status).toBe(0);

    const empty = join(work, "hermes-empty"); mkdirSync(empty);
    const missing = run(empty, "--apply"); expect(missing.status).toBe(2); expect(readdirSync(empty)).toEqual([]);
  }, 180_000);
});
