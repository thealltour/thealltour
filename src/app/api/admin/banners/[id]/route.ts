import { revalidateTag } from "next/cache";
import { requireAdminSession } from "@/lib/apiAuth";
import { jsonError, jsonOk } from "@/lib/api/response";
import { deleteHomeBanner, updateHomeBanner, type BannerWriteInput } from "@/lib/adminBanners/repository";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const body = (await request.json()) as BannerWriteInput;
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) {
      return jsonError("배너 제목은 비워둘 수 없습니다.", 400);
    }
    updates.title = title;
  }
  if (body.image_url !== undefined) {
    const imageUrl = body.image_url.trim();
    if (!imageUrl) {
      return jsonError("PC 배너 이미지 URL은 비워둘 수 없습니다.", 400);
    }
    updates.image_url = imageUrl;
  }
  if (body.mobile_image_url !== undefined) {
    updates.mobile_image_url = body.mobile_image_url?.trim() || null;
  }
  if (body.link_url !== undefined) {
    updates.link_url = body.link_url?.trim() || null;
  }
  if (body.sort_order !== undefined) {
    updates.sort_order = typeof body.sort_order === "number" ? body.sort_order : null;
  }
  if (body.is_active !== undefined) {
    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("변경할 항목이 없습니다.", 400);
  }

  const updated = await updateHomeBanner(id, updates);
  if (!updated.ok) {
    return jsonError(updated.message, 500);
  }

  revalidateTag("home-banners", "max");
  return jsonOk({ message: "배너가 수정되었습니다." });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const deleted = await deleteHomeBanner(id);
  if (!deleted.ok) {
    return jsonError(deleted.message, 500);
  }

  revalidateTag("home-banners", "max");
  return jsonOk({ message: "배너가 삭제되었습니다." });
}
