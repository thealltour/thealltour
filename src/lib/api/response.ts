import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ message, ...extra }, { status });
}

export function jsonStructuredError(input: {
  message: string;
  status?: number;
  code?: string;
  retryable?: boolean;
}) {
  return NextResponse.json(
    {
      ok: false as const,
      code: input.code ?? "ERROR",
      message: input.message,
      retryable: input.retryable ?? false,
    },
    { status: input.status ?? 400 },
  );
}

export function mapRpcErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const msg = error.message;
  if (msg.includes("NOT_FOUND")) return "요청한 리소스를 찾을 수 없습니다.";
  if (msg.includes("ALREADY_PROCESSED")) return "이미 처리된 요청입니다.";
  return msg || fallback;
}
