import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, userStorageRelativePath } from "@/lib/auth";
import { listDriveFolder } from "@/lib/drive-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const data = await listDriveFolder({
    path: req.nextUrl.searchParams.get("path") || "",
    scopeRootPath: userStorageRelativePath(user.id),
    urlPrefix: "/api/user/files",
    canDownload: true,
  });
  return NextResponse.json({ ok: true, ...data });
}
