import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { getCacheRoot } from "./preview-cache";
import { normalizeDrivePath } from "./safe-path";
import { normalizeEmail, type SessionUser } from "./auth";

export type SharePermission = "VIEW_ONLY" | "DOWNLOAD" | "UPLOAD" | "FULL";
export type ShareVisibility = "PRIVATE" | "PUBLIC_LOGIN" | "PUBLIC";
type LegacyShareVisibility = ShareVisibility | "PRIVATE_EMAILS";

export type ShareLink = {
  id: string;
  token: string;
  title: string;
  name: string;
  rootPath: string;
  ownerUserId: string | "admin";
  permission: SharePermission;
  visibility: ShareVisibility;
  accessMode: ShareVisibility;
  allowedEmails: string[];
  invitedEmails: string[];
  expiresAt: string | null;
  passwordHash?: string | null;
  downloadEnabled: boolean;
  previewEnabled: boolean;
  canDownload: boolean;
  pinned: boolean;
  note?: string;
  disabledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: "admin";
};

type RawShareLink = Partial<Omit<ShareLink, "visibility" | "accessMode">> & {
  visibility?: LegacyShareVisibility;
  accessMode?: LegacyShareVisibility;
  accessModeVersion?: number;
  publicAccess?: boolean;
  canDownload?: boolean;
};

function dbPath() {
  return path.join(getCacheRoot(), "db", "shares.json");
}

function legacyDbPath() {
  return path.join(getCacheRoot(), "db", "share-links.json");
}

async function ensureDbDir() {
  await fs.mkdir(path.dirname(dbPath()), { recursive: true });
}

function uniqueEmails(emails: string[]) {
  return Array.from(
    new Set(
      emails
        .map((email) => normalizeEmail(email))
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    )
  );
}

function normalizePermission(permission?: SharePermission, canDownload?: boolean): SharePermission {
  if (permission === "VIEW_ONLY") return "VIEW_ONLY";
  if (permission === "DOWNLOAD") return "DOWNLOAD";
  if (permission === "UPLOAD") return "UPLOAD";
  if (permission === "FULL") return "FULL";

  return canDownload === false ? "VIEW_ONLY" : "DOWNLOAD";
}

function normalizeVisibility(raw: Pick<RawShareLink, "visibility" | "accessMode" | "accessModeVersion" | "publicAccess">): ShareVisibility {
  if (raw.accessMode === "PRIVATE") return "PRIVATE";
  if (raw.accessMode === "PUBLIC_LOGIN" || raw.accessMode === "PRIVATE_EMAILS") return "PUBLIC_LOGIN";
  if (raw.accessMode === "PUBLIC") return "PUBLIC";

  if (raw.visibility === "PRIVATE") return "PRIVATE";
  if (raw.visibility === "PUBLIC_LOGIN" || raw.visibility === "PRIVATE_EMAILS") return "PUBLIC_LOGIN";

  if (raw.visibility === "PUBLIC") {
    return raw.publicAccess === true || raw.accessModeVersion === 2 ? "PUBLIC" : "PUBLIC_LOGIN";
  }

  return "PUBLIC_LOGIN";
}

export function normalizeShareVisibility(value: unknown, fallback: ShareVisibility = "PUBLIC_LOGIN"): ShareVisibility {
  if (value === "PRIVATE") return "PRIVATE";
  if (value === "PUBLIC") return "PUBLIC";
  if (value === "PUBLIC_LOGIN" || value === "PRIVATE_EMAILS") return "PUBLIC_LOGIN";
  return fallback;
}

function normalizeShare(raw: RawShareLink): ShareLink {
  const now = new Date().toISOString();

  const permission = normalizePermission(raw.permission, raw.canDownload);
  const downloadEnabled = raw.downloadEnabled ?? raw.canDownload ?? permission !== "VIEW_ONLY";
  const title = raw.title || raw.name || "Shared Drive";
  const visibility = normalizeVisibility(raw);

  return {
    id: raw.id || crypto.randomUUID(),
    token: raw.token || crypto.randomBytes(24).toString("hex"),
    title,
    name: title,
    rootPath: normalizeDrivePath(raw.rootPath || ""),
    ownerUserId: raw.ownerUserId || "admin",
    permission,
    visibility,
    accessMode: visibility,
    allowedEmails: uniqueEmails(raw.allowedEmails || []),
    invitedEmails: uniqueEmails(raw.invitedEmails || []),
    expiresAt: raw.expiresAt || null,
    passwordHash: raw.passwordHash || null,
    downloadEnabled,
    previewEnabled: raw.previewEnabled ?? true,
    canDownload: downloadEnabled,
    pinned: Boolean(raw.pinned),
    note: raw.note || "",
    disabledAt: raw.disabledAt || null,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || raw.createdAt || now,
    createdBy: "admin",
  };
}

