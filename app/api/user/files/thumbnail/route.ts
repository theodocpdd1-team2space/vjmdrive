import { NextRequest, NextResponse } from "next/server";
import { findUserById, getCurrentUser, userStorageRelativePath } from "@/lib/auth";
import { createThumbnailResponseForPath } from "@/lib/user-file-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const user = await findUserById(session.id);
  if (!user || user.disabled) return NextResponse.json({ ok: false }, { status: 403 });

  const response = await createThumbnailResponseForPath(
    userStorageRelativePath(user),
    req.nextUrl.searchParams.get("path") || ""
  );
  return response || NextResponse.json({ ok: false, message: "Thumbnail not found." }, { status: 404 });
}
