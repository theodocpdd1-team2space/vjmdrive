import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { assertRealPathInsideRoot, resolveSafePath } from "@/lib/safe-path";
import { createZipResponse } from "@/lib/zip-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const requestedPath = req.nextUrl.searchParams.get("path") || "";
  const safePath = await (async () => {
    const candidate = resolveSafePath(requestedPath);
    await assertRealPathInsideRoot(candidate.root, candidate.absolutePath);
    return candidate;
  })().catch(() => null);
  if (!safePath) return NextResponse.json({ ok: false }, { status: 404 });

  return createZipResponse(safePath.absolutePath, path.basename(safePath.relativePath || "PublicShare"));
}
