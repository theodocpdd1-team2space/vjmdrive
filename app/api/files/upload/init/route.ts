import { NextRequest, NextResponse } from "next/server";
import { findUserById, getCurrentUser } from "@/lib/auth";
import {
  cleanupStaleChunkUploads,
  createUploadId,
  validateChunkUploadFileName,
  validateChunkUploadNumbers,
  validateChunkUploadPath,
  writeChunkUploadSession,
} from "@/lib/chunked-upload";
import { resolveUserDrivePath } from "@/lib/user-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(caught: unknown, status = 400) {
  const rawMessage = caught instanceof Error ? caught.message : "Upload init failed";
  const message = rawMessage.replace(/'\/[^']+'/g, "'[server path]'");
  console.error("[chunk-upload:init]", caught);
  return NextResponse.json({ ok: false, error: message, message, step: "init" }, { status });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized", message: "Unauthorized", step: "init" }, { status: 401 });
  const user = await findUserById(session.id);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized", message: "Unauthorized", step: "init" }, { status: 401 });

  try {
    await cleanupStaleChunkUploads();

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const fileName = validateChunkUploadFileName(body.fileName);
    const currentPath = validateChunkUploadPath(body.currentPath);
    const relativePath = validateChunkUploadPath(typeof body.relativePath === "string" ? body.relativePath : fileName);
    const { fileSize, totalChunks, chunkSize } = validateChunkUploadNumbers({
      fileSize: body.fileSize,
      totalChunks: body.totalChunks,
      chunkSize: body.chunkSize,
    });

    resolveUserDrivePath(user.id, currentPath);
    const uploadId = createUploadId();
    await writeChunkUploadSession({
      uploadId,
      ownerUserId: user.id,
      ownerEmail: user.email,
      fileName,
      fileSize,
      fileType: typeof body.fileType === "string" ? body.fileType.slice(0, 255) : "",
      currentPath,
      relativePath,
      totalChunks,
      chunkSize,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, uploadId, chunkSize, totalChunks });
  } catch (caught) {
    return errorResponse(caught);
  }
}
