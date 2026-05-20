import fs from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getCacheRoot } from "./preview-cache";
import { getAssetRoot } from "./safe-path";

export const AUTH_COOKIE = "vjm_drive_auth";
export const ADMIN_COOKIE = "vjm_drive_admin";
export const SESSION_COOKIE = "vjm_drive_session";
export const DEFAULT_USER_QUOTA_BYTES = 1024 * 1024 * 1024;

export type UserRole = "ADMIN" | "USER";

export type DriveUser = {
  id: string;
  name: string;
  username?: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  quotaBytes: number | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SessionUser = Pick<DriveUser, "id" | "name" | "email" | "role" | "emailVerified">;

function usersPath() {
  return path.join(getCacheRoot(), "db", "users.json");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getAppUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || process.env.DRIVE_PASSWORD;
  if (secret) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV === "production") {
    console.warn("[auth] SESSION_SECRET missing in production");
  }
  return new TextEncoder().encode("vjm-drive-dev-session-secret-change-me");
}

async function ensureDbDir() {
  await fs.mkdir(path.dirname(usersPath()), { recursive: true });
}

export async function readUsers(): Promise<DriveUser[]> {
  await ensureDbDir();
  const raw = await fs.readFile(usersPath(), "utf8").catch(() => "[]");
  const data = JSON.parse(raw) as DriveUser[];
  return Array.isArray(data) ? data : [];
}

export async function writeUsers(users: DriveUser[]) {
  await ensureDbDir();
  await fs.writeFile(usersPath(), JSON.stringify(users, null, 2));
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function findUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  const users = await readUsers();
  return users.find((user) => normalizeEmail(user.email) === normalized) || null;
}

export async function findUserById(id: string) {
  const users = await readUsers();
  return users.find((user) => user.id === id) || null;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  quotaBytes?: number | null;
  emailVerified?: boolean;
  username?: string;
}) {
  const users = await readUsers();
  const email = normalizeEmail(input.email);
  if (users.some((user) => normalizeEmail(user.email) === email)) {
    throw new Error("Email already exists");
  }

  const now = new Date().toISOString();
  const user: DriveUser = {
    id: crypto.randomUUID(),
    name: input.name.trim() || email,
    username: input.username,
    email,
    passwordHash: await hashPassword(input.password),
    role: input.role || "USER",
    quotaBytes: input.quotaBytes === undefined ? DEFAULT_USER_QUOTA_BYTES : input.quotaBytes,
    emailVerified: Boolean(input.emailVerified),
    createdAt: now,
    updatedAt: now,
  };

  users.push(user);
  await writeUsers(users);
  await ensureUserStorage(user.id);
  return user;
}

export async function updateUser(userId: string, patch: Partial<Omit<DriveUser, "id" | "createdAt">>) {
  const users = await readUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) return null;

  users[index] = {
    ...users[index],
    ...patch,
    email: patch.email ? normalizeEmail(patch.email) : users[index].email,
    updatedAt: new Date().toISOString(),
  };
  await writeUsers(users);
  return users[index];
}

export function userStorageRelativePath(userId: string) {
  return path.posix.join("__users", userId);
}

export function userStoragePath(userId: string) {
  return path.join(getAssetRoot(), "__users", userId);
}

export async function ensureUserStorage(userId: string) {
  await fs.mkdir(userStoragePath(userId), { recursive: true });
}

export async function ensureAdminUser() {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || "admin@vjmrtim.local");
  const adminPassword = process.env.ADMIN_PASSWORD || "mazmur91";
  const users = await readUsers();
  const now = new Date().toISOString();
  const existingIndex = users.findIndex((user) => normalizeEmail(user.email) === adminEmail || user.role === "ADMIN");
  const passwordHash = await hashPassword(adminPassword);

  if (existingIndex >= 0) {
    users[existingIndex] = {
      ...users[existingIndex],
      name: users[existingIndex].name || "Admin",
      username: users[existingIndex].username || "admin",
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      quotaBytes: null,
      emailVerified: true,
      updatedAt: now,
    };
    await writeUsers(users);
    await ensureUserStorage(users[existingIndex].id);
    return users[existingIndex];
  }

  const admin: DriveUser = {
    id: crypto.randomUUID(),
    name: "Admin",
    username: "admin",
    email: adminEmail,
    passwordHash,
    role: "ADMIN",
    quotaBytes: null,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  };
  users.unshift(admin);
  await writeUsers(users);
  await ensureUserStorage(admin.id);
  return admin;
}

export async function createSessionToken(user: DriveUser) {
  return new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(sessionSecret());
}

export function setSessionCookies(response: Response, token: string, role: UserRole) {
  const nextResponse = response as Response & {
    cookies?: {
      set: (name: string, value: string, options: Record<string, unknown>) => void;
    };
  };
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  nextResponse.cookies?.set(SESSION_COOKIE, token, cookieOptions);
  if (role === "ADMIN") {
    nextResponse.cookies?.set(ADMIN_COOKIE, "yes", cookieOptions);
    nextResponse.cookies?.set(AUTH_COOKIE, "yes", cookieOptions);
  }
}

export function clearSessionCookies(response: Response) {
  const nextResponse = response as Response & {
    cookies?: {
      set: (name: string, value: string, options: Record<string, unknown>) => void;
    };
  };
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
  nextResponse.cookies?.set(SESSION_COOKIE, "", cookieOptions);
  nextResponse.cookies?.set(ADMIN_COOKIE, "", cookieOptions);
  nextResponse.cookies?.set(AUTH_COOKIE, "", cookieOptions);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    try {
      const verified = await jwtVerify(token, sessionSecret());
      const payload = verified.payload as Partial<SessionUser>;
      if (payload.id && payload.email && payload.role) {
        const user = await findUserById(payload.id);
        if (user) {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            emailVerified: user.emailVerified,
          };
        }
      }
    } catch {
      return null;
    }
  }

  if (
    cookieStore.get(ADMIN_COOKIE)?.value === "yes" ||
    cookieStore.get(AUTH_COOKIE)?.value === "yes"
  ) {
    const admin = await ensureAdminUser();
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: "ADMIN",
      emailVerified: true,
    };
  }

  return null;
}

export async function isAuthed() {
  return Boolean(await getCurrentUser());
}

export async function isAdmin() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN";
}

export async function requireAdminUser() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") throw new Error("Admin access required");
  return user;
}

export async function authenticateUser(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) return { ok: false as const, message: "Email atau password salah." };
  if (!(await verifyPassword(password, user.passwordHash))) {
    return { ok: false as const, message: "Email atau password salah." };
  }
  if (!user.emailVerified) {
    return { ok: false as const, message: "Please verify your email first.", code: "EMAIL_NOT_VERIFIED" };
  }
  return { ok: true as const, user };
}
