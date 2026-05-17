import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { softDelete } from "@/lib/file-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => null);
  const paths = Array.isArray(body?.paths) ? body.paths.filter((item: unknown) => typeof item === "string") : [];

  try {
    const deleted = await softDelete(paths);
    return NextResponse.json({ ok: true, deletedCount: deleted.length, deleted });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Delete failed" },
      { status: 400 }
    );
  }
}
