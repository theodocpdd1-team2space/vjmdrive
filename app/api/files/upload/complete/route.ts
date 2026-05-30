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

type CompleteStep = "complete" | "verify";

function errorResponse(caught: unknown, step: CompleteStep, status = 400) {
  const rawMessage = caught instanceof Error ? caught.message : "Upload finalizing failed";
  const message = rawMessage.replace(/'\/[^']+'/g, "'[server path]'");
  console.error(`[chunk-upload:${step}]`, caught);
  return NextResponse.json({ ok: false, error: message, message, step }, { status });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized", message: "Unauthorized", step: "complete" }, { status: 401 });
  const user = await findUserById(session.id);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized", message: "Unauthorized", step: "complete" }, { status: 401 });

  let step: CompleteStep = "complete";
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const uploadId = assertUploadId(body.uploadId);
    const metadata = await readChunkUploadSession(uploadId);
    assertChunkUploadOwner(metadata, user.id);

    step = "verify";
    const chunkPaths = Array.from({ length: metadata.totalChunks }, (_, index) => chunkPath(uploadId, index));
    for (const [index, filePath] of chunkPaths.entries()) {
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat?.isFile()) throw new Error(`Missing chunk ${index + 1}`);
      if (stat.size !== expectedChunkSize(metadata, index)) throw new Error(`Invalid chunk ${index + 1}`);
    }

    step = "complete";
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

    return NextResponse.json({
      ok: true,
      uploaded: [uploaded],
      path: uploaded,
      file: {
        name: metadata.fileName,
        path: uploaded,
        size: metadata.fileSize,
        type: metadata.fileType,
      },
    });
  } catch (caught) {
    return errorResponse(caught, step);
  }
}
