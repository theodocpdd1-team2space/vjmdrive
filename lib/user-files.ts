import fs from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import type { PathLike } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as NodeReadableStream } from "stream/web";
import { ensureUniquePath, moveItems, resolveExisting, softDelete } from "./file-ops";
import { assertRealPathInsideRoot, assertSafeName, isDriveSubPath, normalizeDrivePath, resolveSafePath } from "./safe-path";
import { ensureUserStorage, userStorageRelativePath, userStoragePath, type DriveUser } from "./auth";
import { directorySize } from "./storage";

export function resolveUserDrivePath(user: DriveUser | string, input: string) {
  const root = userStorageRelativePath(user);
  const relative = normalizeDrivePath(input);
  const full = relative ? path.posix.join(root, relative) : root;
  if (!isDriveSubPath(root, full)) throw new Error("Invalid path");
  return full === `${root}/.` ? root : full;
}

export async function assertUserQuota(user: DriveUser, incomingBytes = 0) {
  if (user.quotaBytes === null) return;
  const used = await directorySize(userStoragePath(user));
  if (used + incomingBytes > user.quotaBytes) throw new Error("Storage quota exceeded");
}

async function prepareUserUploadDestination(user: DriveUser, targetPath: string, fileName: string, relativePath = "") {
  await ensureUserStorage(user);

  const root = userStorageRelativePath(user);
  const fullTargetPath = resolveUserDrivePath(user, targetPath);
  const target = resolveSafePath(fullTargetPath);
  await assertRealPathInsideRoot(target.root, target.absolutePath);
  const targetStat = await fs.stat(target.absolutePath);
  if (!targetStat.isDirectory()) throw new Error("Target is not a folder");

  const requestedRelativePath = relativePath ? normalizeDrivePath(relativePath) : "";
  const folderRelativePath = requestedRelativePath ? path.posix.dirname(requestedRelativePath) : "";
  const safeFolderRelativePath = folderRelativePath === "." ? "" : normalizeDrivePath(folderRelativePath);
  const safeName = assertSafeName(requestedRelativePath ? path.posix.basename(requestedRelativePath) : fileName);
  const fullFolderPath = safeFolderRelativePath ? path.posix.join(fullTargetPath, safeFolderRelativePath) : fullTargetPath;

  if (!isDriveSubPath(root, fullFolderPath)) throw new Error("Invalid upload path");

  const destinationFolder = resolveSafePath(fullFolderPath);
  await fs.mkdir(destinationFolder.absolutePath, { recursive: true });
  await assertRealPathInsideRoot(destinationFolder.root, destinationFolder.absolutePath);

  const destination = await ensureUniquePath(destinationFolder.absolutePath, safeName);
  return {
    destination,
    uploadedRelativePath: path.posix.relative(root, path.posix.join(fullFolderPath, path.basename(destination))),
  };
}

export async function createUserFolder(user: DriveUser, parentPath: string, name: string) {
  await ensureUserStorage(user);
  const root = userStorageRelativePath(user);
  const fullParentPath = resolveUserDrivePath(user, parentPath);
  const parent = resolveSafePath(fullParentPath);
  await assertRealPathInsideRoot(parent.root, parent.absolutePath);

  const parentStat = await fs.stat(parent.absolutePath);
  if (!parentStat.isDirectory()) throw new Error("Target is not a folder");

  const safeName = assertSafeName(name);
  const fullFolderPath = path.posix.join(fullParentPath, safeName);
  if (!isDriveSubPath(root, fullFolderPath)) throw new Error("Invalid path");

  const destination = resolveSafePath(fullFolderPath);
  await fs.mkdir(destination.absolutePath, { recursive: false });
  return path.posix.relative(root, destination.relativePath);
}

export async function uploadUserFiles(user: DriveUser, targetPath: string, files: File[], relativePaths: string[] = []) {
  await ensureUserStorage(user);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  await assertUserQuota(user, totalBytes);

  const uploaded: string[] = [];
  for (const [index, file] of files.entries()) {
    await assertUserQuota(user, file.size);
    const { destination, uploadedRelativePath } = await prepareUserUploadDestination(
      user,
      targetPath,
      file.name,
      relativePaths[index] || ""
    );
    await pipeline(Readable.fromWeb(file.stream() as unknown as NodeReadableStream), createWriteStream(destination));
    uploaded.push(uploadedRelativePath);
  }
  return uploaded;
}

export async function uploadUserFileFromChunks({
  user,
  targetPath,
  fileName,
  relativePath,
  fileSize,
  chunkPaths,
}: {
  user: DriveUser;
  targetPath: string;
  fileName: string;
  relativePath: string;
  fileSize: number;
  chunkPaths: PathLike[];
}) {
  await ensureUserStorage(user);
  await assertUserQuota(user, fileSize);

  const { destination, uploadedRelativePath } = await prepareUserUploadDestination(user, targetPath, fileName, relativePath);

  try {
    for (const [index, chunkPath] of chunkPaths.entries()) {
      await pipeline(createReadStream(chunkPath), createWriteStream(destination, { flags: index === 0 ? "wx" : "a" }));
    }

    const stat = await fs.stat(destination);
    if (stat.size !== fileSize) {
      await fs.rm(destination, { force: true });
      throw new Error("Upload verification failed: assembled file size does not match original file size.");
    }

    return uploadedRelativePath;
  } catch (caught) {
    await fs.rm(destination, { force: true }).catch(() => undefined);
    throw caught;
  }
}

export async function moveUserItems(user: DriveUser, items: string[], targetFolder: string) {
  const root = userStorageRelativePath(user);
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
  const root = userStorageRelativePath(user);
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

export async function deleteUserItems(user: DriveUser, itemPaths: string[]) {
  const deleted: string[] = [];
  const failed: Array<{ path: string; message: string }> = [];

  for (const itemPath of Array.from(new Set(itemPaths))) {
    try {
      const root = userStorageRelativePath(user);
      const relative = normalizeDrivePath(itemPath);

      if (!relative) throw new Error("Cannot delete drive root");

      const fullPath = path.posix.join(root, relative);
      if (!isDriveSubPath(root, fullPath)) throw new Error("Invalid path");

      const existing = await resolveExisting(fullPath);
      const stat = await fs.stat(existing.absolutePath);
      if (!stat.isFile() && !stat.isDirectory()) throw new Error("Selected item is not a file or folder");

      const removed = await softDelete([fullPath]);
      deleted.push(...removed.map((item) => path.posix.relative(root, item)));
    } catch (caught) {
      failed.push({
        path: itemPath,
        message: caught instanceof Error ? caught.message : "Delete failed.",
      });
    }
  }

  return { deleted, failed };
}
