import { NextResponse } from "next/server";
import { getPublishedGuides } from "@/lib/guides";

export async function GET() {
  const guides = await getPublishedGuides();
  return NextResponse.json(guides);
}

