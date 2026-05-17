import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { listDriveFolder } from "@/lib/drive-list";
import { formatBytes } from "@/lib/file-utils";
import { getCacheRoot, getPreviewRoot } from "@/lib/preview-cache";
import { readPreviewQueue } from "@/lib/preview-queue";
import { getAssetRoot } from "@/lib/safe-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

async function diskInfo(target: string) {
  const { stdout } = await execFileAsync("df", ["-k", target]);
  const [, row] = stdout.trim().split("\n");
  const parts = row.trim().split(/\s+/);
  const total = Number(parts[1]) * 1024;
  const used = Number(parts[2]) * 1024;
  const free = Number(parts[3]) * 1024;
  return { total, used, free };
}

async function folderSize(folder: string): Promise<number> {
  const entries = await fs.readdir(folder, { withFileTypes: true }).catch(() => []);
  let total = 0;

  for (const entry of entries) {
    const absolutePath = path.join(folder, entry.name);
    if (entry.isDirectory()) total += await folderSize(absolutePath);
    if (entry.isFile()) total += (await fs.stat(absolutePath)).size;
  }

  return total;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const currentPath = req.nextUrl.searchParams.get("path") || "";
  const [assetDisk, cacheDisk, cacheUsed, folder, queue, previewFiles] = await Promise.all([
    diskInfo(getAssetRoot()).catch(() => ({ total: 0, used: 0, free: 0 })),
    diskInfo(getCacheRoot()).catch(() => ({ total: 0, used: 0, free: 0 })),
    folderSize(getCacheRoot()).catch(() => 0),
    listDriveFolder({ path: currentPath }).catch(() => ({ items: [] })),
    readPreviewQueue(),
    fs.readdir(getPreviewRoot()).catch(() => []),
  ]);

  const currentFolderItems = folder.items.length;
  const previewReady = previewFiles.filter((name) => name.endsWith(".mp4")).length;
  const previewFailed = queue.filter((item) => item.status === "failed").length;
  const previewQueued = queue.filter((item) => item.status === "queued" || item.status === "processing").length;
  const previewMissing = folder.items.filter((item) => item.type === "video" && item.previewStatus === "missing").length;

  return NextResponse.json({
    ok: true,
    assetRoot: {
      label: "PublicShare",
      total: formatBytes(assetDisk.total),
      used: formatBytes(assetDisk.used),
      free: formatBytes(assetDisk.free),
      totalBytes: assetDisk.total,
      usedBytes: assetDisk.used,
      freeBytes: assetDisk.free,
    },
    cacheRoot: {
      label: "Preview Cache",
      used: formatBytes(cacheUsed || cacheDisk.used),
      usedBytes: cacheUsed || cacheDisk.used,
      path: "vjm-drive",
    },
    counts: {
      currentFolderItems,
      previewReady,
      previewMissing,
      previewQueued,
      previewFailed,
    },
  });
}
