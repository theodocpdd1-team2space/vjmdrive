import { stat } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getDriveItemType } from "@/lib/file-utils";
import { findPreviewCachePath } from "@/lib/preview-cache";
import { enqueuePreview } from "@/lib/preview-queue";
import { resolveExisting } from "@/lib/file-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => null);
  const paths = Array.isArray(body?.paths) ? body.paths.filter((item: unknown) => typeof item === "string") : [];
  const accepted: string[] = [];

  for (const filePath of paths) {
    const safePath = await resolveExisting(filePath).catch(() => null);
    if (!safePath) continue;

    const fileStat = await stat(safePath.absolutePath);
    if (fileStat.isDirectory()) continue;
    if (getDriveItemType(safePath.relativePath, false) !== "video") continue;
    if (await findPreviewCachePath(safePath.relativePath, fileStat)) continue;
    accepted.push(safePath.relativePath);
  }

  const { queue, added } = await enqueuePreview(accepted);
  return NextResponse.json({ ok: true, added, queueCount: queue.length });
}
