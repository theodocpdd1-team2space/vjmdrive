import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { getCacheRoot } from "./preview-cache";
import { normalizeDrivePath } from "./safe-path";
import { normalizeEmail, type SessionUser } from "./auth";

export type ClientSelectStatus = "WAITING_CLIENT" | "VIEWED" | "SUBMITTED" | "LOCKED";

export type ClientSelectLink = {
  id: string;
  token: string;
  ownerUserId: string | "admin";
  projectName: string;
  clientName: string;
  clientEmail: string;
  rootPath: string;
  maxSelectedPhotos: number | null;
  allowOriginalDownload: boolean;
  allowEditAfterSubmit: boolean;
  expiresAt: string | null;
  status: ClientSelectStatus;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  viewedAt?: string | null;
  submittedAt?: string | null;
  selectedFolderPath?: string | null;
  selectedFolderCopiedCount?: number;
  selectedFolderSkippedCount?: number;
  selectedFolderErrors?: string[];
  selectedFolderCreatedAt?: string | null;
};

export type ClientSelectSelectedFile = {
  path: string;
  filename: string;
  note: string;
};

export type ClientSelectSubmission = {
  id: string;
  linkId: string;
  token: string;
  selectedFiles: ClientSelectSelectedFile[];
  selectedFilePaths: string[];
  selectedFilenames: string[];
  clientName: string;
  clientEmail: string;
  globalNote: string;
  submittedAt: string;
  updatedAt?: string | null;
  emailSentAt?: string | null;
  emailError?: string | null;
  status: "SUBMITTED";
};

type RawClientSelectLink = Partial<ClientSelectLink> & {
  title?: string;
  maxSelected?: number | null;
};

function linksPath() {
  return path.join(getCacheRoot(), "db", "selection-links.json");
}

function submissionsPath() {
  return path.join(getCacheRoot(), "db", "selection-submissions.json");
}

async function ensureDbDir() {
  await fs.mkdir(path.dirname(linksPath()), { recursive: true });
}

async function ensureJsonFile(filePath: string) {
  await ensureDbDir();
  try {
    const stat = await fs.stat(filePath);
    if (stat.size === 0) {
      console.warn(`[client-select-db] Empty metadata file, using default []: ${path.basename(filePath)}`);
      return [];
    }
    return null;
  } catch (caught) {
    const code = caught && typeof caught === "object" && "code" in caught ? (caught as { code?: string }).code : "";
    if (code !== "ENOENT") throw caught;
    await atomicWriteJson(filePath, []);
    return [];
  }
}

async function readJsonArray<T>(filePath: string, label: string): Promise<T[]> {
  const fallback = await ensureJsonFile(filePath);
  if (fallback) return fallback;

  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) {
      console.warn(`[client-select-db] Empty metadata file, using default []: ${label}`);
      return [];
    }
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) {
      console.warn(`[client-select-db] Metadata is not an array, using default []: ${label}`);
      return [];
    }
    return data as T[];
  } catch (caught) {
    console.warn(`[client-select-db] Failed to read ${label}, using default [].`, caught);
    return [];
  }
}

async function atomicWriteJson(filePath: string, value: unknown) {
  await ensureDbDir();
  const tmpPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(value, null, 2));
  await fs.rename(tmpPath, filePath);
}

function cleanText(value: unknown, fallback = "", limit = 180) {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/\s+/g, " ").trim().slice(0, limit);
  return clean || fallback;
}

function cleanEmail(value: unknown) {
  if (typeof value !== "string") return "";
  const clean = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : "";
}

function normalizeStatus(value: unknown): ClientSelectStatus {
  if (value === "VIEWED" || value === "SUBMITTED" || value === "LOCKED") return value;
  return "WAITING_CLIENT";
}

function normalizeMaxSelected(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return null;
  return Math.floor(numberValue);
}

function normalizeLink(raw: RawClientSelectLink): ClientSelectLink {
  const now = new Date().toISOString();
  const projectName = cleanText(raw.projectName || raw.title, "Client Select", 160);

  return {
    id: raw.id || crypto.randomUUID(),
    token: raw.token || crypto.randomBytes(24).toString("hex"),
    ownerUserId: raw.ownerUserId || "admin",
    projectName,
    clientName: cleanText(raw.clientName, "", 120),
    clientEmail: cleanEmail(raw.clientEmail),
    rootPath: normalizeDrivePath(raw.rootPath || ""),
    maxSelectedPhotos: normalizeMaxSelected(raw.maxSelectedPhotos ?? raw.maxSelected),
    allowOriginalDownload: Boolean(raw.allowOriginalDownload),
    allowEditAfterSubmit: Boolean(raw.allowEditAfterSubmit),
    expiresAt: typeof raw.expiresAt === "string" && raw.expiresAt ? raw.expiresAt : null,
    status: normalizeStatus(raw.status),
    isActive: raw.isActive !== false,
    deletedAt: raw.deletedAt || null,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || raw.createdAt || now,
    viewedAt: raw.viewedAt || null,
    submittedAt: raw.submittedAt || null,
    selectedFolderPath: raw.selectedFolderPath ? normalizeDrivePath(raw.selectedFolderPath) : null,
    selectedFolderCopiedCount: Number.isFinite(raw.selectedFolderCopiedCount) ? Number(raw.selectedFolderCopiedCount) : 0,
    selectedFolderSkippedCount: Number.isFinite(raw.selectedFolderSkippedCount) ? Number(raw.selectedFolderSkippedCount) : 0,
    selectedFolderErrors: Array.isArray(raw.selectedFolderErrors)
      ? raw.selectedFolderErrors.filter((item): item is string => typeof item === "string").slice(0, 50)
      : [],
    selectedFolderCreatedAt: raw.selectedFolderCreatedAt || null,
  };
}

