import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { getCacheRoot } from "./preview-cache";
import { assertSafeName, normalizeDrivePath } from "./safe-path";

export type ChunkUploadSession = {
  uploadId: string;
  ownerUserId: string;
  ownerEmail: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  currentPath: string;
  relativePath: string;
  totalChunks: number;
  chunkSize: number;
  createdAt: string;
};

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CHUNK_SIZE = 25 * 1024 * 1024;
const UNSAFE_NAME_PATTERN = /[\x00-\x1f\x7f<>:"|?*]/;

export function chunkUploadRoot() {
  return path.join(/*turbopackIgnore: true*/ getCacheRoot(), "chunk-uploads");
}

export function createUploadId() {
  return crypto.randomBytes(24).toString("hex");
}

export function assertUploadId(value: unknown) {
  const uploadId = typeof value === "string" ? value : "";
  if (!/^[a-f0-9]{48}$/.test(uploadId)) throw new Error("Invalid upload id");
  return uploadId;
}

export function chunkUploadSessionDir(uploadId: string) {
  return path.join(/*turbopackIgnore: true*/ chunkUploadRoot(), assertUploadId(uploadId));
}

function sessionPath(uploadId: string) {
  return path.join(/*turbopackIgnore: true*/ chunkUploadSessionDir(uploadId), "session.json");
}

export function chunkPath(uploadId: string, chunkIndex: number) {
  return path.join(
    /*turbopackIgnore: true*/ chunkUploadSessionDir(uploadId),
    `chunk-${String(chunkIndex).padStart(6, "0")}.part`
  );
}

function assertNoDangerousNameChars(name: string) {
  if (UNSAFE_NAME_PATTERN.test(name)) throw new Error("Invalid name");
  return name;
}

export function validateChunkUploadPath(value: unknown) {
  const normalized = normalizeDrivePath(typeof value === "string" ? value : "");
  for (const segment of normalized.split("/").filter(Boolean)) {
    assertNoDangerousNameChars(assertSafeName(segment));
  }
  return normalized;
}

export function validateChunkUploadFileName(value: unknown) {
  const fileName = assertNoDangerousNameChars(assertSafeName(typeof value === "string" ? value : ""));
  return fileName;
}

export function validateChunkUploadNumbers(input: {
  fileSize: unknown;
  totalChunks: unknown;
  chunkSize: unknown;
}) {
  const fileSize = Number(input.fileSize);
  const totalChunks = Number(input.totalChunks);
  const chunkSize = Number(input.chunkSize);

  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) throw new Error("Invalid file size");
  if (!Number.isSafeInteger(totalChunks) || totalChunks <= 0) throw new Error("Invalid total chunks");
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0 || chunkSize > MAX_CHUNK_SIZE) {
    throw new Error("Invalid chunk size");
  }
  if (Math.ceil(fileSize / chunkSize) !== totalChunks) throw new Error("Invalid chunk count");

  return { fileSize, totalChunks, chunkSize };
}

export async function ensureChunkUploadRoot() {
  await fs.mkdir(chunkUploadRoot(), { recursive: true });
}

export async function cleanupStaleChunkUploads() {
  await ensureChunkUploadRoot();
  const entries = await fs.readdir(chunkUploadRoot(), { withFileTypes: true }).catch(() => []);
  const cutoff = Date.now() - SESSION_TTL_MS;

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && /^[a-f0-9]{48}$/.test(entry.name))
      .map(async (entry) => {
        const uploadId = entry.name;
        const metadata = await readChunkUploadSession(uploadId).catch(() => null);
        const createdAt = metadata ? Date.parse(metadata.createdAt) : 0;
        if (!createdAt || createdAt >= cutoff) return;
        await fs.rm(chunkUploadSessionDir(uploadId), { recursive: true, force: true });
      })
  );
}

export async function writeChunkUploadSession(session: ChunkUploadSession) {
  const dir = chunkUploadSessionDir(session.uploadId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(sessionPath(session.uploadId), JSON.stringify(session, null, 2));
}

export async function readChunkUploadSession(uploadId: string) {
  const raw = await fs.readFile(sessionPath(uploadId), "utf8");
  const parsed = JSON.parse(raw) as ChunkUploadSession;
  if (parsed.uploadId !== uploadId) throw new Error("Invalid upload session");
  return parsed;
}

export function assertChunkUploadOwner(session: ChunkUploadSession, userId: string) {
  if (session.ownerUserId !== userId) throw new Error("Upload session not found");
}

export function validateChunkIndex(value: unknown, totalChunks: number) {
  const chunkIndex = Number(value);
  if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
    throw new Error("Invalid chunk index");
  }
  return chunkIndex;
}

export function expectedChunkSize(session: ChunkUploadSession, chunkIndex: number) {
  if (chunkIndex < session.totalChunks - 1) return session.chunkSize;
  const remainder = session.fileSize % session.chunkSize;
  return remainder || session.chunkSize;
}

export async function removeChunkUploadSession(uploadId: string) {
  await fs.rm(chunkUploadSessionDir(uploadId), { recursive: true, force: true });
}
