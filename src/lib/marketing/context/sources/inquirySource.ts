import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { InquiryInsightRow } from "@/lib/marketing/context/mappers/inquiryInsightMapper";

const INQUIRY_INSIGHT_COLUMNS = [
  "content",
  "product_id",
  "product_title",
  "acquisition_channel",
  "acquisition_source_label",
  "acquisition_medium",
  "first_touch",
  "consultation_status",
  "booking_status",
  "created_at",
].join(", ");

export async function fetchInquiryInsightRows(input: {
  productId?: string;
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

  if (input.productId) {
    query = query.eq("product_id", input.productId);
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