function normalizeSelectedFiles(raw: Partial<ClientSelectSubmission>) {
  if (Array.isArray(raw.selectedFiles)) {
    return (raw.selectedFiles as unknown[])
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => {
        const safePath = normalizeDrivePath(typeof item.path === "string" ? item.path : "");
        return {
          path: safePath,
          filename: cleanText(item.filename, path.posix.basename(safePath), 240),
          note: typeof item.note === "string" ? item.note.trim().slice(0, 2000) : "",
        };
      })
      .filter((item) => item.path);
  }

  const paths = Array.isArray(raw.selectedFilePaths)
    ? raw.selectedFilePaths.filter((item): item is string => typeof item === "string").map((item) => normalizeDrivePath(item))
    : [];
  const filenames = Array.isArray(raw.selectedFilenames)
    ? raw.selectedFilenames.filter((item): item is string => typeof item === "string")
    : [];

  return paths.filter(Boolean).map((filePath, index) => ({
    path: filePath,
    filename: cleanText(filenames[index], path.posix.basename(filePath), 240),
    note: "",
  }));
}

function normalizeSubmission(raw: Partial<ClientSelectSubmission>): ClientSelectSubmission {
  const submittedAt = raw.submittedAt || new Date().toISOString();
  const selectedFiles = normalizeSelectedFiles(raw);
  const selectedFilePaths = selectedFiles.map((item) => item.path);
  const selectedFilenames = selectedFiles.map((item) => item.filename);

  return {
    id: raw.id || crypto.randomUUID(),
    linkId: raw.linkId || "",
    token: raw.token || "",
    selectedFiles,
    selectedFilePaths,
    selectedFilenames,
    clientName: cleanText(raw.clientName, "", 120),
    clientEmail: cleanEmail(raw.clientEmail),
    globalNote: typeof raw.globalNote === "string" ? raw.globalNote.trim().slice(0, 4000) : "",
    submittedAt,
    updatedAt: raw.updatedAt || null,
    emailSentAt: raw.emailSentAt || null,
    emailError: typeof raw.emailError === "string" ? raw.emailError.trim().slice(0, 1000) : null,
    status: "SUBMITTED",
  };
}

export function isClientSelectExpired(link: Pick<ClientSelectLink, "expiresAt">, now = Date.now()) {
  return Boolean(link.expiresAt && new Date(link.expiresAt).getTime() < now);
}

export function getClientSelectDisplayStatus(link: ClientSelectLink, now = Date.now()): ClientSelectStatus | "EXPIRED" {
  if (!link.isActive || link.status === "LOCKED") return "LOCKED";
  if (isClientSelectExpired(link, now)) return "EXPIRED";
  return link.status;
}

export async function readClientSelectLinks(): Promise<ClientSelectLink[]> {
  const data = await readJsonArray<RawClientSelectLink>(linksPath(), "selection-links.json");
  return Array.isArray(data) ? data.map(normalizeLink) : [];
}

export async function writeClientSelectLinks(links: ClientSelectLink[]) {
  await atomicWriteJson(linksPath(), links.map(normalizeLink));
}

export async function readClientSelectSubmissions(): Promise<ClientSelectSubmission[]> {
  const data = await readJsonArray<Partial<ClientSelectSubmission>>(submissionsPath(), "selection-submissions.json");
  return Array.isArray(data) ? data.map(normalizeSubmission).filter((item) => item.linkId && item.token) : [];
}

export async function writeClientSelectSubmissions(submissions: ClientSelectSubmission[]) {
  await atomicWriteJson(submissionsPath(), submissions.map(normalizeSubmission));
}

