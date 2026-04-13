import { getProductsIndexOpenGraphImageResponse } from "@/lib/seo/productsIndexOgImageResponse";

export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default async function Image() {
  return getProductsIndexOpenGraphImageResponse();
}
