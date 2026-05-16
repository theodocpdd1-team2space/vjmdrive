import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { isAuthed } from "@/lib/auth";
import { formatBytes, getDriveItemType, getExtension } from "@/lib/file-utils";
import { getPreviewMetadata } from "@/lib/preview-cache";
import {
  assertRealPathInsideRoot,
  isIgnoredName,
  resolveSafePath,
  type SafePath,
} from "@/lib/safe-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const currentPath = req.nextUrl.searchParams.get("path") || "";
  let safePath: SafePath;

  try {
    safePath = resolveSafePath(currentPath);
  } catch {
    return NextResponse.json({ ok: false, message: "Path tidak valid" }, { status: 400 });
  }

  try {
    await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);
    const folderStat = await fs.stat(safePath.absolutePath);

    if (!folderStat.isDirectory()) {
      return NextResponse.json({ ok: false, message: "Folder tidak ditemukan" }, { status: 404 });
    }

    const entries = await fs.readdir(safePath.absolutePath, { withFileTypes: true });

    const items = await Promise.all(
      entries
        .filter((entry) => !isIgnoredName(entry.name))
        .filter((entry) => !entry.isSymbolicLink())
        .filter((entry) => entry.isDirectory() || entry.isFile())
        .map(async (entry) => {
          const itemAbs = path.join(safePath.absolutePath, entry.name);
          const stat = await fs.stat(itemAbs);
          const itemRelative = path.posix.join(safePath.relativePath, entry.name);
          const type = getDriveItemType(entry.name, entry.isDirectory());
          const previewMetadata = await getPreviewMetadata(
            itemRelative,
            stat,
            entry.isDirectory()
          );

          return {
            name: entry.name,
            path: itemRelative,
            type,
            extension: entry.isDirectory() ? "" : getExtension(entry.name),
            size: entry.isDirectory() ? null : formatBytes(stat.size),
            bytes: entry.isDirectory() ? 0 : stat.size,
            modified: stat.mtime.toISOString(),
            canPreview:
              previewMetadata.previewStatus === "native" ||
              previewMetadata.previewStatus === "ready",
            ...previewMetadata,
          };
        })
    );

    items.sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ ok: true, path: safePath.relativePath, items });
  } catch {
    return NextResponse.json({ ok: false, message: "Folder tidak ditemukan" }, { status: 404 });
  }
}
