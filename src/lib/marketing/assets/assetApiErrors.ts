import { NextResponse } from "next/server";

import {
  MarketingAssetConfigError,
  MarketingAssetConflictError,
  MarketingAssetContractError,
  MarketingAssetExportError,
  MarketingAssetPathError,
} from "@/lib/marketing/assets/errors";

export function marketingAssetErrorResponse(error: unknown): NextResponse {
  if (error instanceof MarketingAssetConfigError) {
    return NextResponse.json(
      { message: error.message, code: error.code },
      { status: 503 },
    );
  }
  if (error instanceof MarketingAssetPathError) {
    return NextResponse.json(
      { message: error.message, code: error.code },
      { status: 400 },
    );
  }
  if (error instanceof MarketingAssetContractError) {
    return NextResponse.json(
      { message: error.message, code: error.code },
      { status: 400 },
    );
  }
  if (error instanceof MarketingAssetConflictError) {
    return NextResponse.json(
      {
        message: error.message,
        code: error.code,
        relativePath: error.relativePath,
      },
      { status: 409 },
    );
  }
  if (error instanceof MarketingAssetExportError) {
    const notFound = /not found/i.test(error.message);
    return NextResponse.json(
      { message: error.message, code: error.code },
      { status: notFound ? 404 : 400 },
    );
  }
  console.error("[marketing-assets]", error);
  return NextResponse.json({ message: "internal error" }, { status: 500 });
}
