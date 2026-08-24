import { loadProductContext } from "@/lib/marketing/context/loadProductContext";
import { requireUuid } from "@/lib/marketing/context/validation";
import { productMatchesCampaign, productMatchesTaxonomy } from "@/lib/marketing/retrieval/filters";
import { createRetrievalResult } from "@/lib/marketing/retrieval/result";
import type { ParsedMarketingRetrievalRequest, RetrievalResult } from "@/lib/marketing/retrieval/types";
import type { ProductContext } from "@/lib/marketing/context/types";

export async function retrieveProduct(
  request: ParsedMarketingRetrievalRequest,
): Promise<RetrievalResult<ProductContext | null>> {
  const retrievedAt = new Date().toISOString();
  if (!request.productId) {
    return createRetrievalResult({
      data: null,
      sourceType: "product",
      sourceTable: "products",
      retrievedAt,
    });
  }

  const productId = requireUuid(request.productId, "productId");
  const product = await loadProductContext(productId);
  const matchesActive = !request.activeOnly || Boolean(product?.isActive);
  const matchesTaxonomy = !request.taxonomyId || (product != null && productMatchesTaxonomy(product, request.taxonomyId));
  const matchesCampaign = !request.campaignId || (product != null && productMatchesCampaign(product, request.campaignId));

  return createRetrievalResult({
    data: product && matchesActive && matchesTaxonomy && matchesCampaign ? product : null,
    sourceType: "product",
    sourceTable: "products",
    sourceId: productId,
    retrievedAt,
  });
}
