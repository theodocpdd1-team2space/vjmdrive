import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { findUserById, getCurrentUser } from "@/lib/auth";
import {
  assertChunkUploadOwner,
  assertUploadId,
  chunkPath,
  expectedChunkSize,
  readChunkUploadSession,
  validateChunkIndex,
} from "@/lib/chunked-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(caught: unknown, step: "chunk", status = 400) {
  const rawMessage = caught instanceof Error ? caught.message : "Chunk upload failed";
  const message = rawMessage.replace(/'\/[^']+'/g, "'[server path]'");
  console.error("[chunk-upload:chunk]", caught);
  return NextResponse.json({ ok: false, error: message, message, step }, { status });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized", message: "Unauthorized", step: "chunk" }, { status: 401 });
  const user = await findUserById(session.id);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized", message: "Unauthorized", step: "chunk" }, { status: 401 });

  try {
    const formData = await req.formData();
    const uploadId = assertUploadId(formData.get("uploadId"));
    const metadata = await readChunkUploadSession(uploadId);
    assertChunkUploadOwner(metadata, user.id);

    const chunkIndex = validateChunkIndex(formData.get("chunkIndex"), metadata.totalChunks);
    const chunk = formData.get("chunk");
    if (!(chunk instanceof File)) throw new Error("Missing chunk");

    const expectedSize = expectedChunkSize(metadata, chunkIndex);
    if (chunk.size !== expectedSize) throw new Error("Invalid chunk size");

    const destination = chunkPath(uploadId, chunkIndex);
    await fs.writeFile(destination, Buffer.from(await chunk.arrayBuffer()));
    return NextResponse.json({ ok: true, chunkIndex });
  } catch (caught) {
    return errorResponse(caught, "chunk");
  }
}
