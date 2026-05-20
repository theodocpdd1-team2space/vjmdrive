import { stat } from "fs/promises";
import path from "path";
import { contentDisposition, getContentType } from "./file-utils";
import { nodeStream, parseRange } from "./http-file";
import { assertRealPathInsideRoot, isDriveSubPath, normalizeDrivePath, resolveSafePath } from "./safe-path";

export async function createFileResponseForPath(scopeRootPath: string, requestedPath: string, range: string | null, download: boolean) {
  const fullPath = path.posix.join(scopeRootPath, normalizeDrivePath(requestedPath));
  if (!isDriveSubPath(scopeRootPath, fullPath)) return null;

  const safePath = resolveSafePath(fullPath);
  await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);
  const fileStat = await stat(safePath.absolutePath).catch(() => null);
  if (!fileStat || fileStat.isDirectory()) return null;

  const headers = new Headers();
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", getContentType(safePath.absolutePath));
  headers.set("Content-Disposition", contentDisposition(path.basename(safePath.absolutePath), download));
  headers.set("X-Content-Type-Options", "nosniff");

  const byteRange = parseRange(range, fileStat.size);
  if (range && (!byteRange || byteRange.start >= fileStat.size)) {
    headers.set("Content-Range", `bytes */${fileStat.size}`);
    return new Response(null, { status: 416, headers });
  }
  if (byteRange) {
    headers.set("Content-Range", `bytes ${byteRange.start}-${byteRange.end}/${fileStat.size}`);
    headers.set("Content-Length", String(byteRange.end - byteRange.start + 1));
    return new Response(nodeStream(safePath.absolutePath, byteRange), { status: 206, headers });
  }
  headers.set("Content-Length", String(fileStat.size));
  return new Response(nodeStream(safePath.absolutePath), { headers });
}
