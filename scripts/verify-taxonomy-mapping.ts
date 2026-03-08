/**
 * PR-TAX-4: Taxonomy 매핑 검증 스크립트
 *
 * - destination/theme/product_line/campaign 별 개수
 * - 중복 slug, 중복 name (taxonomy_type 내)
 * - 허브 노출/랜딩 공개 대상 개수
 * - type·category_type vs taxonomy_type 불일치 리포트
 *
 * 실행: npx tsx scripts/verify-taxonomy-mapping.ts
 *
 * 필요 환경변수: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (또는 SUPABASE_SERVICE_ROLE_KEY) 필요합니다.",
  );
  process.exit(1);
}

type TaxonomyType =
  | "destination"
  | "theme"
  | "product_line"
  | "campaign"
  | "tag";

const TAXONOMY_TYPES: TaxonomyType[] = [
  "destination",
  "theme",
  "product_line",
  "campaign",
  "tag",
];

type Row = {
  id: string;
  type: string;
  taxonomy_type: string | null;
  category_type: string | null;
  name: string;
  slug: string | null;
  is_active: boolean;
  is_hub_visible: boolean;
  is_landing_enabled: boolean;
};

function effectiveTaxonomyType(row: Row): TaxonomyType {
  const tt = row.taxonomy_type?.trim();
  if (tt && TAXONOMY_TYPES.includes(tt as TaxonomyType))
    return tt as TaxonomyType;
  if (row.type === "theme") return "theme";
  if (row.category_type === "destination") return "destination";
  if (row.category_type === "product_line") return "product_line";
  if (row.category_type === "highlight" || row.category_type === "other")
    return "campaign";
  return "destination";
}

function typeCategoryToTaxonomy(type: string, categoryType: string | null): TaxonomyType {
  if (type === "theme") return "theme";
  if (categoryType === "destination") return "destination";
  if (categoryType === "product_line") return "product_line";
  if (categoryType === "highlight" || categoryType === "other") return "campaign";
  return "destination";
}

async function main() {
  const supabase = createClient(url!, key!);

  const { data: rows, error } = await supabase
    .from("product_taxonomies")
    .select("id, type, taxonomy_type, category_type, name, slug, is_active, is_hub_visible, is_landing_enabled")
    .order("taxonomy_type")
    .order("name");

  if (error) {
    console.error("product_taxonomies 조회 실패:", error.message);
    process.exit(1);
  }

  const items = (rows ?? []) as Row[];

  console.log("\n=== Taxonomy 매핑 검증 ===\n");

  const byType = new Map<TaxonomyType, Row[]>();
  for (const tt of TAXONOMY_TYPES) {
    byType.set(tt, []);
  }
  for (const row of items) {
    const tt = effectiveTaxonomyType(row);
    byType.get(tt)!.push(row);
  }

  console.log("--- taxonomy_type별 개수 ---");
  for (const tt of TAXONOMY_TYPES) {
    const list = byType.get(tt)!;
    console.log(`  ${tt}: ${list.length}건`);
  }
  console.log("");

  const slugDuplicates: { taxonomy_type: TaxonomyType; slug: string; ids: string[] }[] = [];
  const nameDuplicates: { taxonomy_type: TaxonomyType; name: string; ids: string[] }[] = [];

  for (const tt of TAXONOMY_TYPES) {
    const list = byType.get(tt)!;
    const bySlug = new Map<string, Row[]>();
    const byName = new Map<string, Row[]>();
    for (const row of list) {
      const s = (row.slug ?? "").trim();
      if (s) {
        const arr = bySlug.get(s) ?? [];
        arr.push(row);
        bySlug.set(s, arr);
      }
      const n = (row.name ?? "").trim();
      if (n) {
        const arr = byName.get(n) ?? [];
        arr.push(row);
        byName.set(n, arr);
      }
    }
    for (const [slug, arr] of bySlug) {
      if (arr.length > 1)
        slugDuplicates.push({
          taxonomy_type: tt,
          slug,
          ids: arr.map((r) => r.id),
        });
    }
    for (const [name, arr] of byName) {
      if (arr.length > 1)
        nameDuplicates.push({
          taxonomy_type: tt,
          name,
          ids: arr.map((r) => r.id),
        });
    }
  }

  console.log("--- 중복 slug (동일 taxonomy_type 내) ---");
  if (slugDuplicates.length === 0) {
    console.log("  없음");
  } else {
    for (const d of slugDuplicates) {
      console.log(`  ${d.taxonomy_type} slug="${d.slug}" ids=${d.ids.join(", ")}`);
    }
  }
  console.log("");

  console.log("--- 중복 name (동일 taxonomy_type 내) ---");
  if (nameDuplicates.length === 0) {
    console.log("  없음");
  } else {
    for (const d of nameDuplicates) {
      console.log(`  ${d.taxonomy_type} name="${d.name}" ids=${d.ids.join(", ")}`);
    }
  }
  console.log("");

  let hubVisibleCount = 0;
  let landingEnabledCount = 0;
  for (const row of items) {
    if (row.is_active && row.is_hub_visible) hubVisibleCount++;
    if (row.is_active && row.is_landing_enabled) landingEnabledCount++;
  }
  console.log("--- 노출 설정 ---");
  console.log(`  활성 + 허브 노출: ${hubVisibleCount}건`);
  console.log(`  활성 + 랜딩 공개: ${landingEnabledCount}건`);
  console.log("");

  const conflicts: Row[] = [];
  for (const row of items) {
    const expectedFromLegacy = typeCategoryToTaxonomy(row.type, row.category_type ?? null);
    const stored = (row.taxonomy_type ?? "").trim();
    if (!stored) continue;
    const actual = TAXONOMY_TYPES.includes(stored as TaxonomyType) ? (stored as TaxonomyType) : expectedFromLegacy;
    if (actual !== expectedFromLegacy) {
      conflicts.push(row);
    }
  }
  console.log("--- type/category_type vs taxonomy_type 불일치 ---");
  if (conflicts.length === 0) {
    console.log("  없음");
  } else {
    for (const row of conflicts) {
      const expectedFromLegacy = typeCategoryToTaxonomy(row.type, row.category_type ?? null);
      console.log(
        `  id=${row.id} name="${row.name}" type=${row.type} category_type=${row.category_type ?? "-"} taxonomy_type=${row.taxonomy_type ?? "-"} (legacy 기대값: ${expectedFromLegacy})`,
      );
    }
  }
  console.log("");
}

main();
