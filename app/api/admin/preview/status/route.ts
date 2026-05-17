import { stat } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getPreviewMetadata } from "@/lib/preview-cache";
import { getQueuedStatus } from "@/lib/preview-queue";
import { resolveExisting } from "@/lib/file-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const filePath = req.nextUrl.searchParams.get("path") || "";
  const safePath = await resolveExisting(filePath).catch(() => null);
  if (!safePath) return NextResponse.json({ ok: false }, { status: 404 });

  const fileStat = await stat(safePath.absolutePath);
  const metadata = await getPreviewMetadata(safePath.relativePath, fileStat, fileStat.isDirectory());
  const queued = await getQueuedStatus(safePath.relativePath);

  return NextResponse.json({
    ok: true,
    status: queued?.status || metadata.previewStatus,
    message: queued?.message || "",
    previewStatus: metadata.previewStatus,
  });
}
