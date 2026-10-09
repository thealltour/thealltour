#!/usr/bin/env node
/**
 * Local QA videos for checking the shortform caption/hook layout on real phone apps (clean + guides, 720p and 1080p).
 * Text goes through the production ASS renderer and pinned font; every cue and the hook is measured in rendered frames against its box.
 * Usage: npx tsx scripts/narration-platform-qa-video.ts [outDir]   (default artifacts/narration-platform-qa). No network, DB or job queue.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const Module = require("module") as { _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string };
const original = Module._resolveFilename.bind(Module); const stub = require.resolve("./shims/server-only.js");
Module._resolveFilename = (request, parent, isMain, options) => request === "server-only" ? stub : original(request, parent, isMain, options);

const CUE_MS = 2500; const HOOK_MS = 3000; const FPS = 30;
const MIXED = "Jeju Olle 7코스는 2026년 3월 1일(일)부터 09:00~18:00 운영하며, 입장료는 1,500원입니다!";
const HOOKS = ["출발 전 꼭 확인할 세 가지와 주차 꿀팁", "주말 아침 해안도로, 주차 걱정 없이 가는 법", "출발 전 꼭 확인할 세 가지"];
const FILL_WORDS = "제주 동쪽 해안도로는 봄철 주말마다 차량이 많아 이른 아침에 출발하면 성산일출봉 주변 주차장을 비교적 여유 있게 이용할 수 있습니다".split(" ");
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  const out = resolve(process.argv[2] ?? "artifacts/narration-platform-qa"); mkdirSync(out, { recursive: true });
  const { captionFontMetrics, proposeSentenceRanges } = await import("@/lib/marketing/publishable/narrationShortform/captionPlan");
  const { captionFontPath, layoutBox, layoutPolicyFingerprint, wrapTextLines, textStyle, SHORTFORM_LAYOUT_POLICY } = await import("@/lib/marketing/publishable/narrationShortform/layoutPolicy");
  const { textWidthPx, renderedEmPx } = await import("@/lib/marketing/publishable/narrationShortform/fontMetrics");
  const { renderCaptionAss } = await import("@/lib/marketing/publishable/narrationShortform/motionSubtitles");
  const { runFfmpeg } = await import("@/lib/marketing/assets/ffmpeg/exec");
  const { filterPath } = await import("@/lib/marketing/publishable/narrationShortform/motionGraph");
  const metrics = captionFontMetrics(); const fontDirectory = dirname(captionFontPath());
  const fits = (text: string, kind: "caption" | "hook", lines: number) => [[720, 1280], [1080, 1920]].every(([w, h]) => wrapTextLines(metrics, text, kind, w, h)?.length === lines);
  const hook = HOOKS.find(text => fits(text, "hook", 2)); if (!hook) throw new Error("no two-line hook candidate fits");
  // Boundary-near: grow word by word while the caption still fits two lines; the last fit is the widest the layout accepts.
  const longest = (lines: number) => { let text = ""; for (const word of FILL_WORDS) { const next = text ? `${text} ${word}` : word; if (!fits(next, "caption", 1) && !(lines === 2 && fits(next, "caption", 2))) break; text = next; } return text; };
  const boundaryOneLine = longest(1); const boundary = longest(2);
  const cps = [...MIXED]; const mixedSegment = { segmentId: randomUUID(), ordinal: 1, text: MIXED, startMs: 0, endMs: 8000, durationMs: 8000 } as Parameters<typeof proposeSentenceRanges>[0];
  const mixed = proposeSentenceRanges(mixedSegment, metrics).map(([a, b]) => cps.slice(a, b).join("").trim());
  const captions = [{ label: "short_one_line", text: "주차장 먼저 확인" }, { label: "boundary_one_line", text: boundaryOneLine }, { label: "boundary_two_lines", text: boundary },
    ...mixed.map((text, i) => ({ label: `long_mixed_${i + 1}_of_${mixed.length}`, text }))];
  const unfit = captions.filter(c => !fits(c.text, "caption", 1) && !fits(c.text, "caption", 2)); if (unfit.length) throw new Error(`QA caption does not fit: ${JSON.stringify(unfit)}`);
  const cues = captions.map((c, i) => ({ cueId: randomUUID(), sentenceId: mixedSegment.segmentId, ordinal: i + 1, sourceStart: 0, sourceEnd: 1, text: c.text, startMs: i * CUE_MS, endMs: (i + 1) * CUE_MS, timingSource: "manual" as const, reviewed: true }));
  const totalMs = cues.length * CUE_MS; const manifest: Record<string, unknown> = { presetPolicyId: SHORTFORM_LAYOUT_POLICY.policyId, presetFingerprint: layoutPolicyFingerprint(), platformValidation: SHORTFORM_LAYOUT_POLICY.platformValidation,
    fontSha256: metrics.sha256, hook: { text: hook, startMs: 0, endMs: HOOK_MS }, captions: cues.map((c, i) => ({ label: captions[i]!.label, text: c.text, startMs: c.startMs, endMs: c.endMs })), renders: {} };
  for (const [width, height] of [[720, 1280], [1080, 1920]] as const) {
    const size = `${width}x${height}`; const ass = join(out, `qa-${size}.ass`);
    writeFileSync(ass, renderCaptionAss({ cues, hook: { text: hook, startMs: 0, endMs: HOOK_MS }, metrics, width, height }));
    const background = `color=c=0x1d2a33:s=${size}:r=${FPS}:d=${totalMs / 1000},drawgrid=width=${width / 10}:height=${height / 10}:thickness=1:color=white@0.22`;
    const subtitles = `ass=filename='${filterPath(ass)}':fontsdir='${filterPath(fontDirectory)}'`;
    const boxes = (["requiredText", "hook", "caption"] as const).map((name, k) => { const b = layoutBox(name, width, height); return `drawbox=x=${b.x0}:y=${b.y0}:w=${b.x1 - b.x0}:h=${b.y1 - b.y0}:color=${["white", "yellow", "cyan"][k]}@0.9:t=${width / 360}`; }).join(",");
    const videos: Record<string, string> = {};
    for (const variant of ["clean", "guides"] as const) {
      const file = join(out, `qa-${size}-${variant}.mp4`);
      await runFfmpeg({ args: ["-hide_banner", "-nostdin", "-loglevel", "error", "-y", "-f", "lavfi", "-i", background, "-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo`, "-t", String(totalMs / 1000),
        "-vf", variant === "clean" ? subtitles : `${subtitles},${boxes}`, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", "-shortest", "-movflags", "+faststart", file], timeoutMs: 10 * 60_000 });
      videos[variant] = sha(readFileSync(file));
    }
    // Lossless frames from the same graph: text pixels = difference from the text-free background, split at the gap between hook and caption boxes.
    const frames = cues.map(c => Math.round((c.startMs + CUE_MS / 2) * FPS / 1000)); const raw = join(out, `.qa-${size}.gray`); const base = join(out, `.qa-${size}-bg.gray`);
    await runFfmpeg({ args: ["-hide_banner", "-nostdin", "-loglevel", "error", "-y", "-f", "lavfi", "-i", background, "-vf", `${subtitles},select='${frames.map(f => `eq(n\\,${f})`).join("+")}',format=gray`, "-fps_mode", "passthrough", "-f", "rawvideo", raw], timeoutMs: 5 * 60_000 });
    await runFfmpeg({ args: ["-hide_banner", "-nostdin", "-loglevel", "error", "-y", "-f", "lavfi", "-i", background, "-vf", "format=gray", "-frames:v", "1", "-f", "rawvideo", base], timeoutMs: 60_000 });
    const pixels = readFileSync(raw); const bg = readFileSync(base); const frameSize = width * height; const hookBox = layoutBox("hook", width, height); const captionBox = layoutBox("caption", width, height);
    const split = Math.round((hookBox.y1 + captionBox.y0) / 2);
    const inkBox = (frame: Buffer, y0: number, y1: number) => { let a = width; let b = height; let c = -1; let d = -1;
      for (let y = y0; y < y1; y++) for (let x = 0; x < width; x++) if (Math.abs(frame[y * width + x]! - bg[y * width + x]!) > 24) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
      return c < 0 ? null : { x0: a, y0: b, x1: c + 1, y1: d + 1 }; };
    const inside = (ink: { x0: number; y0: number; x1: number; y1: number } | null, box: typeof hookBox) => !!ink && ink.x0 >= box.x0 && ink.y0 >= box.y0 && ink.x1 <= box.x1 && ink.y1 <= box.y1;
    const style = textStyle("caption", width, height); const em = renderedEmPx(metrics, style.fontSize);
    const checks = cues.map((cue, k) => { const frame = pixels.subarray(k * frameSize, (k + 1) * frameSize); const caption = inkBox(frame, split, height); const top = inkBox(frame, 0, split);
      const lines = wrapTextLines(metrics, cue.text, "caption", width, height)!;
      return { label: captions[k]!.label, lines, widestLineRatio: Math.round(Math.max(...lines.map(l => textWidthPx(metrics, l, em))) / style.maxLineWidth * 1000) / 1000, caption, captionBox, captionInside: inside(caption, captionBox),
        hook: frames[k]! * 1000 / FPS < HOOK_MS ? { ink: top, box: hookBox, inside: inside(top, hookBox) } : { ink: top, expectedEmpty: true, inside: top === null } }; });
    const failed = checks.filter(c => !c.captionInside || !c.hook.inside);
    (manifest.renders as Record<string, unknown>)[size] = { videos: Object.fromEntries(Object.entries(videos).map(([k, v]) => [k, { file: `qa-${size}-${k}.mp4`, sha256: v }])), checks, allInside: failed.length === 0 };
    await runFfmpeg({ args: ["-hide_banner", "-nostdin", "-loglevel", "error", "-y", "-ss", String((CUE_MS * 2.5) / 1000), "-i", join(out, `qa-${size}-guides.mp4`), "-frames:v", "1", join(out, `qa-${size}-guides-boundary.png`)], timeoutMs: 60_000 });
    await runFfmpeg({ args: ["-hide_banner", "-nostdin", "-loglevel", "error", "-y", "-ss", "1.25", "-i", join(out, `qa-${size}-guides.mp4`), "-frames:v", "1", join(out, `qa-${size}-guides-hook.png`)], timeoutMs: 60_000 });
    for (const f of [raw, base]) rmSync(f, { force: true });
    if (failed.length) { writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2)); throw new Error(`layout check failed at ${size}: ${failed.map(f => f.label).join(", ")}`); }
  }
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ out, hook, captions: captions.map(c => c.label), renders: Object.fromEntries(Object.entries(manifest.renders as Record<string, { allInside: boolean }>).map(([k, v]) => [k, v.allInside])) }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
