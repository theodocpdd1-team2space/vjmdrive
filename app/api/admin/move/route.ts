import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { moveItems } from "@/lib/file-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => null);
  const paths = Array.isArray(body?.paths) ? body.paths.filter((item: unknown) => typeof item === "string") : [];
  const targetFolder = typeof body?.targetFolder === "string" ? body.targetFolder : "";

  try {
    const moved = await moveItems(paths, targetFolder);
    return NextResponse.json({ ok: true, moved });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Move failed" },
      { status: 400 }
    );
  }
}
