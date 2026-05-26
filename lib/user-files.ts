import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as NodeReadableStream } from "stream/web";
import { ensureUniquePath, moveItems, resolveExisting, softDelete } from "./file-ops";
import { assertRealPathInsideRoot, assertSafeName, isDriveSubPath, normalizeDrivePath, resolveSafePath } from "./safe-path";
import { ensureUserStorage, userStorageRelativePath, userStoragePath, type DriveUser } from "./auth";
import { directorySize } from "./storage";

export function resolveUserDrivePath(userId: string, input: string) {
  const root = userStorageRelativePath(userId);
  const relative = normalizeDrivePath(input);
  const full = relative ? path.posix.join(root, relative) : root;
  if (!isDriveSubPath(root, full)) throw new Error("Invalid path");
  return full === `${root}/.` ? root : full;
}

export async function assertUserQuota(user: DriveUser, incomingBytes = 0) {
  if (user.quotaBytes === null) return;
  const used = await directorySize(userStoragePath(user.id));
  if (used + incomingBytes > user.quotaBytes) throw new Error("Storage quota exceeded");
}

export async function uploadUserFiles(user: DriveUser, targetPath: string, files: File[]) {
  await ensureUserStorage(user.id);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  await assertUserQuota(user, totalBytes);

  const fullTargetPath = resolveUserDrivePath(user.id, targetPath);
  const target = resolveSafePath(fullTargetPath);
  await assertRealPathInsideRoot(target.root, target.absolutePath);
  const targetStat = await fs.stat(target.absolutePath);
  if (!targetStat.isDirectory()) throw new Error("Target is not a folder");

  const uploaded: string[] = [];
  for (const file of files) {
    await assertUserQuota(user, file.size);
    const safeName = assertSafeName(file.name);
    const destination = await ensureUniquePath(target.absolutePath, safeName);
    await pipeline(Readable.fromWeb(file.stream() as unknown as NodeReadableStream), createWriteStream(destination));
    uploaded.push(path.posix.relative(userStorageRelativePath(user.id), path.posix.join(fullTargetPath, path.basename(destination))));
  }
  return uploaded;
}

export async function moveUserItems(user: DriveUser, items: string[], targetFolder: string) {
  const root = userStorageRelativePath(user.id);
  const fullItems = items.map((item) => {
    const fullPath = path.posix.join(root, normalizeDrivePath(item));
    if (!isDriveSubPath(root, fullPath)) throw new Error("Invalid path");
    return fullPath;
  });
  const fullTarget = path.posix.join(root, normalizeDrivePath(targetFolder));
  if (!isDriveSubPath(root, fullTarget)) throw new Error("Invalid target");
  const moved = await moveItems(fullItems, fullTarget);
  return moved.map((item) => path.posix.relative(root, item));
}

export async function deleteUserItem(user: DriveUser, itemPath: string, type: "file" | "folder") {
  const root = userStorageRelativePath(user.id);
  const relative = normalizeDrivePath(itemPath);

  if (!relative) throw new Error("Cannot delete drive root");

  const fullPath = path.posix.join(root, relative);
  if (!isDriveSubPath(root, fullPath)) throw new Error("Invalid path");

  const existing = await resolveExisting(fullPath);
  const stat = await fs.stat(existing.absolutePath);

  if (type === "file" && !stat.isFile()) throw new Error("Selected item is not a file");
  if (type === "folder" && !stat.isDirectory()) throw new Error("Selected item is not a folder");

  const deleted = await softDelete([fullPath]);
  return deleted.map((item) => path.posix.relative(root, item));
}
