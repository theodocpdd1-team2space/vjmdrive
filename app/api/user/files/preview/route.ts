import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, userStorageRelativePath } from "@/lib/auth";
import { createPreviewResponseForPath } from "@/lib/user-file-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const response = await createPreviewResponseForPath(
    userStorageRelativePath(user.id),
    req.nextUrl.searchParams.get("path") || "",
    req.headers.get("range")
  );
  return response || NextResponse.json({ ok: false, message: "Preview not found." }, { status: 404 });
}
