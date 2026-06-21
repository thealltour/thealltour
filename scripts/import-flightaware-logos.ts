/**
 * FlightAware 로고(ICAO 파일명) → IATA 코드 매핑 후 public/assets/airlines/{IATA}.png import
 *
 * 실행:
 *   npm run airlines:import-logos
 *   npx tsx scripts/import-flightaware-logos.ts --source "C:/path/to/flightaware_logos"
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const DAT_PATH = path.join(ROOT, "src/lib/airlines/data/airlines.dat");
const OVERRIDES_PATH = path.join(ROOT, "src/lib/airlines/data/iata-icao-overrides.json");
const MANIFEST_PATH = path.join(ROOT, "src/lib/airlines/data/imported-airline-logos.json");
const OUT_DIR = path.join(ROOT, "public/assets/airlines");

const DEFAULT_SOURCE =
  "C:/Users/aeeni/Downloads/airline-logos-main/flightaware_logos";

type OpenFlightsRow = {
  id: string;
  name: string;
  iata: string;
  icao: string;
  callsign: string;
  country: string;
  active: boolean;
};

type ManifestEntry = {
  icao: string;
  name: string;
  source: string;
  active: boolean;
};

type Manifest = Record<string, ManifestEntry>;

type OverridesFile = {
  overrides?: Record<string, string>;
};

/** OpenFlights CSV (quoted fields, \N = null) */
function parseAirlinesDat(raw: string): OpenFlightsRow[] {
  const rows: OpenFlightsRow[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        fields.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    fields.push(current);

    const norm = (v: string) => {
      const t = v.trim();
      return t === "\\N" || t === "N/A" || t === "-" ? "" : t;
    };

    if (fields.length < 8) continue;
    rows.push({
      id: fields[0],
      name: norm(fields[1]),
      iata: norm(fields[3]).toUpperCase(),
      icao: norm(fields[4]).toUpperCase(),
      callsign: norm(fields[5]),
      country: norm(fields[6]),
      active: fields[7]?.trim() === "Y",
    });
  }
  return rows;
}

function parseArgs(argv: string[]): { source: string } {
  const idx = argv.indexOf("--source");
  const source =
    idx >= 0 && argv[idx + 1]
      ? argv[idx + 1]
      : process.env.FLIGHTAWARE_LOGOS_DIR ?? DEFAULT_SOURCE;
  return { source: path.resolve(source) };
}

function loadOverrides(): Record<string, string> {
  if (!fs.existsSync(OVERRIDES_PATH)) return {};
  const parsed = JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8")) as OverridesFile;
  const out: Record<string, string> = {};
  for (const [iata, icao] of Object.entries(parsed.overrides ?? {})) {
    if (iata.startsWith("_")) continue;
    out[iata.toUpperCase()] = icao.toUpperCase();
  }
  return out;
}

function buildIataToRecord(
  rows: OpenFlightsRow[],
  overrides: Record<string, string>,
): Map<string, OpenFlightsRow> {
  const map = new Map<string, OpenFlightsRow>();

  for (const row of rows) {
    if (!row.iata || !row.icao) continue;
    const existing = map.get(row.iata);
    if (!existing) {
      map.set(row.iata, row);
      continue;
    }
    if (row.active && !existing.active) {
      map.set(row.iata, row);
    }
  }

  for (const [iata, icao] of Object.entries(overrides)) {
    const match = rows.find((r) => r.icao === icao);
    if (match) {
      map.set(iata, { ...match, iata, icao });
    } else {
      map.set(iata, {
        id: "override",
        name: iata,
        iata,
        icao,
        callsign: "",
        country: "",
        active: true,
      });
    }
  }

  return map;
}

function main() {
  const { source } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(DAT_PATH)) {
    console.error(`airlines.dat not found: ${DAT_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(source)) {
    console.error(`FlightAware logos dir not found: ${source}`);
    process.exit(1);
  }

  const pngByIcao = new Set(
    fs
      .readdirSync(source)
      .filter((f) => f.toLowerCase().endsWith(".png"))
      .map((f) => path.basename(f, path.extname(f)).toUpperCase()),
  );

  const rows = parseAirlinesDat(fs.readFileSync(DAT_PATH, "utf8"));
  const overrides = loadOverrides();
  const iataMap = buildIataToRecord(rows, overrides);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest: Manifest = {};
  let copied = 0;
  let skippedNoPng = 0;
  const domesticCheck = ["7C", "KE", "OZ", "TW", "LJ", "ZE", "BX", "RS"];

  for (const [iata, row] of iataMap.entries()) {
    if (!pngByIcao.has(row.icao)) {
      skippedNoPng++;
      continue;
    }
    const sourceFile = path.join(source, `${row.icao}.png`);
    const destFile = path.join(OUT_DIR, `${iata}.png`);
    fs.copyFileSync(sourceFile, destFile);

    manifest[iata] = {
      icao: row.icao,
      name: row.name,
      source: `${row.icao}.png`,
      active: row.active,
    };
    copied++;

    const oldSvg = path.join(OUT_DIR, `${iata}.svg`);
    if (fs.existsSync(oldSvg)) {
      fs.unlinkSync(oldSvg);
    }
  }

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const usedIcaos = new Set(Object.values(manifest).map((e) => e.icao));
  const pngWithoutIata = [...pngByIcao].filter((icao) => !usedIcaos.has(icao)).length;

  console.log("FlightAware logo import complete");
  console.log(`  Source: ${source}`);
  console.log(`  PNG files in source: ${pngByIcao.size}`);
  console.log(`  OpenFlights IATA+ICAO pairs: ${iataMap.size}`);
  console.log(`  Copied to public/assets/airlines: ${copied}`);
  console.log(`  Skipped (no PNG for ICAO): ${skippedNoPng}`);
  console.log(`  PNG without IATA mapping: ${pngWithoutIata}`);
  console.log(`  Manifest: ${MANIFEST_PATH}`);
  console.log("");
  console.log("Domestic / key airlines:");
  for (const iata of domesticCheck) {
    const entry = manifest[iata];
    if (entry) {
      console.log(`  OK  ${iata} ← ${entry.source} (${entry.name})`);
    } else {
      const row = iataMap.get(iata);
      console.log(
        `  --  ${iata} ${row ? `(ICAO ${row.icao}, PNG missing)` : "(no OpenFlights mapping)"}`,
      );
    }
  }
}

main();
