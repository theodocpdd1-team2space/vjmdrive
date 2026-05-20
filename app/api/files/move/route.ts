import { NextRequest, NextResponse } from "next/server";
import { findUserById, getCurrentUser } from "@/lib/auth";
import { moveItems } from "@/lib/file-ops";
import { moveUserItems } from "@/lib/user-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => null);
  const items = Array.isArray(body?.items) ? body.items.filter((item: unknown) => typeof item === "string") : [];
  const targetFolder = typeof body?.targetFolder === "string" ? body.targetFolder : "";

  try {
    if (session.role === "ADMIN") {
      const moved = await moveItems(items, targetFolder);
      return NextResponse.json({ ok: true, moved });
    }
    const user = await findUserById(session.id);
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const moved = await moveUserItems(user, items, targetFolder);
    return NextResponse.json({ ok: true, moved });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Move failed" },
      { status: 400 }
    );
  }
}
