import { NextResponse } from "next/server";
import { getPublicNotices } from "@/lib/notices";

export async function GET() {
  const notices = await getPublicNotices();
  return NextResponse.json(notices);
}
