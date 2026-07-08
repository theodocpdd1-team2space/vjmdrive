import fs from "fs/promises";
import path from "path";
import { ensureUniquePath } from "./file-ops";
import type { ClientSelectLink, ClientSelectSubmission } from "./client-select-db";
import { assertRealPathInsideRoot, assertSafeName, isDriveSubPath, resolveSafePath } from "./safe-path";

function projectSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "client-select";
}

export function selectedZipFileName(projectName: string) {
  return `${projectSlug(projectName)}-selected-files.zip`;
}

function uniqueArchiveName(used: Set<string>, filename: string) {
  const safeName = assertSafeName(filename);
  const parsed = path.parse(safeName);
  let candidate = safeName;
  let index = 1;

  while (used.has(candidate)) {
    candidate = `${parsed.name}-copy-${index}${parsed.ext}`;
    index += 1;
  }

  used.add(candidate);
  return candidate;
}

export async function resolveSelectedFilesForRead(link: ClientSelectLink, submission: ClientSelectSubmission) {
  const usedNames = new Set<string>();
  const files: Array<{ absolutePath: string; archiveName: string; path: string; filename: string }> = [];
  const warnings: string[] = [];

  for (const selected of submission.selectedFiles) {
    try {
      const fullPath = path.posix.join(link.rootPath, selected.path);
      if (!isDriveSubPath(link.rootPath, fullPath)) throw new Error("Path outside Client Select root.");

      const safePath = resolveSafePath(fullPath);
      await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);
      const stat = await fs.stat(safePath.absolutePath);
      if (!stat.isFile()) throw new Error("Selected path is not a file.");

      files.push({
        absolutePath: safePath.absolutePath,
        archiveName: uniqueArchiveName(usedNames, selected.filename || path.posix.basename(selected.path)),
        path: selected.path,
        filename: selected.filename || path.posix.basename(selected.path),
      });
    } catch (caught) {
      warnings.push(`${selected.path}: ${caught instanceof Error ? caught.message : "Skipped"}`);
    }
  }

  return { files, warnings };
}

export async function copySelectedFilesToFolder(link: ClientSelectLink, submission: ClientSelectSubmission) {
  const root = resolveSafePath(link.rootPath);
  await assertRealPathInsideRoot(root.root, root.absolutePath);
  const rootStat = await fs.stat(root.absolutePath);
  if (!rootStat.isDirectory()) throw new Error("Client Select root folder not found.");

  const folderBase = `Selected by Client - ${link.projectName}`
    .replace(/[<>:"/\\|?*\0]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "Selected by Client";
  const destinationFolder = await ensureUniquePath(root.absolutePath, folderBase);
  await fs.mkdir(destinationFolder, { recursive: false });
  await assertRealPathInsideRoot(root.root, destinationFolder);

  const errors: string[] = [];
  let copiedCount = 0;
  let skippedCount = 0;

  for (const selected of submission.selectedFiles) {
    try {
      const fullPath = path.posix.join(link.rootPath, selected.path);
      if (!isDriveSubPath(link.rootPath, fullPath)) throw new Error("Path outside Client Select root.");
      const source = resolveSafePath(fullPath);
      await assertRealPathInsideRoot(source.root, source.absolutePath);
      const stat = await fs.stat(source.absolutePath);
      if (!stat.isFile()) throw new Error("Selected path is not a file.");

      const destination = await ensureUniquePath(destinationFolder, selected.filename || path.basename(source.absolutePath));
      await fs.copyFile(source.absolutePath, destination);
      copiedCount += 1;
    } catch (caught) {
      skippedCount += 1;
      errors.push(`${selected.path}: ${caught instanceof Error ? caught.message : "Copy failed"}`);
    }
  }

  return {
    selectedFolderPath: path.posix.join(link.rootPath, path.basename(destinationFolder)),
    copiedCount,
    skippedCount,
    errors,
    createdAt: new Date().toISOString(),
  };
}
