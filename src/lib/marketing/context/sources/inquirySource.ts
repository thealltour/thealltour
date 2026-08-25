import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  INQUIRY_INSIGHT_COLUMN_LIST,
  type InquiryInsightRow,
} from "@/lib/marketing/context/mappers/inquiryInsightMapper";

const INQUIRY_INSIGHT_COLUMNS = INQUIRY_INSIGHT_COLUMN_LIST.join(", ");

export async function fetchInquiryInsightRows(input: {
  productId?: string;
  productIds?: string[];
  periodStart: string;
  periodEnd: string;
  acquisitionChannel?: string;
  limit?: number;
}): Promise<InquiryInsightRow[]> {
  let query = supabaseAdmin
    .from("inquiries")
    .select(INQUIRY_INSIGHT_COLUMNS)
    .gte("created_at", input.periodStart)
    .lte("created_at", input.periodEnd)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 200);

  const productIds = [
    ...new Set(
      [input.productId, ...(input.productIds ?? [])].filter((id): id is string => Boolean(id)),
    ),
  ];
  if (productIds.length === 1) {
    query = query.eq("product_id", productIds[0]);
  } else if (productIds.length > 1) {
    query = query.in("product_id", productIds);
  }
  if (input.acquisitionChannel) {
    query = query.eq("acquisition_channel", input.acquisitionChannel);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`inquiries lookup failed: ${error.message}`);
  }
  return (data as InquiryInsightRow[] | null) ?? [];
}
