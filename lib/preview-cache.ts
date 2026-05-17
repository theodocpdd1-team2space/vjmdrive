import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import type { Stats } from "fs";
import { getExtension } from "./file-utils";

export type PreviewStatus = "native" | "ready" | "missing" | "unsupported";

export const NATIVE_VIDEO_EXTENSIONS = new Set(["mp4", "webm", "m4v"]);

export type CachePaths = {
  id: string;
  previewPath: string;
  thumbnailJpgPath: string;
  thumbnailWebpPath: string;
};

export function getCacheRoot() {
  const configuredRoot = process.env.CACHE_ROOT;

  if (!configuredRoot || configuredRoot === "./.vjm-drive-cache") {
    return path.join(process.cwd(), ".vjm-drive-cache");
  }

  if (path.isAbsolute(configuredRoot)) {
    return path.resolve(configuredRoot);
  }

  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), configuredRoot);
}

export function getPreviewRoot() {
  const configuredRoot = process.env.PREVIEW_ROOT;

  if (!configuredRoot || configuredRoot === "./.vjm-drive-cache/previews") {
    return path.join(process.cwd(), ".vjm-drive-cache", "previews");
  }

  if (path.isAbsolute(configuredRoot)) {
    return path.resolve(configuredRoot);
  }

  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), configuredRoot);
}

export function getThumbnailRoot() {
  const configuredRoot = process.env.THUMBNAIL_ROOT;

  if (!configuredRoot || configuredRoot === "./.vjm-drive-cache/thumbnails") {
    return path.join(process.cwd(), ".vjm-drive-cache", "thumbnails");
  }

  if (path.isAbsolute(configuredRoot)) {
    return path.resolve(configuredRoot);
  }

  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), configuredRoot);
}

export function createOriginalUrl(relativePath: string) {
  return `/api/file?${new URLSearchParams({ path: relativePath }).toString()}`;
}

export function createPreviewUrl(relativePath: string) {
  return `/api/preview?${new URLSearchParams({ path: relativePath }).toString()}`;
}

export function createThumbnailUrl(relativePath: string) {
  return `/api/thumbnail?${new URLSearchParams({ path: relativePath }).toString()}`;
}

export function createFolderUrl(relativePath: string) {
  return `/api/list?${new URLSearchParams({ path: relativePath }).toString()}`;
}

export function createFileCacheId(relativePath: string, size: number, modifiedMs: number) {
  return crypto
    .createHash("sha256")
    .update(relativePath)
    .update("\n")
    .update(String(size))
    .update("\n")
    .update(String(Math.floor(modifiedMs)))
    .digest("hex")
    .slice(0, 32);
}

export function getCachePaths(relativePath: string, stat: Pick<Stats, "size" | "mtimeMs">): CachePaths {
  const id = createFileCacheId(relativePath, stat.size, stat.mtimeMs);

  return {
    id,
    previewPath: path.join(getPreviewRoot(), `${id}.mp4`),
    thumbnailJpgPath: path.join(getThumbnailRoot(), `${id}.jpg`),
    thumbnailWebpPath: path.join(getThumbnailRoot(), `${id}.webp`),
  };
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function findPreviewCachePath(relativePath: string, stat: Pick<Stats, "size" | "mtimeMs">) {
  const cachePaths = getCachePaths(relativePath, stat);
  return (await exists(cachePaths.previewPath)) ? cachePaths.previewPath : null;
}

export async function findThumbnailCachePath(relativePath: string, stat: Pick<Stats, "size" | "mtimeMs">) {
  const cachePaths = getCachePaths(relativePath, stat);

  if (await exists(cachePaths.thumbnailWebpPath)) {
    return cachePaths.thumbnailWebpPath;
  }

  if (await exists(cachePaths.thumbnailJpgPath)) {
    return cachePaths.thumbnailJpgPath;
  }

  return null;
}

export async function getPreviewMetadata(
  relativePath: string,
  stat: Pick<Stats, "size" | "mtimeMs">,
  isDirectory: boolean
) {
  const extension = getExtension(relativePath);
  const originalUrl = isDirectory ? createFolderUrl(relativePath) : createOriginalUrl(relativePath);

  if (isDirectory) {
    return {
      previewStatus: "unsupported" as PreviewStatus,
      previewUrl: null,
      thumbnailUrl: null,
      originalUrl,
    };
  }

  if (["jpg", "jpeg", "png", "webp", "gif", "pdf", "txt", "json", "md", "log"].includes(extension)) {
    return {
      previewStatus: "native" as PreviewStatus,
      previewUrl: originalUrl,
      thumbnailUrl: null,
      originalUrl,
    };
  }

  if (["mp4", "webm", "mov", "m4v", "avi", "mkv"].includes(extension)) {
    const [previewPath, thumbnailPath] = await Promise.all([
      findPreviewCachePath(relativePath, stat),
      findThumbnailCachePath(relativePath, stat),
    ]);

    if (previewPath) {
      return {
        previewStatus: "ready" as PreviewStatus,
        previewUrl: createPreviewUrl(relativePath),
        thumbnailUrl: thumbnailPath ? createThumbnailUrl(relativePath) : null,
        originalUrl,
      };
    }

    if (NATIVE_VIDEO_EXTENSIONS.has(extension)) {
      return {
        previewStatus: "native" as PreviewStatus,
        previewUrl: originalUrl,
        thumbnailUrl: thumbnailPath ? createThumbnailUrl(relativePath) : null,
        originalUrl,
      };
    }

    return {
      previewStatus: "missing" as PreviewStatus,
      previewUrl: null,
      thumbnailUrl: thumbnailPath ? createThumbnailUrl(relativePath) : null,
      originalUrl,
    };
  }

  return {
    previewStatus: "unsupported" as PreviewStatus,
    previewUrl: null,
    thumbnailUrl: null,
    originalUrl,
  };
}
