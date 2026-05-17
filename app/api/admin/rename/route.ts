import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { renameItem } from "@/lib/file-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => null);
  const path = typeof body?.path === "string" ? body.path : "";
  const newName = typeof body?.newName === "string" ? body.newName : "";

  try {
    const newPath = await renameItem(path, newName);
    return NextResponse.json({ ok: true, path: newPath });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Rename failed" },
      { status: 400 }
    );
  }
}
