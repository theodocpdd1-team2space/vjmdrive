import { stat } from "fs/promises";
import path from "path";
import { contentDisposition, getContentType } from "./file-utils";
import { nodeStream, parseRange } from "./http-file";
import { findPreviewCachePath, findThumbnailCachePath, getPreviewRoot, getThumbnailRoot } from "./preview-cache";
import { assertRealPathInsideRoot, isDriveSubPath, normalizeDrivePath, resolveSafePath } from "./safe-path";

async function resolveScopedFile(scopeRootPath: string, requestedPath: string) {
  const fullPath = path.posix.join(scopeRootPath, normalizeDrivePath(requestedPath));
  if (!isDriveSubPath(scopeRootPath, fullPath)) return null;

  const safePath = resolveSafePath(fullPath);
  await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);
  const fileStat = await stat(safePath.absolutePath).catch(() => null);
  if (!fileStat || fileStat.isDirectory()) return null;

  return { fullPath, safePath, fileStat };
}

export async function createFileResponseForPath(scopeRootPath: string, requestedPath: string, range: string | null, download: boolean) {
  const resolved = await resolveScopedFile(scopeRootPath, requestedPath);
  if (!resolved) return null;

  const headers = new Headers();
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", getContentType(resolved.safePath.absolutePath));
  headers.set("Content-Disposition", contentDisposition(path.basename(resolved.safePath.absolutePath), download));
  headers.set("X-Content-Type-Options", "nosniff");

  const byteRange = parseRange(range, resolved.fileStat.size);
  if (range && (!byteRange || byteRange.start >= resolved.fileStat.size)) {
    headers.set("Content-Range", `bytes */${resolved.fileStat.size}`);
    return new Response(null, { status: 416, headers });
  }
  if (byteRange) {
    headers.set("Content-Range", `bytes ${byteRange.start}-${byteRange.end}/${resolved.fileStat.size}`);
    headers.set("Content-Length", String(byteRange.end - byteRange.start + 1));
    return new Response(nodeStream(resolved.safePath.absolutePath, byteRange), { status: 206, headers });
  }
  headers.set("Content-Length", String(resolved.fileStat.size));
  return new Response(nodeStream(resolved.safePath.absolutePath), { headers });
}

export async function createPreviewResponseForPath(scopeRootPath: string, requestedPath: string, range: string | null) {
  const resolved = await resolveScopedFile(scopeRootPath, requestedPath);
  if (!resolved) return null;

  const previewPath = await findPreviewCachePath(resolved.fullPath, resolved.fileStat);
  if (!previewPath) return null;

  await assertRealPathInsideRoot(getPreviewRoot(), previewPath);
  const previewStat = await stat(previewPath).catch(() => null);
  if (!previewStat?.isFile()) return null;

  const headers = new Headers();
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", "video/mp4");
  headers.set("Content-Disposition", contentDisposition(`${path.basename(resolved.safePath.relativePath)}.preview.mp4`, false));
  headers.set("X-Content-Type-Options", "nosniff");

  const byteRange = parseRange(range, previewStat.size);
  if (range && (!byteRange || byteRange.start >= previewStat.size)) {
    headers.set("Content-Range", `bytes */${previewStat.size}`);
    return new Response(null, { status: 416, headers });
  }

  if (byteRange) {
    headers.set("Content-Range", `bytes ${byteRange.start}-${byteRange.end}/${previewStat.size}`);
    headers.set("Content-Length", String(byteRange.end - byteRange.start + 1));
    return new Response(nodeStream(previewPath, byteRange), { status: 206, headers });
  }

  headers.set("Content-Length", String(previewStat.size));
  return new Response(nodeStream(previewPath), { headers });
}

export async function createThumbnailResponseForPath(scopeRootPath: string, requestedPath: string) {
  const resolved = await resolveScopedFile(scopeRootPath, requestedPath);
  if (!resolved) return null;

  const thumbnailPath = await findThumbnailCachePath(resolved.fullPath, resolved.fileStat);
  if (!thumbnailPath) return null;

  await assertRealPathInsideRoot(getThumbnailRoot(), thumbnailPath);
  const thumbnailStat = await stat(thumbnailPath).catch(() => null);
  if (!thumbnailStat?.isFile()) return null;

  const headers = new Headers();
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", getContentType(thumbnailPath));
  headers.set("Content-Disposition", contentDisposition(`${path.basename(resolved.safePath.relativePath)}.thumbnail`, false));
  headers.set("Content-Length", String(thumbnailStat.size));
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(nodeStream(thumbnailPath), { headers });
}
