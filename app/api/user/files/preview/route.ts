import { NextRequest, NextResponse } from "next/server";
import { findUserById, getCurrentUser, userStorageRelativePath } from "@/lib/auth";
import { createPreviewResponseForPath } from "@/lib/user-file-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const user = await findUserById(session.id);
  if (!user || user.disabled) return NextResponse.json({ ok: false }, { status: 403 });

  const response = await createPreviewResponseForPath(
    userStorageRelativePath(user),
    req.nextUrl.searchParams.get("path") || "",
    req.headers.get("range")
  );
  return response || NextResponse.json({ ok: false, message: "Preview not found." }, { status: 404 });
}
