import "server-only";

import type { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/response";

export class AdminChatError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = "AdminChatError";
  }
}

export function adminChatErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof AdminChatError) {
    return jsonError(e.message, e.status);
  }
  return null;
}
