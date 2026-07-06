/**
 * 상품 상세 달력·예약금 CTA 노출 진단
 *
 * 실행: npx tsx scripts/diagnose-product-booking-ux.ts [productId ...]
 * 예:   npx tsx scripts/diagnose-product-booking-ux.ts ef6bc693-34f0-4633-a759-e3c01620a621
 *
 * .env.local 의 Supabase 키를 자동 로드합니다.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_IDS = [
  "ef6bc693-34f0-4633-a759-e3c01620a621",
  "7bc14169-f7c5-455c-bd50-1af49a9a16b9",
];

function loadEnvLocal() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
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

loadEnvLocal();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (또는 ANON_KEY) 필요합니다.",
    );
    process.exit(1);
  }

  const { normalizeProduct } = await import("../src/lib/products");
  const { hydrateProductsWithCampaignCardMeta } = await import("../src/lib/productCampaignResolve");
  const { diagnoseProductBookingUx } = await import("../src/lib/products/diagnoseProductBookingUx");

  const ids = process.argv.slice(2);
  const productIds = ids.length > 0 ? ids : DEFAULT_IDS;

  const supabase = createClient(url, key);

  const { data: taxonomies } = await supabase
    .from("product_taxonomies")
    .select("*")
    .eq("taxonomy_type", "campaign")
    .eq("is_active", true);

  for (const id of productIds) {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      console.error(`\n[${id}] 조회 실패:`, error?.message ?? "not found");
      continue;
    }

    const normalized = normalizeProduct(data as Record<string, unknown>);
    const product = hydrateProductsWithCampaignCardMeta(
      [normalized],
      (taxonomies ?? []) as Parameters<typeof hydrateProductsWithCampaignCardMeta>[1],
    )[0]!;

    const d = diagnoseProductBookingUx(product);

    console.log("\n" + "=".repeat(72));
    console.log(`상품: ${d.title}`);
    console.log(`ID:   ${d.productId}`);
    console.log("-".repeat(72));
    console.log(`bookingUxMode:          ${d.bookingUxMode}`);
    console.log(`departureUi:            ${d.departureUi}`);
    console.log(`showCalendarBooking:    ${d.showCalendarBooking}`);
    console.log(`hasBookingPanel:        ${d.hasBookingPanel}`);
    console.log(`showDepositSection:     ${d.showDepositSection}`);
    console.log(`calendarDepartureCount: ${d.calendarDepartureCount}`);
    console.log(`scheduleRowCount:       ${d.scheduleRowCount}`);
    console.log(`legacyDepartureCount:   ${d.legacyDepartureCount}`);
    console.log(`hasDepartureRange:      ${d.hasDepartureRange}`);
    console.log(`hasOptions:             ${d.hasOptions}`);
    console.log(`seasonalBandsPresent:   ${d.seasonalBandsPresent}`);
    console.log(`isPromotionCampaign:    ${d.isPromotionCampaign}`);
    console.log("-".repeat(72));
    console.log(`기대 UI: ${d.uiExpectation}`);

    const portoneConfigured = Boolean(
      process.env.PORTONE_STORE_ID?.trim() &&
        process.env.PORTONE_CHANNEL_KEY?.trim() &&
        process.env.PORTONE_API_SECRET?.trim(),
    );
    console.log(
      `PortOne env:            ${portoneConfigured ? "설정됨 (결제 가능)" : "미설정 (UI는 표시, prepare API 503)"}`,
    );
  }

  console.log("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
