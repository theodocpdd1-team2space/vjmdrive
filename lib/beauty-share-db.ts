import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { getCacheRoot } from "./preview-cache";
import { isDriveSubPath, normalizeDrivePath } from "./safe-path";

export type BeautyShareTheme = "light" | "dark";
export type BeautyShareLayout = "collage" | "grid" | "magazine";

export type BeautyShare = {
  id: string;
  ownerUserId: string;
  rootPath: string;
  slug: string;
  title: string;
  subtitle?: string;
  clientName?: string;
  theme: BeautyShareTheme;
  layout: BeautyShareLayout;
  coverFilePath?: string;
  visibility: "PUBLIC";
  isActive: boolean;
  viewCount: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  lastAccessAt?: string;
};

export const RESERVED_BEAUTY_SLUGS = new Set([
  "admin",
  "api",
  "login",
  "signup",
  "dashboard",
  "drive",
  "shared",
  "account",
  "settings",
  "share",
  "s",
  "b",
  "beauty",
  "pricing",
  "reset-password",
  "forgot-password",
  "verify-email",
]);

function dbPath() {
  return path.join(getCacheRoot(), "db", "beauty-shares.json");
}

async function ensureDbDir() {
  await fs.mkdir(path.dirname(dbPath()), { recursive: true });
}

export function suggestBeautySlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function validateBeautySlug(value: string) {
  const slug = value.trim().toLowerCase();

  if (!/^[a-z0-9-]{3,64}$/.test(slug)) {
    throw new Error("Slug must be 3-64 characters using lowercase letters, numbers, and dashes.");
  }

  if (RESERVED_BEAUTY_SLUGS.has(slug)) {
    throw new Error("This slug is reserved.");
  }

  return slug;
}

function normalizeBeautyShare(raw: Partial<BeautyShare>): BeautyShare {
  const now = new Date().toISOString();
  const title = (raw.title || raw.clientName || "Client Delivery").trim();

  return {
    id: raw.id || crypto.randomUUID(),
    ownerUserId: raw.ownerUserId || "",
    rootPath: normalizeDrivePath(raw.rootPath || ""),
    slug: validateBeautySlug(raw.slug || suggestBeautySlug(title) || crypto.randomUUID().slice(0, 8)),
    title,
    subtitle: raw.subtitle || "",
    clientName: raw.clientName || "",
    theme: raw.theme === "dark" ? "dark" : "light",
    layout: raw.layout === "grid" || raw.layout === "magazine" ? raw.layout : "collage",
    coverFilePath: raw.coverFilePath ? normalizeDrivePath(raw.coverFilePath) : undefined,
    visibility: "PUBLIC",
    isActive: raw.isActive !== false,
    viewCount: Number.isFinite(raw.viewCount) ? Number(raw.viewCount) : 0,
    downloadCount: Number.isFinite(raw.downloadCount) ? Number(raw.downloadCount) : 0,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || raw.createdAt || now,
    lastAccessAt: raw.lastAccessAt,
  };
}

export async function readBeautyShares(): Promise<BeautyShare[]> {
  await ensureDbDir();
  const raw = await fs.readFile(dbPath(), "utf8").catch(() => "[]");
  const data = JSON.parse(raw) as Array<Partial<BeautyShare>>;
  return Array.isArray(data) ? data.map(normalizeBeautyShare).filter((share) => share.ownerUserId) : [];
}

export async function writeBeautyShares(shares: BeautyShare[]) {
  await ensureDbDir();
  await fs.writeFile(dbPath(), JSON.stringify(shares.map(normalizeBeautyShare), null, 2));
}

export async function createBeautyShare(input: {
  ownerUserId: string;
  rootPath: string;
  slug: string;
  title: string;
  subtitle?: string;
  clientName?: string;
  theme?: BeautyShareTheme;
  layout?: BeautyShareLayout;
  coverFilePath?: string;
}) {
  const shares = await readBeautyShares();
  const slug = validateBeautySlug(input.slug);

  if (shares.some((share) => share.slug === slug)) {
    throw new Error("Slug already exists.");
  }

  const now = new Date().toISOString();
  const share = normalizeBeautyShare({
    id: crypto.randomUUID(),
    ownerUserId: input.ownerUserId,
    rootPath: input.rootPath,
    slug,
    title: input.title,
    subtitle: input.subtitle,
    clientName: input.clientName,
    theme: input.theme,
    layout: input.layout,
    coverFilePath: input.coverFilePath,
    visibility: "PUBLIC",
    isActive: true,
    viewCount: 0,
    downloadCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  shares.unshift(share);
  await writeBeautyShares(shares);
  return share;
}

export async function getBeautyShareBySlug(slug: string) {
  const safeSlug = validateBeautySlug(slug);
  const shares = await readBeautyShares();
  return shares.find((share) => share.slug === safeSlug) || null;
}

export async function getBeautySharesByOwner(ownerUserId: string) {
  const shares = await readBeautyShares();
  return shares.filter((share) => share.ownerUserId === ownerUserId);
}

export async function getBeautyShareById(id: string) {
  const shares = await readBeautyShares();
  return shares.find((share) => share.id === id) || null;
}

export async function updateBeautyShare(id: string, patch: Partial<Pick<BeautyShare, "title" | "subtitle" | "clientName" | "theme" | "layout" | "isActive" | "coverFilePath">>) {
  const shares = await readBeautyShares();
  const index = shares.findIndex((share) => share.id === id);
  if (index === -1) return null;

  shares[index] = normalizeBeautyShare({
    ...shares[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  await writeBeautyShares(shares);
  return shares[index];
}

export async function disableBeautyShare(id: string) {
  return updateBeautyShare(id, { isActive: false });
}

export async function incrementBeautyShareView(id: string) {
  const now = new Date().toISOString();
  const shares = await readBeautyShares();
  const index = shares.findIndex((share) => share.id === id);
  if (index === -1) return null;
  shares[index] = normalizeBeautyShare({
    ...shares[index],
    viewCount: shares[index].viewCount + 1,
    lastAccessAt: now,
    updatedAt: now,
  });
  await writeBeautyShares(shares);
  return shares[index];
}

export async function incrementBeautyShareDownload(id: string) {
  const now = new Date().toISOString();
  const shares = await readBeautyShares();
  const index = shares.findIndex((share) => share.id === id);
  if (index === -1) return null;
  shares[index] = normalizeBeautyShare({
    ...shares[index],
    downloadCount: shares[index].downloadCount + 1,
    lastAccessAt: now,
    updatedAt: now,
  });
  await writeBeautyShares(shares);
  return shares[index];
}

export async function disableBeautySharesForDeletedPaths(paths: string[], ownerUserId?: string) {
  const safePaths = paths.map((item) => normalizeDrivePath(item || "")).filter(Boolean);
  if (!safePaths.length) return 0;

  const shares = await readBeautyShares();
  const now = new Date().toISOString();
  let changed = 0;

  const next = shares.map((share) => {
    if (!share.isActive) return share;
    if (ownerUserId && share.ownerUserId !== ownerUserId) return share;
    const shouldDisable = safePaths.some((deletedPath) => isDriveSubPath(deletedPath, share.rootPath));
    if (!shouldDisable) return share;
    changed += 1;
    return normalizeBeautyShare({ ...share, isActive: false, updatedAt: now });
  });

  if (changed) await writeBeautyShares(next);
  return changed;
}
