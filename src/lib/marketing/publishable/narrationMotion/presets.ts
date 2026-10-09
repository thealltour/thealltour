import { join } from "node:path";
import { sha256FileSync } from "@/lib/marketing/assets/hashing";
import type { MotionChoice } from "./contracts";
export const DEPTH_MODEL_SHA256 = "715fade13be8f229f8a70cc02066f656f2423a59effd0579197bbf57860e1378";
export function resolveMotionConfig(choice: MotionChoice) {
  const standard = choice.strength === "standard";
  return { version: "scene-motion-v1" as const, ...choice, width: 720 as const, height: 1280 as const, fps: 30 as const,
    horizontal: choice.preset === "parallax" ? (standard ? .054 : .027) : 0,
    vertical: choice.preset === "parallax" ? (standard ? .009 : .0045) : 0,
    zoom: choice.preset === "parallax" ? (standard ? 1.14 : 1.08) : 1,
    lightGain: choice.preset === "light_shadow" ? (standard ? .22 : .12) : 0,
    depthModelSha256: choice.preset === "parallax" ? DEPTH_MODEL_SHA256 : null,
    runnerSha256: sha256FileSync(join(process.cwd(), "scripts/mini-pc/narration-motion/runner.py")),
    crf: 16 as const, threads: 4 as const };
}
