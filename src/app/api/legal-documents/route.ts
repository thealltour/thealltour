import { NextResponse } from "next/server";
import { getLegalDocuments } from "@/lib/legalDocuments";

export async function GET() {
  const documents = await getLegalDocuments();
  return NextResponse.json(documents);
}
