import { NextResponse } from "next/server";

/** 관리 CRUD는 /api/admin/search/recommended/[id] 사용. */
export async function PUT() {
  return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
}

export async function DELETE() {
  return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
}
