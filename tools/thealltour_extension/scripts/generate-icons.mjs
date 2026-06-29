/**
 * thealltour_extension 아이콘 생성 — 다크 배경 + cyan→indigo progress bar
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const sharp = (await import(pathToFileURL(path.join(ROOT, "node_modules/sharp/lib/index.js")).href)).default;
const ICONS_DIR = path.resolve(__dirname, "..", "icons");
const SIZES = [16, 32, 48, 128];

function buildSvg(size) {
  const pad = Math.round(size * 0.12);
  const radius = Math.round(size * 0.22);
  const barH = Math.max(2, Math.round(size * 0.1));
  const barY = Math.round(size * 0.55);
  const barX = pad;
  const barW = size - pad * 2;
  const fillW = Math.round(barW * 0.65);
  const trackRx = Math.round(barH / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#1a1d23"/>
  <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="${trackRx}" fill="rgba(255,255,255,0.15)"/>
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
  </defs>
  <rect x="${barX}" y="${barY}" width="${fillW}" height="${barH}" rx="${trackRx}" fill="url(#g)"/>
</svg>`;
}

async function main() {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  for (const size of SIZES) {
    const svg = Buffer.from(buildSvg(size));
    const outPath = path.join(ICONS_DIR, `icon${size}.png`);
    await sharp(svg).png().toFile(outPath);
    console.log(`[ok] ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
