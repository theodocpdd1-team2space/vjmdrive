import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { getCacheRoot } from "./preview-cache";
import { normalizeDrivePath } from "./safe-path";

export type ShareLink = {
  token: string;
  name: string;
  rootPath: string;
  canDownload: boolean;
  expiresAt: string | null;
  createdAt: string;
  createdBy: "admin";
};

function dbPath() {
  return path.join(getCacheRoot(), "db", "share-links.json");
}

async function ensureDbDir() {
  await fs.mkdir(path.dirname(dbPath()), { recursive: true });
}

export async function readShareLinks(): Promise<ShareLink[]> {
  await ensureDbDir();
  const raw = await fs.readFile(dbPath(), "utf8").catch(() => "[]");
  const data = JSON.parse(raw) as ShareLink[];
  return Array.isArray(data) ? data : [];
}

export async function writeShareLinks(links: ShareLink[]) {
  await ensureDbDir();
  await fs.writeFile(dbPath(), JSON.stringify(links, null, 2));
}

export async function createShareLink(input: {
  name: string;
  rootPath: string;
  canDownload: boolean;
  expiresAt: string | null;
}) {
  const links = await readShareLinks();
  const token = crypto.randomBytes(18).toString("base64url");
  const link: ShareLink = {
    token,
    name: input.name.trim() || "Shared Folder",
    rootPath: normalizeDrivePath(input.rootPath),
    canDownload: input.canDownload,
    expiresAt: input.expiresAt,
    createdAt: new Date().toISOString(),
    createdBy: "admin",
  };

  links.unshift(link);
  await writeShareLinks(links);

  return link;
}

export async function getValidShareLink(token: string) {
  const links = await readShareLinks();
  const link = links.find((candidate) => candidate.token === token);

  if (!link) return null;
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) return null;

  return link;
}

export async function revokeShareLink(token: string) {
  const links = await readShareLinks();
  const next = links.filter((candidate) => candidate.token !== token);
  await writeShareLinks(next);
  return links.length - next.length;
}
