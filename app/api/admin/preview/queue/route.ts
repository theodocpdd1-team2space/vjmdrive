import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { readPreviewQueue } from "@/lib/preview-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, queue: await readPreviewQueue() });
}
