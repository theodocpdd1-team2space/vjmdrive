import fs from "fs/promises";
import path from "path";
import { normalizeEmail, type SessionUser } from "./auth";
import { getCacheRoot } from "./preview-cache";
import { readShareLinks, updateShareLink, type ShareLink } from "./share-db";

export type ShareAccessRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ShareAccessRequest = {
  id: string;
  token: string;
  shareTitle: string;
  requesterUserId: string;
  requesterEmail: string;
  message: string;
  status: ShareAccessRequestStatus;
  createdAt: string;
  updatedAt: string;
};

function dbPath() {
  return path.join(getCacheRoot(), "db", "share-access-requests.json");
}

async function ensureDbDir() {
  await fs.mkdir(path.dirname(dbPath()), { recursive: true });
}

export async function readShareAccessRequests(): Promise<ShareAccessRequest[]> {
  await ensureDbDir();
  const raw = await fs.readFile(dbPath(), "utf8").catch(() => "[]");
  const parsed = JSON.parse(raw) as ShareAccessRequest[];
  return Array.isArray(parsed) ? parsed : [];
}

async function writeShareAccessRequests(requests: ShareAccessRequest[]) {
  await ensureDbDir();
  await fs.writeFile(dbPath(), JSON.stringify(requests, null, 2));
}

export async function createShareAccessRequest(input: {
  share: ShareLink;
  user: SessionUser;
  message?: string;
}) {
  const requests = await readShareAccessRequests();
  const requesterEmail = normalizeEmail(input.user.email);
  const now = new Date().toISOString();
  const existingIndex = requests.findIndex(
    (request) =>
      request.token === input.share.token &&
      normalizeEmail(request.requesterEmail) === requesterEmail &&
      request.status === "PENDING"
  );

  if (existingIndex >= 0) {
    requests[existingIndex] = {
      ...requests[existingIndex],
      message: input.message?.trim() || requests[existingIndex].message,
      updatedAt: now,
    };
    await writeShareAccessRequests(requests);
    return requests[existingIndex];
  }

  const request: ShareAccessRequest = {
    id: crypto.randomUUID(),
    token: input.share.token,
    shareTitle: input.share.title || input.share.name || "Shared Drive",
    requesterUserId: input.user.id,
    requesterEmail,
    message: input.message?.trim() || "",
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  };

  requests.unshift(request);
  await writeShareAccessRequests(requests);
  return request;
}

export async function updateShareAccessRequest(id: string, status: ShareAccessRequestStatus) {
  const requests = await readShareAccessRequests();
  const index = requests.findIndex((request) => request.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  requests[index] = {
    ...requests[index],
    status,
    updatedAt: now,
  };

  await writeShareAccessRequests(requests);
  return requests[index];
}

export async function approveShareAccessRequest(id: string) {
  const request = await updateShareAccessRequest(id, "APPROVED");
  if (!request) return null;

  const share = (await readShareLinks()).find((candidate) => candidate.token === request.token);
  if (!share) return { request, share: null };

  const email = normalizeEmail(request.requesterEmail);
  const allowedEmails = Array.from(new Set([...(share.allowedEmails || []), email]));

  const nextShare = await updateShareLink(share.token, {
    allowedEmails,
    visibility: "PUBLIC_LOGIN",
  });

  return { request, share: nextShare };
}
