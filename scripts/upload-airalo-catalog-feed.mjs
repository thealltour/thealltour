/**
 * Upload local Airalo Google Merchant XML to Supabase public Storage.
 *
 * Usage:
 *   node scripts/upload-airalo-catalog-feed.mjs
 *   node scripts/upload-airalo-catalog-feed.mjs --xml="C:/path/to/feed.xml"
 *
 * Env (.env.local): NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 * Never prints secret values or full feed contents.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BUCKET = "affiliate-feeds";
const OBJECT_PATH = "airalo/product-catalog.xml";
const DEFAULT_XML = path.join(
  os.homedir(),
  "Downloads",
  "Airalo-Product-Catalog_GOOGLE (1) (1).xml",
);

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const xmlArg = argv.find((a) => a.startsWith("--xml="));
  return { xmlPath: xmlArg ? xmlArg.slice("--xml=".length) : DEFAULT_XML };
}

async function ensureBucket(supabase) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Failed to list buckets: ${listError.message}`);
  }
  if (buckets?.some((b) => b.id === BUCKET || b.name === BUCKET)) {
    return { created: false };
  }
  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 25 * 1024 * 1024,
    allowedMimeTypes: ["application/xml", "text/xml", "application/octet-stream"],
  });
  if (createError) {
    throw new Error(`Failed to create bucket "${BUCKET}": ${createError.message}`);
  }
  return { created: true };
}

function summarizeUrl(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname, pathname: u.pathname };
  } catch {
    return { host: null, pathname: null };
  }
}

async function sanityFetch(publicUrl) {
  const res = await fetch(publicUrl, { redirect: "follow" });
  const text = await res.text();
  const ctype = res.headers.get("content-type") || "";
  return {
    http: res.status,
    ctype,
    bytes: text.length,
    virusScan: /Virus scan warning/i.test(text),
    looksHtml: /<!DOCTYPE html|<html[\s>]/i.test(text),
    rss: /<rss[\s>]/i.test(text),
    item: (text.match(/<item[\s>]/gi) || []).length,
  };
}

async function main() {
  loadEnvLocal();
  const { xmlPath } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(xmlPath)) {
    throw new Error(`XML not found: ${xmlPath}`);
  }

  const supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ""
  ).trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const bucket = await ensureBucket(supabase);
  if (bucket.created) console.log(`[ok] Created public bucket: ${BUCKET}`);
  else console.log(`[ok] Using existing bucket: ${BUCKET}`);

  const buffer = fs.readFileSync(xmlPath);
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(OBJECT_PATH, buffer, {
    upsert: true,
    contentType: "application/xml",
    cacheControl: "3600",
  });
  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(OBJECT_PATH);
  const publicUrl = publicData?.publicUrl;
  if (!publicUrl) {
    throw new Error("getPublicUrl returned empty");
  }

  const loc = summarizeUrl(publicUrl);
  console.log(
    JSON.stringify(
      {
        upload: "OK",
        bucket: BUCKET,
        objectPath: OBJECT_PATH,
        localBytes: buffer.length,
        publicHost: loc.host,
        publicPath: loc.pathname,
      },
      null,
      2,
    ),
  );

  const probe = await sanityFetch(publicUrl);
  console.log(JSON.stringify({ probe }, null, 2));
  if (probe.http !== 200 || probe.virusScan || probe.looksHtml || !probe.rss || probe.item < 1) {
    throw new Error("Public URL sanity check failed (expected RSS XML with items)");
  }

  // Print URL alone on last line for scripting (no other secrets).
  console.log(`AIRALO_FEED_URL=${publicUrl}`);
}

main().catch((err) => {
  console.error(`[fail] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
