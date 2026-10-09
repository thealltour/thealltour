import type { AudioMasterTimeline } from "@/lib/marketing/tts/timeline/contracts";
import { assertTimelineReadyForSubtitles } from "@/lib/marketing/tts/subtitles/validate";
import { NarrationError } from "../narration/persistence";
import { formatSrtTimestamp } from "@/lib/marketing/tts/subtitles/format";
import type { MotionShortformJob } from "./motionContracts";
import type { CaptionCue } from "./captionContracts";
import type { FontMetrics } from "./fontMetrics";
import { assFontSize, textStyle, wrapTextLines, SHORTFORM_LAYOUT_POLICY } from "./layoutPolicy";
export const assCentiseconds = (ms: number) => Math.round(ms / 10);
const time = (ms: number) => {
  const cs = assCentiseconds(ms); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const escapeAss = (line: string) => line.replace(/\\/g, "＼").replace(/{/g, "｛").replace(/}/g, "｝");
export type CaptionOverlayHook = { text: string; startMs: number; endMs: number };
type OverlayKind = "caption" | "hook";
function overlayLines(metrics: FontMetrics, kind: OverlayKind, text: string, width: number, height: number) {
  const lines = wrapTextLines(metrics, text, kind, width, height);
  if (!lines) throw new NarrationError(kind === "hook" ? "수정 필요: 도입 문구가 상단 영역 2줄을 넘습니다. 글자를 줄이지 않으니 문구를 고쳐주세요." : "자막 cue가 자막 영역 2줄을 넘습니다. 더 나눠주세요.", 409);
  return lines;
}
function assHeader(metrics: FontMetrics, width: number, height: number) {
  const style = (name: string, kind: OverlayKind) => { const s = textStyle(kind, width, height);
    return `Style: ${name},${SHORTFORM_LAYOUT_POLICY.font.family},${assFontSize(metrics, kind, width, height)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${s.outline},${s.shadow},${s.alignment},0,0,0,1`; };
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n${style("Caption", "caption")}\n${style("Hook", "hook")}\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
}
function dialogue(kind: OverlayKind, lines: string[], startMs: number, endMs: number, width: number, height: number) {
  if (time(startMs) === time(endMs)) throw new NarrationError("반올림 후 길이가 0인 자막은 만들 수 없습니다.", 409);
  const s = textStyle(kind, width, height);
  return `Dialogue: ${kind === "hook" ? 1 : 0},${time(startMs)},${time(endMs)},${kind === "hook" ? "Hook" : "Caption"},,0,0,0,,{\\an${s.alignment}\\pos(${Math.round(s.centerX)},${Math.round(s.anchorY)})}${lines.map(escapeAss).join("\\N")}`;
}
/** v3: one Dialogue per reviewed cue at a fixed safe-area anchor. No preview guide is ever written here. */
export function renderCaptionAss(input: { cues: CaptionCue[]; hook: CaptionOverlayHook | null; metrics: FontMetrics; width?: number; height?: number }) {
  const width = input.width ?? 720; const height = input.height ?? 1280;
  const events = input.cues.map(c => dialogue("caption", overlayLines(input.metrics, "caption", c.text, width, height), c.startMs, c.endMs, width, height));
  if (input.hook) events.unshift(dialogue("hook", overlayLines(input.metrics, "hook", input.hook.text, width, height), input.hook.startMs, input.hook.endMs, width, height));
  return assHeader(input.metrics, width, height) + events.join("\n") + "\n";
}
/** Same artifact and line breaks as ASS; the hook is an overlay, not a caption cue. */
export function renderCaptionSrt(cues: CaptionCue[], metrics: FontMetrics) {
  return `${cues.map((c, i) => `${i + 1}\n${formatSrtTimestamp(c.startMs)} --> ${formatSrtTimestamp(c.endMs)}\n${overlayLines(metrics, "caption", c.text, 720, 1280).join("\n")}\n`).join("\n")}\n`;
}
/** Test/QA ASS: shows overlay k alone during [k*100ms, k*100ms+100ms) so libass bounds can be measured per item. */
export function renderLayoutProbeAss(items: { kind: OverlayKind; text: string }[], metrics: FontMetrics, width = 720, height = 1280) {
  return assHeader(metrics, width, height) + items.map((item, k) => dialogue(item.kind, overlayLines(metrics, item.kind, item.text, width, height), k * 100, k * 100 + 100, width, height)).join("\n") + "\n";
}
function wrap(text: string, maxUnits: number, maxLines: number) {
  const lines: string[] = []; let line = ""; let units = 0;
  // Korean/fullwidth glyphs count as two approximate display units. Never truncate copy.
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    const width = [...word].reduce((n, c) => n + (c.codePointAt(0)! > 255 ? 2 : 1), 0);
    if (width > maxUnits) {
      if (line) { lines.push(line); line = ""; units = 0; }
      for (const c of word) { const size = c.codePointAt(0)! > 255 ? 2 : 1; if (units + size > maxUnits) { lines.push(line); line = ""; units = 0; } line += c; units += size; }
    } else {
      if (line && units + 1 + width > maxUnits) { lines.push(line); line = ""; units = 0; }
      const gap = line ? " " : ""; line += gap + word; units += gap.length + width;
    }
  }
  if (line) lines.push(line);
  if (!lines.length || lines.length > maxLines) throw new NarrationError("자막이 너무 깁니다. 해당 Narration 문장을 검토해주세요. 문장을 자동 분할하거나 줄이지 않습니다.", 409);
  // ASS control syntax must never come from narration copy.
  return lines.map(l => l.replace(/\\/g, "＼").replace(/{/g, "｛").replace(/}/g, "｝")).join("\\N");
}
export function renderMotionAss(timeline: AudioMasterTimeline, config: MotionShortformJob["renderConfig"]) {
  assertTimelineReadyForSubtitles(timeline);
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: 720\nPlayResY: 1280\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${config.fontFamily},${config.fontSize},&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,3,1,2,${config.marginH},${config.marginH},${config.marginV},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n` +
    timeline.segments.map(s => { if (time(s.startMs) === time(s.endMs)) throw new NarrationError("자막으로 표현할 수 없는 음성 구간입니다.", 409);
      for (const size of [config.fontSize, 34, 30, config.minFontSize]) {
        try { const text = wrap(s.text, Math.floor(config.maxLineUnits * config.fontSize / size), config.maxLines);
          return `Dialogue: 0,${time(s.startMs)},${time(s.endMs)},Default,,0,0,0,,{\\fs${size}}${text}`; }
        catch (error) { if (size === config.minFontSize) throw error; }
      }
      throw new NarrationError("자막을 배치하지 못했습니다.", 409);
    }).join("\n") + "\n";
}
