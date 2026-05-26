import fs from "fs/promises";
import path from "path";
import { getCacheRoot } from "./preview-cache";
import { normalizeDrivePath } from "./safe-path";

type JsonRecord = Record<string, unknown>;

export type MetadataUpdateSummary = {
  updatedShares: number;
  updatedPreviewQueue: number;
  updatedPreviewJobs: number;
};

export type MetadataCleanupSummary = {
  disabledShares: number;
  removedPreviewQueue: number;
  removedPreviewJobs: number;
};

export type MetadataCleanupOptions = {
  ownerUserId?: string;
};

function dbFile(name: string) {
  return path.join(getCacheRoot(), "db", name);
}

function normalizeRel(value: string) {
  return normalizeDrivePath(value || "");
}

function isSameOrChildPath(candidate: string, parentPath: string) {
  const safeCandidate = normalizeRel(candidate);
  const safeParent = normalizeRel(parentPath);
  return safeCandidate === safeParent || safeCandidate.startsWith(`${safeParent}/`);
}

function remapRelativePath(candidate: unknown, oldPath: string, newPath: string) {
  if (typeof candidate !== "string") return candidate;
  const safeCandidate = normalizeRel(candidate);
  const safeOldPath = normalizeRel(oldPath);
  const safeNewPath = normalizeRel(newPath);

  if (!isSameOrChildPath(safeCandidate, safeOldPath)) return candidate;
  if (safeCandidate === safeOldPath) return safeNewPath;

  return normalizeRel(`${safeNewPath}/${safeCandidate.slice(safeOldPath.length + 1)}`);
}

async function readJsonArray(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8").catch(() => "[]");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JsonRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeJsonArray(filePath: string, data: JsonRecord[]) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function updateSharesPath(oldPath: string, newPath: string) {
  const filePath = dbFile("shares.json");
  const shares = await readJsonArray(filePath);
  let changed = 0;
  const now = new Date().toISOString();

  const next = shares.map((share) => {
    const currentRootPath = typeof share.rootPath === "string" ? share.rootPath : "";
    const updatedRootPath = remapRelativePath(currentRootPath, oldPath, newPath);

    if (updatedRootPath !== currentRootPath) {
      changed += 1;
      return { ...share, rootPath: updatedRootPath, updatedAt: now };
    }
    return share;
  });

  if (changed > 0) await writeJsonArray(filePath, next);
  return changed;
}

async function updatePreviewMetadataFile(fileName: "preview-queue.json" | "preview-jobs.json", oldPath: string, newPath: string) {
  const filePath = dbFile(fileName);
  const jobs = await readJsonArray(filePath);
  const pathFields = ["path", "filePath", "relativePath", "inputPath", "sourcePath", "rootPath"];
  const now = new Date().toISOString();
  let changed = 0;

  const next = jobs.map((job) => {
    let touched = false;
    const updated: JsonRecord = { ...job };

    for (const field of pathFields) {
      const currentValue = updated[field];
      if (typeof currentValue !== "string") continue;
      const remappedValue = remapRelativePath(currentValue, oldPath, newPath);
      if (remappedValue !== currentValue) {
        updated[field] = remappedValue;
        touched = true;
      }
    }

    if (touched) {
      changed += 1;
      updated.updatedAt = now;
    }

    return updated;
  });

  if (changed > 0) await writeJsonArray(filePath, next);
  return changed;
}

export async function updateMoveRelatedMetadata(moves: Array<{ oldPath: string; newPath: string }>) {
  const summary: MetadataUpdateSummary = {
    updatedShares: 0,
    updatedPreviewQueue: 0,
    updatedPreviewJobs: 0,
  };

  for (const move of moves) {
    summary.updatedShares += await updateSharesPath(move.oldPath, move.newPath);
    summary.updatedPreviewQueue += await updatePreviewMetadataFile("preview-queue.json", move.oldPath, move.newPath);
    summary.updatedPreviewJobs += await updatePreviewMetadataFile("preview-jobs.json", move.oldPath, move.newPath);
  }

  return summary;
}

async function disableSharesForPaths(paths: string[], options: MetadataCleanupOptions = {}) {
  const filePath = dbFile("shares.json");
  const shares = await readJsonArray(filePath);
  const now = new Date().toISOString();
  let changed = 0;

  const next = shares.map((share) => {
    const rootPath = typeof share.rootPath === "string" ? share.rootPath : "";
    if (options.ownerUserId && share.ownerUserId !== options.ownerUserId) return share;
    const shouldDisable = paths.some((deletedPath) => isSameOrChildPath(rootPath, deletedPath));
    if (!shouldDisable || share.disabledAt) return share;
    changed += 1;
    return { ...share, disabledAt: now, updatedAt: now };
  });

  if (changed > 0) await writeJsonArray(filePath, next);
  return changed;
}

async function removePreviewMetadataForPaths(fileName: "preview-queue.json" | "preview-jobs.json", paths: string[]) {
  const filePath = dbFile(fileName);
  const rows = await readJsonArray(filePath);
  const pathFields = ["path", "filePath", "relativePath", "inputPath", "sourcePath", "rootPath"];

  const next = rows.filter((row) => {
    return !pathFields.some((field) => {
      const value = row[field];
      return typeof value === "string" && paths.some((deletedPath) => isSameOrChildPath(value, deletedPath));
    });
  });

  if (next.length !== rows.length) await writeJsonArray(filePath, next);
  return rows.length - next.length;
}

export async function cleanupDeletedPathMetadata(paths: string[], options: MetadataCleanupOptions = {}) {
  const safePaths = paths.map(normalizeRel).filter(Boolean);
  const summary: MetadataCleanupSummary = {
    disabledShares: 0,
    removedPreviewQueue: 0,
    removedPreviewJobs: 0,
  };

  if (!safePaths.length) return summary;

  summary.disabledShares = await disableSharesForPaths(safePaths, options);
  summary.removedPreviewQueue = await removePreviewMetadataForPaths("preview-queue.json", safePaths);
  summary.removedPreviewJobs = await removePreviewMetadataForPaths("preview-jobs.json", safePaths);
  return summary;
}

export function buildMovePlan(items: string[], targetFolder: string) {
  const safeTargetFolder = normalizeRel(targetFolder);

  return items.map((item) => {
    const oldPath = normalizeRel(item);
    const baseName = path.posix.basename(oldPath);
    const newPath = normalizeRel(path.posix.join(safeTargetFolder, baseName));
    return { oldPath, newPath };
  });
}
