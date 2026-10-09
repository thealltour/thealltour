import "server-only";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";

export function voiceStudioExecutionLockPath(endpointIdentity: string): string {
  const cache = join(homedir(), ".cache/thealltour/narration-audio");
  mkdirSync(cache, { recursive: true });
  return join(cache, `${createHash("sha256").update(endpointIdentity).digest("hex")}.lock`);
}

/** Hold the same flock as the full narration worker; previews never overtake an active job. */
export async function withVoiceStudioPreviewLock<T>(endpointIdentity: string, run: () => Promise<T>): Promise<T> {
  if (process.platform !== "linux" || !existsSync("/usr/bin/flock")) throw new NarrationError("미리듣기 실행기를 사용할 수 없습니다.", 503);
  const holder = spawn("/usr/bin/flock", ["-n", "-E", "75", voiceStudioExecutionLockPath(endpointIdentity), process.execPath,
    "-e", "process.stdout.write('ready\\n'); process.stdin.resume(); process.stdin.on('end',()=>process.exit(0));"],
  { shell: false, stdio: ["pipe", "pipe", "ignore"] });
  holder.stdin.on("error", () => { /* Child exit closes its input pipe. */ });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { holder.kill(); reject(new NarrationError("미리듣기 실행기가 응답하지 않습니다.", 503)); }, 10_000);
      const done = () => clearTimeout(timer);
      holder.once("error", () => { done(); reject(new NarrationError("미리듣기 실행기를 시작하지 못했습니다.", 503)); });
      holder.once("exit", code => { done(); reject(new NarrationError(code === 75 ? "다른 음성을 생성 중입니다. 완료 후 미리듣기를 눌러주세요." : "미리듣기 실행기가 종료됐습니다.", code === 75 ? 429 : 503)); });
      holder.stdout.once("data", () => { done(); resolve(); });
    });
    return await run();
  } finally { holder.stdin.end(); holder.kill(); }
}
