import "server-only";

import { loadProductContexts } from "@/lib/marketing/context/loadProductContext";
import { mapInquiryRowToInsight } from "@/lib/marketing/context/mappers/inquiryInsightMapper";
import { fetchInquiryInsightRows } from "@/lib/marketing/context/sources/inquirySource";
import { CUSTOMER_INSIGHT_MAX_INQUIRIES } from "@/lib/marketing/memory/constants";
import type {
  CustomerInsightMemoryBundle,
  ParsedCustomerInsightMemoryLoadParams,
} from "@/lib/marketing/memory/sources/customerInsightMemorySource";

function asProductId(value: string | null | undefined): string | null {
  return value && value.trim() !== "" ? value.trim() : null;
}

export async function loadCustomerInsightMemoryBundles(
  params: ParsedCustomerInsightMemoryLoadParams,
): Promise<CustomerInsightMemoryBundle[]> {
  const ids = params.ids.slice(0, params.limit);
  if (ids.length === 0) return [];

  const [rows, products] = await Promise.all([
    fetchInquiryInsightRows({
      productIds: ids,
      periodStart: params.period.start,
      periodEnd: params.period.end,
      limit: CUSTOMER_INSIGHT_MAX_INQUIRIES,
    }),
    loadProductContexts({ ids, limit: ids.length }),
  ]);

  const inquiriesByProduct = new Map<string, ReturnType<typeof mapInquiryRowToInsight>[]>();
  for (const row of rows) {
    const inquiry = mapInquiryRowToInsight(row);
    const productId = asProductId(inquiry.productId);
    if (!productId || !ids.includes(productId)) continue;
    const list = inquiriesByProduct.get(productId) ?? [];
    list.push(inquiry);
    inquiriesByProduct.set(productId, list);
  }

  const titleByProduct = new Map(products.map((product) => [product.id, product.title]));

  return ids.map((productId) => {
    const inquiries = inquiriesByProduct.get(productId) ?? [];
    const fromInquiry = inquiries.find((inquiry) => inquiry.productTitle)?.productTitle ?? null;
    return {
      productId,
      productTitle: titleByProduct.get(productId) ?? fromInquiry,
      inquiries,
    };
  });
}
