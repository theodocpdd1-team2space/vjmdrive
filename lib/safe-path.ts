import path from "path";
import fs from "fs/promises";

export const IGNORED_NAMES = new Set([
  "$RECYCLE.BIN",
  "System Volume Information",
  "found.000",
  "found.001",
  "__MACOSX",
  ".DS_Store",
]);

export type SafePath = {
  absolutePath: string;
  relativePath: string;
  root: string;
};

export function getAssetRoot() {
  const configuredRoot = process.env.ASSET_ROOT;

  if (!configuredRoot || configuredRoot === "./public/sample-drive") {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "sample-drive");
  }

  if (path.isAbsolute(configuredRoot)) {
    return path.resolve(configuredRoot);
  }

  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), configuredRoot);
}

export function isIgnoredName(name: string) {
  return name.startsWith(".") || IGNORED_NAMES.has(name);
}

export function normalizeDrivePath(input: string | null | undefined) {
  const candidate = (input || "").replaceAll("\\", "/");

  if (candidate.includes("\0") || path.posix.isAbsolute(candidate)) {
    throw new Error("Invalid path");
  }

  const normalized = path.posix.normalize(candidate);

  if (normalized === ".") {
    return "";
  }

  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Invalid path");
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.some(isIgnoredName)) {
    throw new Error("Ignored path");
  }

  return segments.join("/");
}

export function isInsideRoot(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveSafePath(input: string | null | undefined): SafePath {
  const root = getAssetRoot();
  const relativePath = normalizeDrivePath(input);
  const absolutePath = path.resolve(root, relativePath);

  if (!isInsideRoot(root, absolutePath)) {
    throw new Error("Invalid path");
  }

  return { absolutePath, relativePath, root };
}

export async function assertRealPathInsideRoot(root: string, target: string) {
  const [realRoot, realTarget] = await Promise.all([fs.realpath(root), fs.realpath(target)]);

  if (!isInsideRoot(realRoot, realTarget)) {
    throw new Error("Invalid path");
  }

  return realTarget;
}

export function assertSafeName(name: string) {
  const cleanName = name.trim();

  if (
    !cleanName ||
    cleanName.includes("/") ||
    cleanName.includes("\\") ||
    cleanName.includes("\0") ||
    cleanName === "." ||
    cleanName === ".." ||
    isIgnoredName(cleanName)
  ) {
    throw new Error("Invalid name");
  }

  return cleanName;
}

export function joinDrivePath(parentPath: string, childName: string) {
  const safeParent = normalizeDrivePath(parentPath);
  const safeName = assertSafeName(childName);
  return path.posix.join(safeParent, safeName);
}

export function isDriveSubPath(parentPath: string, childPath: string) {
  const parent = normalizeDrivePath(parentPath);
  const child = normalizeDrivePath(childPath);

  return parent === "" || child === parent || child.startsWith(`${parent}/`);
}
