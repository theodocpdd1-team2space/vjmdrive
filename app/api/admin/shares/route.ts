import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { readShareLinks } from "@/lib/share-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, links: await readShareLinks() });
}
