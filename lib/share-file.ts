import { stat } from "fs/promises";
import path from "path";
import { contentDisposition, getContentType } from "./file-utils";
import { nodeStream, parseRange } from "./http-file";
import { getPreviewRoot, getThumbnailRoot, findPreviewCachePath, findThumbnailCachePath } from "./preview-cache";
import { getCurrentUser } from "./auth";
import { canUserAccessShare, getValidShareLink } from "./share-db";
import { assertRealPathInsideRoot, isDriveSubPath, resolveSafePath } from "./safe-path";

export async function resolveSharePath(token: string, requestedPath: string) {
  const share = await getValidShareLink(token);
  if (!share) return null;
  const user = await getCurrentUser();
  if (!canUserAccessShare(share, user)) return null;

  const fullPath = path.posix.join(share.rootPath, requestedPath || "");
  if (!isDriveSubPath(share.rootPath, fullPath)) return null;

  const safePath = resolveSafePath(fullPath);
  await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);

  return { share, safePath, fullPath };
}

export async function createShareFileResponse(token: string, requestedPath: string, range: string | null, download: boolean) {
  const resolved = await resolveSharePath(token, requestedPath);
  if (!resolved || (!resolved.share.downloadEnabled && download)) return null;

  const fileStat = await stat(resolved.safePath.absolutePath).catch(() => null);
  if (!fileStat || fileStat.isDirectory()) return null;

  const headers = new Headers();
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", getContentType(resolved.safePath.absolutePath));
  headers.set("Content-Disposition", contentDisposition(path.basename(resolved.safePath.absolutePath), download));
  headers.set("X-Content-Type-Options", "nosniff");

  const byteRange = parseRange(range, fileStat.size);
  if (range && (!byteRange || byteRange.start >= fileStat.size)) {
    headers.set("Content-Range", `bytes */${fileStat.size}`);
    return new Response(null, { status: 416, headers });
  }

  if (byteRange) {
    headers.set("Content-Range", `bytes ${byteRange.start}-${byteRange.end}/${fileStat.size}`);
    headers.set("Content-Length", String(byteRange.end - byteRange.start + 1));
    return new Response(nodeStream(resolved.safePath.absolutePath, byteRange), { status: 206, headers });
  }

  headers.set("Content-Length", String(fileStat.size));
  return new Response(nodeStream(resolved.safePath.absolutePath), { headers });
}

export async function createSharePreviewResponse(token: string, requestedPath: string, range: string | null) {
  const resolved = await resolveSharePath(token, requestedPath);
  if (!resolved) return null;

  const originalStat = await stat(resolved.safePath.absolutePath).catch(() => null);
  if (!originalStat || originalStat.isDirectory()) return null;

  const previewPath = await findPreviewCachePath(resolved.fullPath, originalStat);
  if (!previewPath) return null;

  await assertRealPathInsideRoot(getPreviewRoot(), previewPath);
  const previewStat = await stat(previewPath);
  const headers = new Headers();
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", "video/mp4");
  headers.set("Content-Disposition", contentDisposition(`${path.basename(requestedPath)}.preview.mp4`, false));

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

export async function createShareThumbnailResponse(token: string, requestedPath: string) {
  const resolved = await resolveSharePath(token, requestedPath);
  if (!resolved) return null;

  const originalStat = await stat(resolved.safePath.absolutePath).catch(() => null);
  if (!originalStat || originalStat.isDirectory()) return null;

  const thumbnailPath = await findThumbnailCachePath(resolved.fullPath, originalStat);
  if (!thumbnailPath) return null;

  await assertRealPathInsideRoot(getThumbnailRoot(), thumbnailPath);
  const thumbnailStat = await stat(thumbnailPath);
  const headers = new Headers();
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", getContentType(thumbnailPath));
  headers.set("Content-Disposition", contentDisposition(`${path.basename(requestedPath)}.thumbnail`, false));
  headers.set("Content-Length", String(thumbnailStat.size));

  return new Response(nodeStream(thumbnailPath), { headers });
}