export async function createClientSelectLink(input: {
  ownerUserId: string | "admin";
  projectName: string;
  clientName?: string;
  clientEmail?: string;
  rootPath: string;
  maxSelectedPhotos?: number | null;
  allowOriginalDownload?: boolean;
  allowEditAfterSubmit?: boolean;
  expiresAt?: string | null;
}) {
  const links = await readClientSelectLinks();
  const now = new Date().toISOString();
  const link = normalizeLink({
    id: crypto.randomUUID(),
    token: crypto.randomBytes(24).toString("hex"),
    ownerUserId: input.ownerUserId,
    projectName: input.projectName,
    clientName: input.clientName || "",
    clientEmail: input.clientEmail || "",
    rootPath: input.rootPath,
    maxSelectedPhotos: input.maxSelectedPhotos ?? null,
    allowOriginalDownload: Boolean(input.allowOriginalDownload),
    allowEditAfterSubmit: Boolean(input.allowEditAfterSubmit),
    expiresAt: input.expiresAt || null,
    status: "WAITING_CLIENT",
    isActive: true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  links.unshift(link);
  await writeClientSelectLinks(links);
  return link;
}

export async function getClientSelectLinkByToken(token: string) {
  const links = await readClientSelectLinks();
  return links.find((link) => link.token === token) || null;
}

export async function getValidClientSelectLink(token: string) {
  const link = await getClientSelectLinkByToken(token);
  if (!link || !link.isActive || link.deletedAt) return null;
  if (isClientSelectExpired(link)) return null;
  return link;
}

export async function getClientSelectLinksByOwner(ownerUserId: string) {
  const links = await readClientSelectLinks();
  return links.filter((link) => link.ownerUserId === ownerUserId && !link.deletedAt);
}

export async function getClientSelectLinkForUser(id: string, user: SessionUser) {
  const links = await readClientSelectLinks();
  const link = links.find((candidate) => candidate.id === id && !candidate.deletedAt) || null;
  if (!link) return null;
  if (user.role !== "ADMIN" && link.ownerUserId !== user.id) return null;
  return link;
}

export async function updateClientSelectLink(id: string, patch: Partial<ClientSelectLink>) {
  const links = await readClientSelectLinks();
  const index = links.findIndex((link) => link.id === id);
  if (index === -1) return null;

  links[index] = normalizeLink({
    ...links[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  await writeClientSelectLinks(links);
  return links[index];
}

export async function markClientSelectViewed(token: string) {
  const links = await readClientSelectLinks();
  const index = links.findIndex((link) => link.token === token);
  if (index === -1) return null;
  if (links[index].status !== "WAITING_CLIENT") return links[index];

  links[index] = normalizeLink({
    ...links[index],
    status: "VIEWED",
    viewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await writeClientSelectLinks(links);
  return links[index];
}

export async function createClientSelectSubmission(input: {
  link: ClientSelectLink;
  selectedFiles: ClientSelectSelectedFile[];
  clientName?: string;
  clientEmail?: string;
  globalNote?: string;
}) {
  if ((input.link.status === "SUBMITTED" && !input.link.allowEditAfterSubmit) || input.link.status === "LOCKED") {
    throw new Error("Selection has already been submitted.");
  }

  const submissions = await readClientSelectSubmissions();
  const submittedAt = new Date().toISOString();
  const existingIndex = submissions.findIndex((submission) => submission.linkId === input.link.id);
  const submission = normalizeSubmission({
    id: existingIndex === -1 ? crypto.randomUUID() : submissions[existingIndex].id,
    linkId: input.link.id,
    token: input.link.token,
    selectedFiles: input.selectedFiles,
    clientName: input.clientName || input.link.clientName,
    clientEmail: input.clientEmail || input.link.clientEmail,
    globalNote: input.globalNote || "",
    submittedAt: existingIndex === -1 ? submittedAt : submissions[existingIndex].submittedAt,
    updatedAt: existingIndex === -1 ? null : submittedAt,
    emailSentAt: existingIndex === -1 ? null : submissions[existingIndex].emailSentAt,
    emailError: existingIndex === -1 ? null : submissions[existingIndex].emailError,
    status: "SUBMITTED",
  });

  if (existingIndex === -1) submissions.unshift(submission);
  else submissions[existingIndex] = submission;
  await writeClientSelectSubmissions(submissions);
  await updateClientSelectLink(input.link.id, {
    status: "SUBMITTED",
    submittedAt: existingIndex === -1 ? submittedAt : input.link.submittedAt || submittedAt,
  });
  return submission;
}

export async function updateClientSelectSubmission(
  submissionId: string,
  patch: Partial<Pick<ClientSelectSubmission, "emailSentAt" | "emailError">>
) {
  const submissions = await readClientSelectSubmissions();
  const index = submissions.findIndex((submission) => submission.id === submissionId);
  if (index === -1) return null;

  submissions[index] = normalizeSubmission({
    ...submissions[index],
    ...patch,
  });
  await writeClientSelectSubmissions(submissions);
  return submissions[index];
}

export async function getLatestClientSelectSubmission(linkId: string) {
  const submissions = await readClientSelectSubmissions();
  return submissions
    .filter((submission) => submission.linkId === linkId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0] || null;
}

export async function getClientSelectSubmissionsByLink(linkId: string) {
  const submissions = await readClientSelectSubmissions();
  return submissions
    .filter((submission) => submission.linkId === linkId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
