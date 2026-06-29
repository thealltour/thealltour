/**
 * Plain MV3 익스텐션 ZIP 패키징
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const JSZip = (await import(pathToFileURL(path.join(ROOT, "node_modules/jszip/dist/jszip.min.js")).href)).default;
const EXT_DIR = path.resolve(__dirname, "..");
const BUILD_DIR = path.join(EXT_DIR, "build");

const INCLUDE = [
  "manifest.json",
  "background.js",
  "content.js",
  "htmlContextExtract.js",
];

function collectFiles() {
  const files = [...INCLUDE];
  const iconsDir = path.join(EXT_DIR, "icons");
  if (fs.existsSync(iconsDir)) {
    for (const name of fs.readdirSync(iconsDir)) {
      if (name.endsWith(".png")) {
        files.push(`icons/${name}`);
      }
    }
  }
  return files;
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(EXT_DIR, "package.json"), "utf8"));
  const version = String(pkg.version ?? "0.0.0");
  const zipName = `thealltour_extension-${version}.zip`;

  fs.mkdirSync(BUILD_DIR, { recursive: true });

  const zip = new JSZip();
  for (const rel of collectFiles()) {
    const abs = path.join(EXT_DIR, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`Missing file: ${rel}`);
    }
    zip.file(rel.replace(/\\/g, "/"), fs.readFileSync(abs));
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const outPath = path.join(BUILD_DIR, zipName);
  fs.writeFileSync(outPath, buffer);
  console.log(`[ok] ${outPath} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
