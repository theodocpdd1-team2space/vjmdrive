import { NextRequest, NextResponse } from "next/server";
import { stat } from "fs/promises";
import path from "path";
import { isAuthed } from "@/lib/auth";
import { contentDisposition, getContentType } from "@/lib/file-utils";
import { nodeStream, parseRange } from "@/lib/http-file";
import { assertRealPathInsideRoot, resolveSafePath, type SafePath } from "@/lib/safe-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const file = req.nextUrl.searchParams.get("path") || "";
  const download = req.nextUrl.searchParams.get("download") === "1";

  let safePath: SafePath;

  try {
    safePath = resolveSafePath(file);
  } catch {
    return NextResponse.json({ ok: false, message: "Path tidak valid" }, { status: 400 });
  }

  const fileStat = await stat(safePath.absolutePath).catch(() => null);

  if (!fileStat || fileStat.isDirectory()) {
    return NextResponse.json({ ok: false, message: "File tidak ditemukan" }, { status: 404 });
  }

  try {
    await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);
  } catch {
    return NextResponse.json({ ok: false, message: "Path tidak valid" }, { status: 400 });
  }

  const range = req.headers.get("range");
  const size = fileStat.size;
  const fileName = path.basename(safePath.absolutePath);
  const headers = new Headers();

  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", getContentType(safePath.absolutePath));
  headers.set("Content-Disposition", contentDisposition(fileName, download));
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

    return new Response(nodeStream(safePath.absolutePath, byteRange), { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  return new Response(nodeStream(safePath.absolutePath), { headers });
}
