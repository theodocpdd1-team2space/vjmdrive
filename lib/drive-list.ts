import path from "path";
import fs from "fs/promises";
import { createDownloadLink } from "./download-url";
import { formatBytes, getDriveItemType, getExtension } from "./file-utils";
import { getPreviewMetadata } from "./preview-cache";
import { readPreviewQueue } from "./preview-queue";
import {
  assertRealPathInsideRoot,
  isDriveSubPath,
  isIgnoredName,
  resolveSafePath,
} from "./safe-path";

export const LARGE_FILE_BYTES = 500 * 1024 * 1024;

export type DriveListOptions = {
  path: string;
  scopeRootPath?: string;
  urlPrefix?: string;
  canDownload?: boolean;
};

function rewriteUrl(url: string | null, prefix: string | undefined) {
  if (!url || !prefix) return url;

  if (url.startsWith("/api/file?")) return url.replace("/api/file?", `${prefix}/file?`);
  if (url.startsWith("/api/preview?")) return url.replace("/api/preview?", `${prefix}/preview?`);
  if (url.startsWith("/api/thumbnail?")) return url.replace("/api/thumbnail?", `${prefix}/thumbnail?`);
  if (url.startsWith("/api/list?")) return url.replace("/api/list?", `${prefix}/list?`);

  return url;
}

function scopedApiUrl(prefix: string, endpoint: string, relativePath: string, download = false) {
  const params = new URLSearchParams({ path: relativePath });
  if (download) params.set("download", "1");
  return `${prefix}/${endpoint}?${params.toString()}`;
}

export async function listDriveFolder(options: DriveListOptions) {
  const scopeRootPath = options.scopeRootPath || "";
  const requestedPath = options.path || "";
  const scopedPath = scopeRootPath ? path.posix.join(scopeRootPath, requestedPath) : requestedPath;

  if (scopeRootPath && !isDriveSubPath(scopeRootPath, scopedPath)) {
    throw new Error("Path outside share scope");
  }

  const safePath = resolveSafePath(scopedPath);
  await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);

  const folderStat = await fs.stat(safePath.absolutePath);
  if (!folderStat.isDirectory()) {
    if (!scopeRootPath || requestedPath) {
      throw new Error("Folder not found");
    }

    const previewMetadata = await getPreviewMetadata(safePath.relativePath, folderStat, false);
    const queued = await readPreviewQueue().catch(() => []);
    const queuedStatus = queued.find((item) => item.path === safePath.relativePath)?.status;
    const previewStatus = queuedStatus && previewMetadata.previewStatus !== "ready"
      ? queuedStatus
      : previewMetadata.previewStatus;
    const downloadLink = options.canDownload === false
      ? { directDownloadUrl: null, downloadMode: "app" as const }
      : {
          directDownloadUrl: scopedApiUrl(options.urlPrefix || "", "file", "", true),
          downloadMode: "app" as const,
        };
    const type = getDriveItemType(safePath.relativePath, false);
    const item = {
      name: path.basename(safePath.relativePath),
      path: "",
      type,
      extension: getExtension(safePath.relativePath),
      size: formatBytes(folderStat.size),
      bytes: folderStat.size,
      modified: folderStat.mtime.toISOString(),
      isLargeFile: folderStat.size > LARGE_FILE_BYTES,
      canPreview: previewStatus === "native" || previewStatus === "ready",
      ...previewMetadata,
      previewStatus,
      originalUrl: scopedApiUrl(options.urlPrefix || "", "file", ""),
      previewUrl: previewMetadata.previewUrl
        ? scopedApiUrl(options.urlPrefix || "", previewMetadata.previewStatus === "ready" ? "preview" : "file", "")
        : null,
      thumbnailUrl: previewMetadata.thumbnailUrl ? scopedApiUrl(options.urlPrefix || "", "thumbnail", "") : null,
      ...downloadLink,
    };

    return { path: "", items: [item] };
  }

  const entries = await fs.readdir(safePath.absolutePath, { withFileTypes: true });
  const queue = await readPreviewQueue().catch(() => []);
  const queueStatusByPath = new Map(
    queue
      .filter((item) => item.status === "queued" || item.status === "processing" || item.status === "failed")
      .map((item) => [item.path, item.status])
  );
  const items = await Promise.all(
    entries
      .filter((entry) => !isIgnoredName(entry.name))
      .filter((entry) => !entry.isSymbolicLink())
      .filter((entry) => entry.isDirectory() || entry.isFile())
      .map(async (entry) => {
        const itemAbs = path.join(safePath.absolutePath, entry.name);
        const stat = await fs.stat(itemAbs);
        const itemFullRelative = path.posix.join(safePath.relativePath, entry.name);
        const itemClientRelative = scopeRootPath
          ? path.posix.relative(scopeRootPath, itemFullRelative)
          : itemFullRelative;
        const type = getDriveItemType(entry.name, entry.isDirectory());
        const previewMetadata = await getPreviewMetadata(
          itemFullRelative,
          stat,
          entry.isDirectory()
        );
        const queuedStatus = queueStatusByPath.get(itemFullRelative);
        const previewStatus = queuedStatus && previewMetadata.previewStatus !== "ready"
          ? queuedStatus
          : previewMetadata.previewStatus;
        const downloadLink = options.urlPrefix
          ? {
              directDownloadUrl:
                options.canDownload === false || entry.isDirectory()
                  ? null
                  : scopedApiUrl(options.urlPrefix, "file", itemClientRelative, true),
              downloadMode: "app" as const,
            }
          : options.canDownload === false
            ? { directDownloadUrl: null, downloadMode: "app" as const }
            : createDownloadLink(itemFullRelative, entry.isDirectory());
        const scopedOriginalUrl = options.urlPrefix
          ? entry.isDirectory()
            ? scopedApiUrl(options.urlPrefix, "list", itemClientRelative)
            : scopedApiUrl(options.urlPrefix, "file", itemClientRelative)
          : rewriteUrl(previewMetadata.originalUrl, options.urlPrefix);
        const scopedPreviewUrl =
          options.urlPrefix && previewMetadata.previewUrl
            ? scopedApiUrl(
                options.urlPrefix,
                previewMetadata.previewStatus === "ready" ? "preview" : "file",
                itemClientRelative
              )
            : rewriteUrl(previewMetadata.previewUrl, options.urlPrefix);
        const scopedThumbnailUrl =
          options.urlPrefix && previewMetadata.thumbnailUrl
            ? scopedApiUrl(options.urlPrefix, "thumbnail", itemClientRelative)
            : rewriteUrl(previewMetadata.thumbnailUrl, options.urlPrefix);

        return {
          name: entry.name,
          path: itemClientRelative,
          type,
          extension: entry.isDirectory() ? "" : getExtension(entry.name),
          size: entry.isDirectory() ? null : formatBytes(stat.size),
          bytes: entry.isDirectory() ? 0 : stat.size,
          modified: stat.mtime.toISOString(),
          isLargeFile: !entry.isDirectory() && stat.size > LARGE_FILE_BYTES,
          canPreview:
            previewStatus === "native" ||
            previewStatus === "ready",
          ...previewMetadata,
          previewStatus,
          originalUrl: scopedOriginalUrl,
          previewUrl: scopedPreviewUrl,
          thumbnailUrl: scopedThumbnailUrl,
          ...downloadLink,
        };
      })
  );

  items.sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;
    return a.name.localeCompare(b.name);
  });

  const clientPath = scopeRootPath
    ? path.posix.relative(scopeRootPath, safePath.relativePath)
    : safePath.relativePath;

  return { path: clientPath, items };
}
