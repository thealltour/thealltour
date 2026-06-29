import { NextResponse } from "next/server";

const CORS_ALLOW_HEADERS = "Content-Type";
const CORS_ALLOW_METHODS = "POST, OPTIONS";

export function isChromeExtensionOrigin(origin: string | null): boolean {
  return Boolean(origin?.startsWith("chrome-extension://"));
}

export function buildExternalImportCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  if (!isChromeExtensionOrigin(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
  };
}

export function externalImportOptionsResponse(request: Request): NextResponse {
  const headers = buildExternalImportCorsHeaders(request);
  return new NextResponse(null, { status: 204, headers });
}

export function withExternalImportCors<T extends Record<string, unknown>>(
  request: Request,
  body: T,
  init?: { status?: number },
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: buildExternalImportCorsHeaders(request),
  });
}
