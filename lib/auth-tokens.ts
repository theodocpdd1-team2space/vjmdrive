import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { getCacheRoot } from "./preview-cache";

export type AuthTokenType = "VERIFY_EMAIL" | "RESET_PASSWORD";

export type AuthToken = {
  id: string;
  userId: string;
  email: string;
  type: AuthTokenType;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

function tokensPath() {
  return path.join(getCacheRoot(), "db", "auth-tokens.json");
}

async function ensureDbDir() {
  await fs.mkdir(path.dirname(tokensPath()), { recursive: true });
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function readAuthTokens(): Promise<AuthToken[]> {
  await ensureDbDir();
  const raw = await fs.readFile(tokensPath(), "utf8").catch(() => "[]");
  const data = JSON.parse(raw) as AuthToken[];
  return Array.isArray(data) ? data : [];
}

export async function writeAuthTokens(tokens: AuthToken[]) {
  await ensureDbDir();
  await fs.writeFile(tokensPath(), JSON.stringify(tokens, null, 2));
}

export async function cleanupAuthTokens() {
  const tokens = await readAuthTokens();
  const now = Date.now();
  const next = tokens.filter((token) => token.usedAt || new Date(token.expiresAt).getTime() > now);
  if (next.length !== tokens.length) await writeAuthTokens(next);
  return tokens.length - next.length;
}

export async function createAuthToken(input: {
  userId: string;
  email: string;
  type: AuthTokenType;
}) {
  await cleanupAuthTokens();
  const tokens = await readAuthTokens();
  const plainToken = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const ttlMs = input.type === "VERIFY_EMAIL" ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000;
  const record: AuthToken = {
    id: crypto.randomUUID(),
    userId: input.userId,
    email: input.email.toLowerCase(),
    type: input.type,
    tokenHash: hashToken(plainToken),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    usedAt: null,
    createdAt: now.toISOString(),
  };

  tokens.unshift(record);
  await writeAuthTokens(tokens);
  return { plainToken, record };
}

export async function consumeAuthToken(type: AuthTokenType, plainToken: string) {
  const tokenHash = hashToken(plainToken);
  const tokens = await readAuthTokens();
  const index = tokens.findIndex((token) => token.type === type && token.tokenHash === tokenHash);
  if (index === -1) return { ok: false as const, message: "Token tidak valid." };

  const record = tokens[index];
  if (record.usedAt) return { ok: false as const, message: "Token sudah dipakai." };
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    return { ok: false as const, message: "Token sudah kedaluwarsa." };
  }

  tokens[index] = { ...record, usedAt: new Date().toISOString() };
  await writeAuthTokens(tokens);
  return { ok: true as const, record: tokens[index] };
}
