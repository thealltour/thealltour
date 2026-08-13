/**
 * 실제 .hwp / .hwpx 에서 parseHwpFileToText 가 뽑은 원문을 파일로 저장합니다.
 * OpenAI 호출 없음.
 *
 * 실행: npx tsx scripts/test-hwp-extract.ts
 * 입력: 프로젝트 루트 sample.hwp (또는 인자로 경로)
 * 출력: 프로젝트 루트 extracted_sample.txt
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const Module = require("module") as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
};
const originalResolve = Module._resolveFilename.bind(Module);
const serverOnlyStub = require.resolve("./shims/server-only.js");
Module._resolveFilename = function resolveFilename(
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
) {
  if (request === "server-only") return serverOnlyStub;
  return originalResolve(request, parent, isMain, options);
};

const ROOT = process.cwd();
const inputPath = path.resolve(ROOT, process.argv[2] || "sample.hwp");
const outputPath = path.resolve(ROOT, "extracted_sample.txt");

function countTabRows(text: string): number {
  return text.split(/\n/).filter((line) => line.includes("\t")).length;
}

async function main() {
  if (!existsSync(inputPath)) {
    console.error(
      `입력 파일이 없습니다: ${inputPath}\n프로젝트 루트에 sample.hwp 를 두거나, 경로를 인자로 넘기세요.`,
    );
    process.exit(1);
  }

  const { parseHwpFileToText } = await import("../src/lib/admin/bandImport/hwpParser");
  const buffer = readFileSync(inputPath);
  const filename = path.basename(inputPath);

  console.log(`입력: ${inputPath} (${buffer.length} bytes)`);
  const text = await parseHwpFileToText(buffer, filename);
  writeFileSync(outputPath, text, "utf8");

  const lines = text.length === 0 ? 0 : text.split("\n").length;
  console.log(`출력: ${outputPath}`);
  console.log(`문자 수: ${text.length}`);
  console.log(`줄 수: ${lines}`);
  console.log(`탭 구분 행(표 추정): ${countTabRows(text)}`);
  console.log("--- 미리보기 (앞 800자) ---");
  console.log(text.slice(0, 800));
  console.log("--- 미리보기 (뒤 400자) ---");
  console.log(text.slice(-400));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`추출 실패: ${message}`);
  process.exit(1);
});
