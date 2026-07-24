/**
 * Plain MV3 익스텐션 ZIP 패키징
 * 루트의 manifest.json · *.js · icons/*.png 를 모두 포함합니다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const JSZip = (await import(pathToFileURL(path.join(ROOT, "node_modules/jszip/dist/jszip.min.js")).href)).default;
const EXT_DIR = path.resolve(__dirname, "..");
const BUILD_DIR = path.join(EXT_DIR, "build");

function collectFiles() {
  const files = ["manifest.json"];

  for (const name of fs.readdirSync(EXT_DIR)) {
    if (!name.endsWith(".js")) continue;
    const abs = path.join(EXT_DIR, name);
    if (!fs.statSync(abs).isFile()) continue;
    files.push(name);
  }

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
  const included = collectFiles();
  for (const rel of included) {
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
  console.log(`[ok] files (${included.length}): ${included.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
