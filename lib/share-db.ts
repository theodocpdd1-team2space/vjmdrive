import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { getCacheRoot } from "./preview-cache";
import { normalizeDrivePath } from "./safe-path";
import { normalizeEmail, type SessionUser } from "./auth";

export type SharePermission = "VIEW_ONLY" | "DOWNLOAD" | "UPLOAD" | "FULL";
export type ShareVisibility = "PUBLIC" | "PRIVATE_EMAILS";

export type ShareLink = {
  id: string;
  token: string;
  title: string;
  name: string;
  rootPath: string;
  ownerUserId: string | "admin";
  permission: SharePermission;
  visibility: ShareVisibility;
  allowedEmails: string[];
  invitedEmails: string[];
  expiresAt: string | null;
  passwordHash?: string | null;
  downloadEnabled: boolean;
  previewEnabled: boolean;
  canDownload: boolean;
  note?: string;
  disabledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: "admin";
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

function normalizePermission(
  permission?: SharePermission,
  canDownload?: boolean
): SharePermission {
  if (permission) return permission;
  return canDownload === false ? "VIEW_ONLY" : "DOWNLOAD";
}

function normalizeVisibility(visibility?: ShareVisibility): ShareVisibility {
  if (visibility === "PRIVATE_EMAILS") return "PRIVATE_EMAILS";
  return "PUBLIC";
}

function normalizeShare(raw: Partial<ShareLink> & { canDownload?: boolean }): ShareLink {
  const now = new Date().toISOString();

  const permission = normalizePermission(raw.permission, raw.canDownload);
  const downloadEnabled = raw.downloadEnabled ?? raw.canDownload ?? permission !== "VIEW_ONLY";
  const title = raw.title || raw.name || "Shared Drive";

  return {
    id: raw.id || crypto.randomUUID(),
    token: raw.token || crypto.randomBytes(24).toString("hex"),
    title,
    name: title,
    rootPath: normalizeDrivePath(raw.rootPath || ""),
    ownerUserId: raw.ownerUserId || "admin",
    permission,
    visibility: normalizeVisibility(raw.visibility),
    allowedEmails: uniqueEmails(raw.allowedEmails || []),
    invitedEmails: uniqueEmails(raw.invitedEmails || []),
    expiresAt: raw.expiresAt || null,
    passwordHash: raw.passwordHash || null,
    downloadEnabled,
    previewEnabled: raw.previewEnabled ?? true,
    canDownload: downloadEnabled,
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

  const data = JSON.parse(raw) as Array<Partial<ShareLink>>;
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
}) {
  const links = await readShareLinks();
  const now = new Date().toISOString();

  const permission = normalizePermission(input.permission, input.canDownload);
  const downloadEnabled = input.downloadEnabled ?? input.canDownload ?? permission !== "VIEW_ONLY";
  const title = (input.title || input.name || "Shared Drive").trim();

  const link: ShareLink = {
    id: crypto.randomUUID(),
    token: crypto.randomBytes(24).toString("hex"),
    title,
    name: title,
    rootPath: normalizeDrivePath(input.rootPath),
    ownerUserId: input.ownerUserId || "admin",
    permission,
    visibility: normalizeVisibility(input.visibility),
    allowedEmails: uniqueEmails(input.allowedEmails || []),
    invitedEmails: [],
    expiresAt: input.expiresAt,
    passwordHash: null,
    downloadEnabled,
    previewEnabled: input.previewEnabled ?? true,
    canDownload: downloadEnabled,
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

export async function updateShareLink(token: string, patch: Partial<ShareLink>) {
  const links = await readShareLinks();
  const index = links.findIndex((candidate) => candidate.token === token);

  if (index === -1) return null;

  links[index] = normalizeShare({
    ...links[index],
    ...patch,
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

/**
 * Final driveOne share rule:
 *
 * PUBLIC:
 * - Still requires login.
 * - Any logged-in user can open the share.
 *
 * PRIVATE_EMAILS:
 * - Requires login.
 * - Logged-in user's email must be in allowedEmails.
 *
 * Anonymous visitors must never access any share content.
 */
export function canUserAccessShare(share: ShareLink, user: SessionUser | null) {
  if (!user?.email) return false;

  if (share.visibility === "PUBLIC") {
    return true;
  }

  return share.allowedEmails.includes(normalizeEmail(user.email));
}

export function getShareAccessReason(share: ShareLink, user: SessionUser | null) {
  if (!user?.email) {
    return "LOGIN_REQUIRED";
  }

  if (share.visibility === "PUBLIC") {
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