import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, userStorageRelativePath } from "@/lib/auth";
import { createThumbnailResponseForPath } from "@/lib/user-file-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const response = await createThumbnailResponseForPath(
    userStorageRelativePath(user.id),
    req.nextUrl.searchParams.get("path") || ""
  );
  return response || NextResponse.json({ ok: false, message: "Thumbnail not found." }, { status: 404 });
}