export async function readShareLinks(): Promise<ShareLink[]> {
  await ensureDbDir();

  const raw = await fs
    .readFile(dbPath(), "utf8")
    .catch(() => fs.readFile(legacyDbPath(), "utf8").catch(() => "[]"));

  const data = JSON.parse(raw) as RawShareLink[];

  return Array.isArray(data) ? data.map(normalizeShare) : [];
}

export async function writeShareLinks(links: ShareLink[]) {
  await ensureDbDir();
  await fs.writeFile(dbPath(), JSON.stringify(links.map(normalizeShare), null, 2));
}

export async function createShareLink(input: {
  name?: string;
  title?: string;
  rootPath: string;
  canDownload?: boolean;
  downloadEnabled?: boolean;
  previewEnabled?: boolean;
  expiresAt: string | null;
  note?: string;
  visibility?: ShareVisibility;
  allowedEmails?: string[];
  permission?: SharePermission;
  ownerUserId?: string | "admin";
  pinned?: boolean;
}) {
  const links = await readShareLinks();
  const now = new Date().toISOString();

  const permission = normalizePermission(input.permission, input.canDownload);
  const visibility = normalizeShareVisibility(input.visibility);
  const rootPath = normalizeDrivePath(input.rootPath);
  const incomingEmails = uniqueEmails(input.allowedEmails || []);
  const title = (input.title || input.name || "Shared Drive").trim();

  /**
   * driveOne access-link rule:
   *
   * 1 rootPath + 1 visibility + 1 permission = 1 active access link.
   *
   * If an active link already exists for the same rootPath, visibility,
   * and permission, reuse that link and merge allowedEmails.
   *
   * Different permission / visibility may create another link.
   * Parent and child folders may each have their own access link.
   */
  const existingIndex = links.findIndex((candidate) => {
    if (candidate.disabledAt) return false;
    if (candidate.expiresAt && new Date(candidate.expiresAt).getTime() < Date.now()) return false;

    return (
      normalizeDrivePath(candidate.rootPath || "") === rootPath &&
      candidate.visibility === visibility &&
      candidate.permission === permission
    );
  });

  if (existingIndex !== -1) {
    const existing = links[existingIndex];

    const mergedAllowedEmails = uniqueEmails([
      ...(existing.allowedEmails || []),
      ...incomingEmails,
    ]);

    const downloadEnabled =
      input.downloadEnabled ??
      input.canDownload ??
      existing.downloadEnabled ??
      permission !== "VIEW_ONLY";

    links[existingIndex] = normalizeShare({
      ...existing,
      title: existing.title || title,
      name: existing.name || existing.title || title,
      rootPath,
      visibility,
      accessMode: visibility,
      permission,
      allowedEmails: mergedAllowedEmails,
      downloadEnabled,
      previewEnabled: input.previewEnabled ?? existing.previewEnabled ?? true,
      canDownload: downloadEnabled,
      expiresAt: input.expiresAt ?? existing.expiresAt,
      note: input.note?.trim() || existing.note || "",
      pinned: input.pinned ?? existing.pinned ?? false,
      updatedAt: now,
    });

    await writeShareLinks(links);

    return links[existingIndex];
  }

  const downloadEnabled = input.downloadEnabled ?? input.canDownload ?? permission !== "VIEW_ONLY";

  const link: ShareLink = {
    id: crypto.randomUUID(),
    token: crypto.randomBytes(24).toString("hex"),
    title,
    name: title,
    rootPath,
    ownerUserId: input.ownerUserId || "admin",
    permission,
    visibility,
    accessMode: visibility,
    allowedEmails: incomingEmails,
    invitedEmails: [],
    expiresAt: input.expiresAt,
    passwordHash: null,
    downloadEnabled,
    previewEnabled: input.previewEnabled ?? true,
    canDownload: downloadEnabled,
    pinned: Boolean(input.pinned),
    note: input.note?.trim() || "",
    disabledAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: "admin",
  };

  links.unshift(link);
  await writeShareLinks(links);

  return link;
}

