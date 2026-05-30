import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { findUserById, getCurrentUser } from "@/lib/auth";
import { assertRealPathInsideRoot, resolveSafePath } from "@/lib/safe-path";
import { resolveUserDrivePath } from "@/lib/user-files";
import { createZipResponse } from "@/lib/zip-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  const user = await findUserById(session.id);
  if (!user || user.disabled) return NextResponse.json({ ok: false, message: "Account unavailable." }, { status: 403 });

  const requestedPath = req.nextUrl.searchParams.get("path") || "";
  const resolved = await (async () => {
    const fullPath = resolveUserDrivePath(user, requestedPath);
    const safePath = resolveSafePath(fullPath);
    await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);
    const stat = await fs.stat(safePath.absolutePath);
    if (!stat.isDirectory()) throw new Error("Selected path is not a folder.");
    return { safePath };
  })().catch(() => null);

  if (!resolved) {
    return NextResponse.json({ ok: false, message: "Folder not found." }, { status: 404 });
  }

  return createZipResponse(resolved.safePath.absolutePath, path.basename(requestedPath || "My Drive"));
}
