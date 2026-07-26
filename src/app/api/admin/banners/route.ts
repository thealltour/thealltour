import { revalidateTag } from "next/cache";
import { requireAdminSession } from "@/lib/apiAuth";
import { jsonError, jsonOk } from "@/lib/api/response";
import { insertHomeBanner, listHomeBanners, type BannerWriteInput } from "@/lib/adminBanners/repository";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const result = await listHomeBanners();
  if (result.errorMessage) {
    return jsonError(result.errorMessage, 500);
  }
  return jsonOk(result.data ?? []);
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const body = (await request.json()) as BannerWriteInput;
  const title = body.title?.trim() ?? "";
  const imageUrl = body.image_url?.trim() ?? "";

  if (!title || !imageUrl) {
    return jsonError("배너 제목과 PC 배너 이미지 URL은 필수입니다.", 400);
  }

  const inserted = await insertHomeBanner({
    title,
    image_url: imageUrl,
    mobile_image_url: body.mobile_image_url?.trim() || null,
    link_url: body.link_url?.trim() || null,
    sort_order: typeof body.sort_order === "number" ? body.sort_order : null,
    is_active: body.is_active ?? true,
  });

  if (!inserted.ok) {
    return jsonError(inserted.message, 500);
  }

  revalidateTag("home-banners", "max");
  return jsonOk({ message: "배너가 추가되었습니다." }, { status: 201 });
}
