import { NextRequest, NextResponse } from "next/server";
import { findUserById, getCurrentUser } from "@/lib/auth";
import {
  assertChunkUploadOwner,
  assertUploadId,
  readChunkUploadSession,
  removeChunkUploadSession,
} from "@/lib/chunked-upload";

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
    const metadata = await readChunkUploadSession(uploadId).catch(() => null);
    if (metadata) assertChunkUploadOwner(metadata, user.id);
    if (metadata) await removeChunkUploadSession(uploadId);
    return NextResponse.json({ ok: true });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Upload abort failed" },
      { status: 400 }
    );
  }
}
