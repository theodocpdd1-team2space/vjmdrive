import { stat } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { contentDisposition } from "@/lib/file-utils";
import { nodeStream, parseRange } from "@/lib/http-file";
import { findPreviewCachePath, getPreviewRoot } from "@/lib/preview-cache";
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

  const previewPath = await findPreviewCachePath(safePath.relativePath, originalStat);

  if (!previewPath) {
    return NextResponse.json({ ok: false, message: "Preview cache belum tersedia" }, { status: 404 });
  }

  const previewStat = await stat(previewPath).catch(() => null);

  if (!previewStat || !previewStat.isFile()) {
    return NextResponse.json({ ok: false, message: "Preview cache belum tersedia" }, { status: 404 });
  }

  try {
    await assertRealPathInsideRoot(getPreviewRoot(), previewPath);
  } catch {
    return NextResponse.json({ ok: false, message: "Preview path tidak valid" }, { status: 400 });
  }

  const range = req.headers.get("range");
  const size = previewStat.size;
  const headers = new Headers();

  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", "video/mp4");
  headers.set("Content-Disposition", contentDisposition(`${path.basename(safePath.relativePath)}.preview.mp4`, false));
  headers.set("X-Content-Type-Options", "nosniff");

  if (range) {
    const byteRange = parseRange(range, size);

    if (!byteRange || byteRange.start >= size) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }

    const chunkSize = byteRange.end - byteRange.start + 1;

    headers.set("Content-Range", `bytes ${byteRange.start}-${byteRange.end}/${size}`);
    headers.set("Content-Length", String(chunkSize));

    return new Response(nodeStream(previewPath, byteRange), { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  return new Response(nodeStream(previewPath), { headers });
}
