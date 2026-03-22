import { getProductOpenGraphImageResponse } from "@/lib/seo/productOgImageResponse";

export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

type Props = { params: Promise<{ id: string }> };

export default async function Image({ params }: Props) {
  const { id } = await params;
  return getProductOpenGraphImageResponse(id);
}
