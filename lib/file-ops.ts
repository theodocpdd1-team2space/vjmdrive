import fs from "fs/promises";
import path from "path";
import { getCacheRoot } from "./preview-cache";
import {
  assertRealPathInsideRoot,
  assertSafeName,
  getAssetRoot,
  isDriveSubPath,
  joinDrivePath,
  resolveSafePath,
} from "./safe-path";

export async function ensureUniquePath(folderAbs: string, desiredName: string) {
  const parsed = path.parse(assertSafeName(desiredName));
  let candidate = path.join(/*turbopackIgnore: true*/ folderAbs, desiredName);
  let index = 1;

  while (await fs.stat(candidate).then(() => true).catch(() => false)) {
    candidate = path.join(/*turbopackIgnore: true*/ folderAbs, `${parsed.name} (${index})${parsed.ext}`);
    index += 1;
  }

  return candidate;
}

export async function resolveExisting(relativePath: string) {
  const safePath = resolveSafePath(relativePath);
  await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);
  return safePath;
}

export async function createFolder(parentPath: string, name: string) {
  const relativePath = joinDrivePath(parentPath, name);
  const safePath = resolveSafePath(relativePath);
  await fs.mkdir(safePath.absolutePath, { recursive: false });
  return safePath.relativePath;
}

export async function renameItem(relativePath: string, newName: string) {
  const source = await resolveExisting(relativePath);
  const destination = path.join(
    /*turbopackIgnore: true*/ path.dirname(source.absolutePath),
    assertSafeName(newName)
  );
  const root = getAssetRoot();

  if ((await fs.stat(destination).catch(() => null)) !== null) {
    throw new Error("Target already exists");
  }

  await assertRealPathInsideRoot(root, path.dirname(destination));
  await fs.rename(source.absolutePath, destination);
  return path.posix.join(path.posix.dirname(source.relativePath), assertSafeName(newName));
}

export async function moveItems(paths: string[], targetFolder: string) {
  const target = await resolveExisting(targetFolder);
  const targetStat = await fs.stat(target.absolutePath);
  if (!targetStat.isDirectory()) throw new Error("Target is not a folder");

  const moved: string[] = [];

  for (const relativePath of paths) {
    const source = await resolveExisting(relativePath);
    if (isDriveSubPath(source.relativePath, target.relativePath)) {
      throw new Error("Cannot move a folder into itself");
    }

    const destination = await ensureUniquePath(target.absolutePath, path.basename(source.absolutePath));
    await fs.rename(source.absolutePath, destination);
    moved.push(path.posix.join(target.relativePath, path.basename(destination)));
  }

  return moved;
}

export async function softDelete(paths: string[]) {
  const date = new Date().toISOString().slice(0, 10);
  const trashRoot = path.join(/*turbopackIgnore: true*/ getCacheRoot(), "trash", date);
  const deleted: string[] = [];

  for (const relativePath of paths) {
    const source = await resolveExisting(relativePath);
    const destination = path.join(/*turbopackIgnore: true*/ trashRoot, source.relativePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const uniqueDestination = await ensureUniquePath(path.dirname(destination), path.basename(destination));
    await fs.rename(source.absolutePath, uniqueDestination);
    deleted.push(source.relativePath);
  }

  return deleted;
}
