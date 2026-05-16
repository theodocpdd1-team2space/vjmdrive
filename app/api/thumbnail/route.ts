import { stat } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { contentDisposition, getContentType } from "@/lib/file-utils";
import { nodeStream } from "@/lib/http-file";
import { findThumbnailCachePath, getThumbnailRoot } from "@/lib/preview-cache";
import { assertRealPathInsideRoot, resolveSafePath, type SafePath } from "@/lib/safe-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const file = req.nextUrl.searchParams.get("path") || "";
  let safePath: SafePath;

  try {
    safePath = resolveSafePath(file);
  } catch {
    return NextResponse.json({ ok: false, message: "Path tidak valid" }, { status: 400 });
  }

  const originalStat = await stat(safePath.absolutePath).catch(() => null);

  if (!originalStat || originalStat.isDirectory()) {
    return NextResponse.json({ ok: false, message: "File tidak ditemukan" }, { status: 404 });
  }

  try {
    await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);
  } catch {
    return NextResponse.json({ ok: false, message: "Path tidak valid" }, { status: 400 });
  }

  const thumbnailPath = await findThumbnailCachePath(safePath.relativePath, originalStat);

  if (!thumbnailPath) {
    return NextResponse.json({ ok: false, message: "Thumbnail belum tersedia" }, { status: 404 });
  }

  const thumbnailStat = await stat(thumbnailPath).catch(() => null);

  if (!thumbnailStat || !thumbnailStat.isFile()) {
    return NextResponse.json({ ok: false, message: "Thumbnail belum tersedia" }, { status: 404 });
  }

  try {
    await assertRealPathInsideRoot(getThumbnailRoot(), thumbnailPath);
  } catch {
    return NextResponse.json({ ok: false, message: "Thumbnail path tidak valid" }, { status: 400 });
  }

  const headers = new Headers();

  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", getContentType(thumbnailPath));
  headers.set("Content-Disposition", contentDisposition(`${path.basename(safePath.relativePath)}.thumbnail`, false));
  headers.set("Content-Length", String(thumbnailStat.size));
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(nodeStream(thumbnailPath), { headers });
}
