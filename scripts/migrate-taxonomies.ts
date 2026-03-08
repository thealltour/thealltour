/**
 * PR-TAX-4: Taxonomy 데이터 재분류 스크립트
 *
 * - 기존 product_taxonomies 행을 이름 기반으로 taxonomy_type에 맞게 재분류한다.
 * - 명확한 항목은 자동 매핑, 애매한 항목은 manual review 리스트로 출력.
 *
 * 실행:
 *   npx tsx scripts/migrate-taxonomies.ts           # dry-run (기본)
 *   npx tsx scripts/migrate-taxonomies.ts --apply   # DB 반영
 *
 * 필요 환경변수: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * (또는 .env.local 로드 후 실행)
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

const DESTINATION_NAMES = new Set([
  "일본",
  "태국",
  "호주",
  "제주도",
  "베트남",
  "동남아",
  "유럽",
  "미국",
  "남미",
  "미국·남미",
  "인도네시아",
  "남아시아",
  "괌",
  "사이판",
  "필리핀",
  "말레이시아",
  "싱가포르",
  "캄보디아",
  "라오스",
  "미얀마",
  "네팔",
  "인도",
  "스리랑카",
  "중국",
  "홍콩",
  "마카오",
  "대만",
  "몽골",
  "러시아",
  "독일",
  "프랑스",
  "이탈리아",
  "스페인",
  "영국",
  "스위스",
  "오스트리아",
  "그리스",
  "터키",
  "두바이",
  "이집트",
  "남아프리카",
  "케냐",
  "브라질",
  "아르헨티나",
  "칠레",
  "페루",
  "캐나다",
  "하와이",
]);

const THEME_NAMES = new Set([
  "가족여행",
  "럭셔리",
  "휴양",
  "벚꽃여행",
  "허니문",
  "프리미엄",
  "제철",
  "단체",
  "단체/동호회",
  "동호회",
  "맞춤여행",
  "골프",
  "허니문여행",
  "제철여행",
  "제철여행지",
]);

const PRODUCT_LINE_NAMES = new Set([
  "골프투어",
  "파크골프투어",
  "파크골프",
  "액티비티",
  "골프",
]);

const CAMPAIGN_NAMES = new Set([
  "마감임박",
  "추천",
  "시즌특가",
  "인기",
  "특가",
  "신규",
  "베스트",
]);

function suggestTaxonomyType(
  name: string,
  currentType: string,
  categoryType: string | null,
): TaxonomyType | null {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;

  if (DESTINATION_NAMES.has(trimmed)) return "destination";
  if (CAMPAIGN_NAMES.has(trimmed)) return "campaign";
  if (PRODUCT_LINE_NAMES.has(trimmed)) return "product_line";
  if (THEME_NAMES.has(trimmed)) return "theme";

  return null;
}

function legacyToTaxonomyType(
  type: string,
  categoryType: string | null,
): TaxonomyType {
  if (type === "theme") return "theme";
  if (categoryType === "destination") return "destination";
  if (categoryType === "product_line") return "product_line";
  if (categoryType === "highlight" || categoryType === "other")
    return "campaign";
  return "destination";
}

type Row = {
  id: string;
  type: string;
  taxonomy_type: string | null;
  category_type: string | null;
  name: string;
  slug: string | null;
};

async function main() {
  const apply = process.argv.includes("--apply");
  const supabase = createClient(url!, key!);

  const { data: rows, error } = await supabase
    .from("product_taxonomies")
    .select("id, type, taxonomy_type, category_type, name, slug")
    .order("type")
    .order("name");

  if (error) {
    console.error("product_taxonomies 조회 실패:", error.message);
    process.exit(1);
  }

  const items = (rows ?? []) as Row[];
  const toUpdate: { row: Row; suggested: TaxonomyType }[] = [];
  const manualReview: Row[] = [];

  for (const row of items) {
    const current =
      row.taxonomy_type && String(row.taxonomy_type).trim() !== ""
        ? (row.taxonomy_type as TaxonomyType)
        : legacyToTaxonomyType(
            row.type,
            row.category_type ?? null,
          );
    const suggested = suggestTaxonomyType(
      row.name,
      row.type,
      row.category_type ?? null,
    );

    if (suggested != null && suggested !== current) {
      toUpdate.push({ row, suggested });
    } else if (suggested == null) {
      manualReview.push(row);
    }
  }

  console.log("\n=== Taxonomy 마이그레이션 (이름 기반 재분류) ===\n");
  console.log(`총 ${items.length}건`);
  console.log(`자동 재분류 대상: ${toUpdate.length}건`);
  console.log(`수동 검토 대상: ${manualReview.length}건\n`);

  if (toUpdate.length > 0) {
    console.log("--- 자동 재분류 대상 ---");
    for (const { row, suggested } of toUpdate) {
      const current =
        row.taxonomy_type && String(row.taxonomy_type).trim() !== ""
          ? row.taxonomy_type
          : legacyToTaxonomyType(row.type, row.category_type ?? null);
      console.log(
        `  id=${row.id} name="${row.name}" ${current} -> ${suggested}`,
      );
    }
    console.log("");

    if (apply) {
      const legacyType = (tt: TaxonomyType) =>
        tt === "theme" ? "theme" : "category";
      const legacyCategoryType = (tt: TaxonomyType): string | null => {
        if (tt === "destination") return "destination";
        if (tt === "product_line") return "product_line";
        if (tt === "campaign") return "highlight";
        return null;
      };
      for (const { row, suggested } of toUpdate) {
        const type = legacyType(suggested);
        const category_type =
          type === "category" ? legacyCategoryType(suggested) : null;
        const payload: Record<string, unknown> = {
          taxonomy_type: suggested,
          type,
          ...(category_type != null && { category_type }),
        };
        const { error: updateError } = await supabase
          .from("product_taxonomies")
          .update(payload)
          .eq("id", row.id);
        if (updateError) {
          console.error(`  업데이트 실패 id=${row.id}:`, updateError.message);
        }
      }
      console.log("자동 재분류 적용 완료.\n");
    } else {
      console.log("실제 반영하려면 --apply 옵션으로 다시 실행하세요.\n");
    }
  }

  if (manualReview.length > 0) {
    console.log("--- 수동 검토 대상 (이름 기반 매핑에 없음) ---");
    for (const row of manualReview) {
      const current =
        row.taxonomy_type && String(row.taxonomy_type).trim() !== ""
          ? row.taxonomy_type
          : legacyToTaxonomyType(row.type, row.category_type ?? null);
      console.log(
        `  id=${row.id} type=${row.type} category_type=${row.category_type ?? "-"} taxonomy_type=${current} name="${row.name}"`,
      );
    }
    console.log("\ndocs/taxonomy-migration-guide.md 매핑 기준을 참고해 관리자 UI 또는 SQL로 재분류하세요.\n");
  }
}

main();
