import { AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV } from "@/ai-runtime/integration/constants";

export class InferenceGatewayAuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "InferenceGatewayAuthError";
    this.status = status;
  }
}

export function readInferenceGatewayToken(
  env: Record<string, string | undefined> = process.env,
): string {
  return env[AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV]?.trim() ?? "";
}

/**
 * Requires Authorization: Bearer <AI_RUNTIME_INFERENCE_GATEWAY_TOKEN>.
 * Rejects missing/mismatched tokens. Does not log the token value.
 */
export function assertInferenceGatewayAuth(
  authorizationHeader: string | null,
  env: Record<string, string | undefined> = process.env,
): void {
  const expected = readInferenceGatewayToken(env);
  if (!expected) {
    throw new InferenceGatewayAuthError(
      `${AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV} is not configured`,
      503,
    );
  }
  const header = authorizationHeader?.trim() ?? "";
  if (header !== `Bearer ${expected}`) {
    throw new InferenceGatewayAuthError("unauthorized", 401);
  }
}

/** Best-effort private-network check (defense in depth; primary auth is bearer). */
export function isPrivateClientAddress(forwardedFor: string | null, remoteHint?: string | null): boolean {
  const candidates = [forwardedFor?.split(",")[0]?.trim(), remoteHint?.trim()].filter(Boolean) as string[];
  if (candidates.length === 0) {
    // Next often hides remote IP; allow and rely on bearer + localhost bind recommendation.
    return true;
  }
  return candidates.every((ip) => {
    if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "::ffff:127.0.0.1") {
      return true;
    }
    if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.")) {
      // 172.16.0.0 – 172.31.255.255 approximate
      if (ip.startsWith("172.")) {
        const second = Number(ip.split(".")[1] ?? "0");
        return second >= 16 && second <= 31;
      }
      return true;
    }
    if (ip.startsWith("100.")) {
      // CGNAT / Tailscale CGNAT-ish — allow for Pi↔Desktop topology
      return true;
    }
    return false;
  });
}
