import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as NodeReadableStream } from "stream/web";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { ensureUniquePath, resolveExisting } from "@/lib/file-ops";
import { assertSafeName } from "@/lib/safe-path";
import { enqueuePreview, filterPreviewQueueSupportedPaths } from "@/lib/preview-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const formData = await req.formData();
    const targetPath = String(formData.get("path") || "");
    const target = await resolveExisting(targetPath);
    const targetStat = await fs.stat(target.absolutePath);
    if (!targetStat.isDirectory()) throw new Error("Target is not a folder");

    const files = formData.getAll("files").filter((file): file is File => file instanceof File);
    const uploaded: string[] = [];

    for (const file of files) {
      const safeName = assertSafeName(file.name);
      const destination = await ensureUniquePath(target.absolutePath, safeName);
      await pipeline(Readable.fromWeb(file.stream() as unknown as NodeReadableStream), createWriteStream(destination));
      uploaded.push(path.posix.join(target.relativePath, path.basename(destination)));
    }

    const queuePaths = filterPreviewQueueSupportedPaths(uploaded);
    if (queuePaths.length) await enqueuePreview(queuePaths);

    return NextResponse.json({ ok: true, uploaded });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Upload failed" },
      { status: 400 }
    );
  }
}
