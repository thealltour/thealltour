/**
 * 카카오모먼트 「소재」 리포트 CSV 파서 (탭/콤마 자동 감지).
 * 핵심 열만 매핑 — 장바구니·앱설치 등 전환열은 무시.
 */

import type {
  KakaoMomentCreativeRow,
  KakaoMomentParseResult,
  KakaoMomentParseSummary,
} from "@/lib/adminLandings/kakaoMomentModels";

const HEADER_MAP: Record<string, keyof KakaoMomentCreativeRow | "skip"> = {
  소재: "creativeName",
  "소재 id": "creativeId",
  "소재 ID": "creativeId",
  상태: "status",
  "심사 상태": "skip",
  "상위 광고그룹": "adGroupName",
  "상위 광고그룹 id": "adGroupId",
  "상위 광고그룹 ID": "adGroupId",
  "상위 캠페인": "campaignName",
  "상위 캠페인 id": "campaignId",
  "상위 캠페인 ID": "campaignId",
  비용: "cost",
  노출수: "impressions",
  클릭수: "clicks",
  클릭률: "ctr",
  도달수: "reach",
  "노출당 비용": "skip",
  "클릭당 비용": "cpc",
  "도달당 비용": "skip",
};

function normalizeHeader(h: string): string {
  return h.replace(/^\uFEFF/, "").trim();
}

function detectDelimiter(headerLine: string): "\t" | "," {
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return tabs >= commas ? "\t" : ",";
}

/** CSV 한 줄 분리 (간단한 따옴표 지원) */
export function splitCsvLine(line: string, delimiter: "\t" | ","): string[] {
  if (delimiter === "\t") {
    return line.split("\t").map((c) => c.trim());
  }
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** 숫자 파싱: 콤마·공백·% 제거 */
export function parseMomentNumber(raw: string | null | undefined): number {
  if (raw == null) return 0;
  const s = String(raw).trim().replace(/,/g, "").replace(/%/g, "").replace(/\s/g, "");
  if (!s || s === "-" || s === "—") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function emptyRow(): KakaoMomentCreativeRow {
  return {
    creativeName: "",
    creativeId: null,
    status: null,
    adGroupName: null,
    adGroupId: null,
    campaignName: null,
    campaignId: null,
    cost: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    reach: 0,
    cpc: 0,
  };
}

function finalizeMetrics(row: KakaoMomentCreativeRow): KakaoMomentCreativeRow {
  const impressions = Math.max(0, Math.round(row.impressions));
  const clicks = Math.max(0, Math.round(row.clicks));
  const reach = Math.max(0, Math.round(row.reach));
  const cost = Math.max(0, row.cost);
  // 노출·클릭이 있으면 CTR/CPC는 재계산 (CSV 퍼센트 표기 혼선 방지)
  const ctr = impressions > 0 ? clicks / impressions : row.ctr > 1 ? row.ctr / 100 : row.ctr;
  const cpc = clicks > 0 ? cost / clicks : row.cpc;
  return {
    ...row,
    impressions,
    clicks,
    reach,
    cost,
    ctr,
    cpc,
  };
}

function buildSummary(rows: KakaoMomentCreativeRow[]): KakaoMomentParseSummary {
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalReach = rows.reduce((s, r) => s + r.reach, 0);
  return {
    rowCount: rows.length,
    totalCost,
    totalImpressions,
    totalClicks,
    avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    avgCpc: totalClicks > 0 ? totalCost / totalClicks : 0,
    totalReach,
  };
}

/**
 * Moment 소재 리포트 텍스트 → 행 배열.
 * @throws Error 헤더/본문 검증 실패
 */
export function parseKakaoMomentCreativeCsv(csvText: string): KakaoMomentParseResult {
  const text = csvText.replace(/^\uFEFF/, "").trim();
  if (!text) throw new Error("CSV가 비어 있습니다.");

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("헤더와 데이터 행이 필요합니다.");

  const delimiter = detectDelimiter(lines[0]!);
  const headers = splitCsvLine(lines[0]!, delimiter).map(normalizeHeader);
  const colIndex = new Map<keyof KakaoMomentCreativeRow, number>();

  for (let i = 0; i < headers.length; i++) {
    const mapped = HEADER_MAP[headers[i]!] ?? HEADER_MAP[headers[i]!.toLowerCase()];
    if (!mapped || mapped === "skip") continue;
    if (!colIndex.has(mapped)) colIndex.set(mapped, i);
  }

  if (!colIndex.has("creativeName") && !colIndex.has("cost")) {
    throw new Error("필수 열(소재, 비용)을 찾지 못했습니다. 카카오모먼트 소재 리포트인지 확인하세요.");
  }

  const warnings: string[] = [];
  if (!colIndex.has("impressions")) warnings.push("노출수 열이 없어 0으로 처리합니다.");
  if (!colIndex.has("clicks")) warnings.push("클릭수 열이 없어 0으로 처리합니다.");

  const rows: KakaoMomentCreativeRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = splitCsvLine(lines[li]!, delimiter);
    if (cells.every((c) => !c.trim())) continue;

    const row = emptyRow();
    for (const [field, idx] of colIndex) {
      const raw = cells[idx] ?? "";
      switch (field) {
        case "creativeName":
          row.creativeName = raw.trim() || `행 ${li + 1}`;
          break;
        case "status":
          row.status = raw.trim() || null;
          break;
        case "adGroupName":
          row.adGroupName = raw.trim() || null;
          break;
        case "campaignName":
          row.campaignName = raw.trim() || null;
          break;
        case "creativeId":
          row.creativeId = raw.trim() || null;
          break;
        case "adGroupId":
          row.adGroupId = raw.trim() || null;
          break;
        case "campaignId":
          row.campaignId = raw.trim() || null;
          break;
        case "cost":
        case "impressions":
        case "clicks":
        case "ctr":
        case "reach":
        case "cpc":
          row[field] = parseMomentNumber(raw);
          break;
        default:
          break;
      }
    }
    rows.push(finalizeMetrics(row));
  }

  if (rows.length === 0) throw new Error("유효한 데이터 행이 없습니다.");

  return { rows, summary: buildSummary(rows), warnings };
}
