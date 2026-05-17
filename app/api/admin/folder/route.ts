import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createFolder } from "@/lib/file-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => null);
  const currentPath = typeof body?.path === "string" ? body.path : "";
  const name = typeof body?.name === "string" ? body.name : "";

  try {
    const path = await createFolder(currentPath, name);
    return NextResponse.json({ ok: true, path });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Create folder failed" },
      { status: 400 }
    );
  }
}
