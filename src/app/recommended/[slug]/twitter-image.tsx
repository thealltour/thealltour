import { getRecommendedSlugOpenGraphImageResponse } from "@/lib/seo/recommendedSlugOgImageResponse";

export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

type Props = { params: Promise<{ slug: string }> };

export default async function Image({ params }: Props) {
  const { slug } = await params;
  return getRecommendedSlugOpenGraphImageResponse(slug ?? "");
}