export async function createOrReuseShareLink(input: Parameters<typeof createShareLink>[0]) {
  const links = await readShareLinks();
  const now = new Date().toISOString();
  const rootPath = normalizeDrivePath(input.rootPath);
  const permission = normalizePermission(input.permission, input.canDownload);
  const visibility = normalizeShareVisibility(input.visibility);
  const incomingEmails = uniqueEmails(input.allowedEmails || []);
  const existingIndex = links.findIndex((candidate) => {
    if (candidate.disabledAt) return false;
    if (candidate.expiresAt && new Date(candidate.expiresAt).getTime() < Date.now()) return false;
    return candidate.rootPath === rootPath && candidate.visibility === visibility && candidate.permission === permission;
  });

  if (existingIndex === -1) {
    const link = await createShareLink(input);
    return { link, reused: false, newEmails: link.allowedEmails };
  }

  const existing = links[existingIndex];
  const allowedEmails = uniqueEmails([...(existing.allowedEmails || []), ...incomingEmails]);
  const newEmails = incomingEmails.filter((email) => !existing.allowedEmails.includes(email));
  const title = (input.title || input.name || existing.title || existing.name).trim();
  const downloadEnabled = input.downloadEnabled ?? input.canDownload ?? permission !== "VIEW_ONLY";

  links[existingIndex] = normalizeShare({
    ...existing,
    title,
    name: title,
    visibility,
    accessMode: visibility,
    note: input.note?.trim() || existing.note || "",
    expiresAt: input.expiresAt === undefined ? existing.expiresAt : input.expiresAt,
    allowedEmails,
    downloadEnabled,
    canDownload: downloadEnabled,
    previewEnabled: input.previewEnabled ?? existing.previewEnabled,
    ownerUserId: input.ownerUserId || existing.ownerUserId,
    updatedAt: now,
  });

  await writeShareLinks(links);
  return { link: links[existingIndex], reused: true, newEmails };
}

export async function updateShareLink(token: string, patch: Partial<ShareLink>) {
  const links = await readShareLinks();
  const index = links.findIndex((candidate) => candidate.token === token);

  if (index === -1) return null;

  const nextPatch = {
    ...patch,
    accessMode: patch.visibility ? patch.visibility : patch.accessMode,
  };

  links[index] = normalizeShare({
    ...links[index],
    ...nextPatch,
    updatedAt: new Date().toISOString(),
  });

  await writeShareLinks(links);

  return links[index];
}

export async function getValidShareLink(token: string) {
  const links = await readShareLinks();
  const link = links.find((candidate) => candidate.token === token);

  if (!link) return null;
  if (link.disabledAt) return null;
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) return null;

  return link;
}

function isAdminOrOwner(share: ShareLink, user: SessionUser | null) {
  if (!user) return false;
  return user.role === "ADMIN" || share.ownerUserId === user.id;
}

/**
 * driveOne share rule:
 *
 * PUBLIC:
 * - Guest can open when no passwordHash is set.
 * - allowedEmails is preserved but ignored for guest access.
 *
 * PUBLIC_LOGIN:
 * - Requires login.
 * - If allowedEmails exists, logged-in user's email must match.
 * - If allowedEmails is empty, any logged-in user can open.
 *
 * PRIVATE:
 * - Only admin or share owner can open.
 */
export function canUserAccessShare(share: ShareLink, user: SessionUser | null) {
  if (isAdminOrOwner(share, user)) return true;

  if (share.visibility === "PUBLIC") {
    return !share.passwordHash;
  }

  if (share.visibility === "PRIVATE") {
    return false;
  }

  if (!user?.email) {
    return false;
  }

  if (share.allowedEmails.length === 0) {
    return true;
  }

  return share.allowedEmails.includes(normalizeEmail(user.email));
}

export function getShareAccessReason(share: ShareLink, user: SessionUser | null) {
  if (isAdminOrOwner(share, user)) {
    return "ALLOWED";
  }

  if (share.visibility === "PUBLIC") {
    return share.passwordHash ? "PASSWORD_REQUIRED" : "ALLOWED";
  }

  if (share.visibility === "PRIVATE") {
    return "PRIVATE";
  }

  if (!user?.email) {
    return "LOGIN_REQUIRED";
  }

  if (share.allowedEmails.length === 0) {
    return "ALLOWED";
  }

  if (!share.allowedEmails.includes(normalizeEmail(user.email))) {
    return "EMAIL_NOT_ALLOWED";
  }

  return "ALLOWED";
}

export async function revokeShareLink(token: string) {
  const links = await readShareLinks();
  const index = links.findIndex((candidate) => candidate.token === token);

  if (index === -1) return 0;

  links[index] = {
    ...links[index],
    disabledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeShareLinks(links);

  return 1;
}
