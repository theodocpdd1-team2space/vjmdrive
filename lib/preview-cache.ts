import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import type { Stats } from "fs";
import { getExtension } from "./file-utils";
import { assertRealPathInsideRoot, resolveSafePath } from "./safe-path";

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
    return path.join(/*turbopackIgnore: true*/ process.cwd(), ".vjm-drive-cache");
  }

  if (path.isAbsolute(configuredRoot)) {
    return path.resolve(configuredRoot);
  }

  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), configuredRoot);
}

export function getPreviewRoot() {
  const configuredRoot = process.env.PREVIEW_ROOT;

  if (!configuredRoot || configuredRoot === "./.vjm-drive-cache/previews") {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), ".vjm-drive-cache", "previews");
  }

  if (path.isAbsolute(configuredRoot)) {
    return path.resolve(configuredRoot);
  }

  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), configuredRoot);
}

export function getThumbnailRoot() {
  const configuredRoot = process.env.THUMBNAIL_ROOT;

  if (!configuredRoot || configuredRoot === "./.vjm-drive-cache/thumbnails") {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), ".vjm-drive-cache", "thumbnails");
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

async function copyCacheIfSafe(sourcePath: string, destinationPath: string) {
  if (!(await exists(sourcePath))) return false;
  if (await exists(destinationPath)) return false;
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
  return true;
}

async function listMovedFiles(newRelativePath: string) {
  const safePath = resolveSafePath(newRelativePath);
  await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);
  const rootStat = await fs.stat(safePath.absolutePath).catch(() => null);
  if (!rootStat) return [];
  if (rootStat.isFile()) return [{ relativePath: safePath.relativePath, stat: rootStat }];
  if (!rootStat.isDirectory()) return [];

  const files: Array<{ relativePath: string; stat: Stats }> = [];

  async function walk(absoluteFolder: string, relativeFolder: string) {
    const entries = await fs.readdir(absoluteFolder, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolutePath = path.join(absoluteFolder, entry.name);
      const relativePath = path.posix.join(relativeFolder, entry.name);
      const stat = await fs.stat(absolutePath).catch(() => null);
      if (!stat) continue;
      if (entry.isDirectory()) await walk(absolutePath, relativePath);
      else if (entry.isFile()) files.push({ relativePath, stat });
    }
  }

  await walk(safePath.absolutePath, safePath.relativePath);
  return files;
}

export async function migratePreviewCacheForMoves(moves: Array<{ oldPath: string; newPath: string }>) {
  const summary = {
    migratedPreviewFiles: 0,
    migratedThumbnailFiles: 0,
    skippedExistingFiles: 0,
  };

  for (const move of moves) {
    const files = await listMovedFiles(move.newPath);
    for (const file of files) {
      const suffix = file.relativePath === move.newPath ? "" : file.relativePath.slice(move.newPath.length + 1);
      const oldRelativePath = suffix ? path.posix.join(move.oldPath, suffix) : move.oldPath;
      const oldCache = getCachePaths(oldRelativePath, file.stat);
      const newCache = getCachePaths(file.relativePath, file.stat);

      for (const [sourcePath, destinationPath, kind] of [
        [oldCache.previewPath, newCache.previewPath, "preview"],
        [oldCache.thumbnailJpgPath, newCache.thumbnailJpgPath, "thumbnail"],
        [oldCache.thumbnailWebpPath, newCache.thumbnailWebpPath, "thumbnail"],
      ] as const) {
        const copied = await copyCacheIfSafe(sourcePath, destinationPath);
        if (copied && kind === "preview") summary.migratedPreviewFiles += 1;
        if (copied && kind === "thumbnail") summary.migratedThumbnailFiles += 1;
        if (!copied && (await exists(sourcePath)) && (await exists(destinationPath))) summary.skippedExistingFiles += 1;
      }
    }
  }

  return summary;
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

  if (["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) {
    const thumbnailPath = await findThumbnailCachePath(relativePath, stat);
    return {
      previewStatus: "native" as PreviewStatus,
      previewUrl: originalUrl,
      thumbnailUrl: thumbnailPath ? createThumbnailUrl(relativePath) : null,
      originalUrl,
    };
  }

  if (["svg", "pdf", "txt", "json", "md", "xml", "html", "css", "js", "ts", "tsx", "jsx", "py", "php", "sql", "log", "csv", "mp3", "wav", "aac", "m4a", "flac", "ogg"].includes(extension)) {
    return {
      previewStatus: "native" as PreviewStatus,
      previewUrl: originalUrl,
      thumbnailUrl: null,
      originalUrl,
    };
  }

  if (["mp4", "webm", "mov", "m4v", "avi", "mkv", "dxv"].includes(extension)) {
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
