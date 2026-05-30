import { NextRequest, NextResponse } from "next/server";
import { findUserById, getCurrentUser, userStorageRelativePath } from "@/lib/auth";
import { createFileResponseForPath } from "@/lib/user-file-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const user = await findUserById(session.id);
  if (!user || user.disabled) return NextResponse.json({ ok: false }, { status: 403 });
  const filePath = req.nextUrl.searchParams.get("path") || "";
  const download = req.nextUrl.searchParams.get("download") === "1";
  const response = await createFileResponseForPath(userStorageRelativePath(user), filePath, req.headers.get("range"), download);
  return response || NextResponse.json({ ok: false }, { status: 404 });
}
