import { getRecommendedOpenGraphImageResponse } from "@/lib/seo/recommendedOgImageResponse";

export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default async function Image() {
  return getRecommendedOpenGraphImageResponse();
}
