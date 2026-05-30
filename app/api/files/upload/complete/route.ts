import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { findUserById, getCurrentUser } from "@/lib/auth";
import {
  assertChunkUploadOwner,
  assertUploadId,
  chunkPath,
  expectedChunkSize,
  readChunkUploadSession,
  removeChunkUploadSession,
} from "@/lib/chunked-upload";
import { enqueuePreview, filterPreviewQueueSupportedPaths } from "@/lib/preview-queue";
import { uploadUserFileFromChunks } from "@/lib/user-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const user = await findUserById(session.id);
  if (!user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const uploadId = assertUploadId(body.uploadId);
    const metadata = await readChunkUploadSession(uploadId);
    assertChunkUploadOwner(metadata, user.id);

    const chunkPaths = Array.from({ length: metadata.totalChunks }, (_, index) => chunkPath(uploadId, index));
    for (const [index, filePath] of chunkPaths.entries()) {
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat?.isFile()) throw new Error(`Missing chunk ${index + 1}`);
      if (stat.size !== expectedChunkSize(metadata, index)) throw new Error(`Invalid chunk ${index + 1}`);
    }

    const uploaded = await uploadUserFileFromChunks({
      user,
      targetPath: metadata.currentPath,
      fileName: metadata.fileName,
      relativePath: metadata.relativePath,
      fileSize: metadata.fileSize,
      chunkPaths,
    });

    const queuePaths = filterPreviewQueueSupportedPaths([`__users/${user.id}/${uploaded}`]);
    if (queuePaths.length) await enqueuePreview(queuePaths);
    await removeChunkUploadSession(uploadId);

    return NextResponse.json({ ok: true, uploaded: [uploaded], path: uploaded });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Upload finalizing failed" },
      { status: 400 }
    );
  }
}
