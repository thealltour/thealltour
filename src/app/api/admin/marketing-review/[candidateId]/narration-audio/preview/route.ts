import { z } from "zod";
import { TtsError } from "@/lib/marketing/tts/errors";
import { requireAdminPermission } from "@/lib/apiAuth";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
import { narrationVoicePreview } from "@/lib/marketing/tts/voiceStudio/preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const schema = z.object({ profileId: z.string().min(1).max(64), speed: z.number().min(0.7).max(2) }).strict();
export async function POST(request: Request, context: { params: Promise<{ candidateId: string }> }) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params;
    const detail = await (await createHumanMarketingReviewService()).getHumanReviewDetail(candidateId);
    if (!detail) throw new NarrationError("후보를 찾을 수 없습니다.", 404);
    if (!detail.canEdit) throw new NarrationError("현재 후보는 편집할 수 없습니다.", 403);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new NarrationError("목소리와 속도를 확인해주세요.", 400);
    const audio = await narrationVoicePreview(parsed.data.profileId, parsed.data.speed);
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/wav", "Content-Length": String(audio.length), "Cache-Control": "private, no-store" } });
  } catch (error) {
    const messages: Partial<Record<TtsError["code"], string>> = {
      provider_timeout: "미니 PC의 샘플 생성 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.",
      provider_unavailable: "미니 PC 음성 생성기에 연결하지 못했습니다. 연결 상태를 확인해주세요.",
      authentication_failed: "음성 생성기 인증 설정을 확인해주세요.",
      unsupported_voice: "선택한 목소리를 음성 생성기에서 사용할 수 없습니다.",
      malformed_provider_response: "음성 생성기가 정상적인 샘플 파일을 반환하지 않았습니다.",
    };
    return Response.json({ message: error instanceof NarrationError ? error.message : error instanceof TtsError ? messages[error.code] ?? "샘플 생성에 실패했습니다. 잠시 후 다시 시도해주세요." : "샘플을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.",
      ...(error instanceof TtsError ? { errorCode: error.code } : {}) },
      { status: error instanceof NarrationError ? error.status : 502 });
  }
}
