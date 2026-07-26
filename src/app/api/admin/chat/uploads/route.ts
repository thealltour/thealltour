import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { jsonError, jsonOk } from "@/lib/api/response";
import { adminChatErrorResponse } from "@/lib/adminChat/errors";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "admin-chat-attachments";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 10 * 1024 * 1024;

function getExtension(name: string, mime: string): string {
  const fromName = name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
    return fromName === "jpg" ? "jpeg" : fromName;
  }
  if (mime === "image/jpeg") return "jpeg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "webp";
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError("이미지 파일이 필요합니다.", 400);
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return jsonError("허용 형식: JPEG, PNG, WebP, GIF", 400);
    }
    if (file.size > MAX_SIZE) {
      return jsonError("파일 용량은 10MB 이하만 업로드할 수 있습니다.", 400);
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const ext = getExtension(file.name, file.type);
    const path = `chat/${yyyy}/${mm}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      return jsonError(uploadError.message, 500);
    }

    const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return jsonOk({ url: publicData.publicUrl });
  } catch (e) {
    const errRes = adminChatErrorResponse(e);
    if (errRes) return errRes;
    return jsonError("이미지 업로드에 실패했습니다.", 500);
  }
}
