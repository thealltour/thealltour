import { NextResponse } from "next/server";

import {
  CardNewsRenderOverflowError,
  MarketingAssetConfigError,
  MarketingAssetConflictError,
  MarketingAssetContractError,
  MarketingAssetExportError,
  MarketingAssetPathError,
} from "@/lib/marketing/assets/errors";

const CARDNEWS_FIELD_LABEL_KO = { headline: "헤드라인", body: "본문" } as const;

export function marketingAssetErrorResponse(error: unknown): NextResponse {
  if (error instanceof CardNewsRenderOverflowError) {
    return NextResponse.json(
      {
        message: `카드 ${error.cardId}의 ${CARDNEWS_FIELD_LABEL_KO[error.field]}이(가) 최소 글자 크기로도 카드 영역에 들어가지 않아 렌더하지 못했습니다. 해당 카드 문구를 줄인 뒤 다시 렌더하세요.`,
        code: error.code,
        cardId: error.cardId,
        field: error.field,
        detail: error.message,
      },
      { status: 422 },
    );
  }
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
