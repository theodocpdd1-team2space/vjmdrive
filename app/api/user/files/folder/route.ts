import { NextResponse } from "next/server";
import { findUserById, getCurrentUser } from "@/lib/auth";
import { createUserFolder } from "@/lib/user-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  if (session.role !== "USER") return NextResponse.json({ ok: false, message: "User folder only." }, { status: 403 });

  const user = await findUserById(session.id);
  if (!user || user.disabled) {
    return NextResponse.json({ ok: false, message: "Account unavailable." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const currentPath = typeof body?.path === "string" ? body.path : "";
  const name = typeof body?.name === "string" ? body.name : "";

  try {
    const folderPath = await createUserFolder(user, currentPath, name);
    return NextResponse.json({ ok: true, path: folderPath });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Create folder failed.";
    return NextResponse.json(
      { ok: false, message: message.includes("EEXIST") ? "Folder already exists." : message },
      { status: 400 }
    );
  }
}
