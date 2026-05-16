import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getDriveItemType } from "@/lib/file-utils";
import {
  getCachePaths,
  getCacheRoot,
  getPreviewRoot,
  getThumbnailRoot,
} from "@/lib/preview-cache";
import {
  assertRealPathInsideRoot,
  getAssetRoot,
  isIgnoredName,
  resolveSafePath,
  type SafePath,
} from "@/lib/safe-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findFirstSampleMp4(folder: string): Promise<string | null> {
  const entries = await fs.readdir(folder, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (isIgnoredName(entry.name) || entry.isSymbolicLink()) {
      continue;
    }

    const absolutePath = path.join(folder, entry.name);

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".mp4")) {
      return absolutePath;
    }

    if (entry.isDirectory()) {
      const nested = await findFirstSampleMp4(absolutePath);
      if (nested) return nested;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, message: "Endpoint ini hanya untuk local development." },
      { status: 403 }
    );
  }

  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const file = typeof body?.path === "string" ? body.path : "";
  let safePath: SafePath;

  try {
    safePath = resolveSafePath(file);
  } catch {
    return NextResponse.json({ ok: false, message: "Path tidak valid" }, { status: 400 });
  }

  const originalStat = await fs.stat(safePath.absolutePath).catch(() => null);

  if (!originalStat || originalStat.isDirectory()) {
    return NextResponse.json({ ok: false, message: "File tidak ditemukan" }, { status: 404 });
  }

  try {
    await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);
  } catch {
    return NextResponse.json({ ok: false, message: "Path tidak valid" }, { status: 400 });
  }

  const type = getDriveItemType(safePath.relativePath, false);
  if (type !== "video") {
    return NextResponse.json(
      { ok: false, message: "Preview cache placeholder hanya untuk video." },
      { status: 400 }
    );
  }

  await Promise.all([
    fs.mkdir(getCacheRoot(), { recursive: true }),
    fs.mkdir(getPreviewRoot(), { recursive: true }),
    fs.mkdir(getThumbnailRoot(), { recursive: true }),
  ]);

  const cachePaths = getCachePaths(safePath.relativePath, originalStat);
  const sampleMp4 = await findFirstSampleMp4(getAssetRoot());

  if (sampleMp4) {
    await fs.copyFile(sampleMp4, cachePaths.previewPath);

    return NextResponse.json({
      ok: true,
      cacheId: cachePaths.id,
      previewCreated: true,
      message: "Sample MP4 disalin ke preview cache.",
    });
  }

  const jobsRoot = path.join(getCacheRoot(), "jobs");
  await fs.mkdir(jobsRoot, { recursive: true });
  await fs.writeFile(
    path.join(jobsRoot, `${cachePaths.id}.json`),
    JSON.stringify(
      {
        cacheId: cachePaths.id,
        path: safePath.relativePath,
        requestedAt: new Date().toISOString(),
        status: "placeholder",
        message: "ffmpeg worker belum aktif",
      },
      null,
      2
    )
  );

  return NextResponse.json({
    ok: true,
    cacheId: cachePaths.id,
    previewCreated: false,
    message: "ffmpeg worker belum aktif; dummy preview job record dibuat.",
  });
}
