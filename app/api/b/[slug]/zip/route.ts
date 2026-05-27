import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { incrementBeautyShareDownload } from "@/lib/beauty-share-db";
import { resolveBeautySharePath } from "@/lib/beauty-share-file";
import { createZipResponse } from "@/lib/zip-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeZipName(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120) || "Beauty Share";
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/b/[slug]/zip">) {
  const { slug } = await ctx.params;
  const requestedPath = req.nextUrl.searchParams.get("path") || "";
  const resolved = await resolveBeautySharePath(slug, requestedPath).catch(() => null);

  if (!resolved) {
    return NextResponse.json({ ok: false, message: "Beauty Share unavailable." }, { status: 404 });
  }

  const folderStat = await fs.stat(resolved.safePath.absolutePath).catch(() => null);
  if (!folderStat || !folderStat.isDirectory()) {
    return NextResponse.json({ ok: false, message: "Folder not found." }, { status: 404 });
  }

  await incrementBeautyShareDownload(resolved.share.id).catch(() => undefined);
  const fileName = requestedPath ? path.basename(requestedPath) : safeZipName(resolved.share.title || resolved.share.clientName || "Beauty Share");
  return createZipResponse(resolved.safePath.absolutePath, fileName);
}
