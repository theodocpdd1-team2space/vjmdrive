import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { resolveSharePath } from "@/lib/share-file";
import { createZipResponse } from "@/lib/zip-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/share/[token]/zip">) {
  const { token } = await ctx.params;
  const requestedPath = req.nextUrl.searchParams.get("path") || "";
  const resolved = await resolveSharePath(token, requestedPath).catch(() => null);
  if (!resolved || !resolved.share.canDownload) return NextResponse.json({ ok: false }, { status: 404 });

  return createZipResponse(resolved.safePath.absolutePath, path.basename(requestedPath || resolved.share.name));
}
