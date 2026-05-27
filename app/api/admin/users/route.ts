import { NextResponse } from "next/server";
import { DEFAULT_USER_QUOTA_BYTES, createUser, isAdmin, normalizeEmail, readUsers, updateUser, userStoragePath, type UserPlan, type UserRole } from "@/lib/auth";
import { directorySize, storageSummary } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RawUser = Record<string, unknown>;

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

function quotaFromUser(user: RawUser) {
  const value = user.quotaBytes ?? user.storageLimitBytes ?? user.storageLimit ?? user.quota;
  if (value === null || value === "unlimited" || value === "Unlimited") return null;
  const quota = safeNumber(value, DEFAULT_USER_QUOTA_BYTES);
  return quota >= 0 ? quota : DEFAULT_USER_QUOTA_BYTES;
}

async function adminUserResponse(user: RawUser, index = 0) {
  const id = safeText(user.id, safeText(user.email, `user-${index + 1}`));
  const role: UserRole = user.role === "ADMIN" ? "ADMIN" : "USER";
  const quotaBytes = quotaFromUser(user);
  const storageRoot = safeText(user.id) ? userStoragePath(safeText(user.id)) : "";
  const usedBytes = storageRoot ? await directorySize(storageRoot).catch(() => 0) : 0;

  return {
    id,
    name: safeText(user.name, safeText(user.username, safeText(user.email, "Unnamed user"))),
    username: safeText(user.username),
    email: safeText(user.email, ""),
    role,
    plan: safeText(user.plan ?? user.planName ?? user.subscriptionPlan, role === "ADMIN" ? "Custom" : "Free"),
    quotaBytes,
    storageUsedBytes: usedBytes,
    storageLimitBytes: quotaBytes,
    storage: storageSummary(usedBytes, quotaBytes),
    emailVerified: Boolean(user.emailVerified),
    disabled: Boolean(user.disabled),
    lastLoginAt: typeof user.lastLoginAt === "string" ? user.lastLoginAt : null,
    createdAt: safeText(user.createdAt ?? user.created_at, "-"),
    updatedAt: safeText(user.updatedAt ?? user.updated_at, "-"),
  };
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const rawUsers = await readUsers();
  const users = await Promise.all(rawUsers.map((user, index) => adminUserResponse(user as unknown as RawUser, index)));
  return NextResponse.json({ ok: true, users });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const hasQuotaBytes = Boolean(body && typeof body === "object" && "quotaBytes" in body);
  const quotaBytes = hasQuotaBytes ? (body?.quotaBytes === null ? null : Number(body?.quotaBytes)) : undefined;
  const allowedPlans: UserPlan[] = ["Free", "Personal", "Pro", "Vendor", "Business", "Custom"];
  const plan = allowedPlans.includes(body?.plan) ? (body.plan as UserPlan) : undefined;
  const disabled = typeof body?.disabled === "boolean" ? body.disabled : undefined;
  const emailVerified = typeof body?.emailVerified === "boolean" ? body.emailVerified : undefined;
  if (!userId || (hasQuotaBytes && quotaBytes !== null && quotaBytes !== undefined && (!Number.isFinite(quotaBytes) || quotaBytes < 0))) {
    return NextResponse.json({ ok: false, message: "Invalid quota." }, { status: 400 });
  }
  const patch: Parameters<typeof updateUser>[1] = {};
  if (hasQuotaBytes) patch.quotaBytes = quotaBytes ?? null;
  if (plan) patch.plan = plan;
  if (disabled !== undefined) patch.disabled = disabled;
  if (emailVerified !== undefined) patch.emailVerified = emailVerified;
  const user = await updateUser(userId, patch);
  return NextResponse.json({ ok: true, user: user ? await adminUserResponse(user as unknown as RawUser) : null });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role: UserRole = body?.role === "ADMIN" ? "ADMIN" : "USER";
  const allowedPlans: UserPlan[] = ["Free", "Personal", "Pro", "Vendor", "Business", "Custom"];
  const plan = allowedPlans.includes(body?.plan) ? (body.plan as UserPlan) : "Free";
  const quotaBytes = body?.quotaBytes === null ? null : body?.quotaBytes === undefined ? undefined : Number(body.quotaBytes);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, message: "Valid email is required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, message: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (quotaBytes !== undefined && quotaBytes !== null && (!Number.isFinite(quotaBytes) || quotaBytes < 0)) {
    return NextResponse.json({ ok: false, message: "Invalid quota." }, { status: 400 });
  }

  try {
    const user = await createUser({
      name: email,
      email,
      password,
      role,
      quotaBytes: quotaBytes === undefined ? undefined : quotaBytes,
      emailVerified: true,
    });
    const updated = await updateUser(user.id, { plan, quotaBytes: quotaBytes === undefined ? user.quotaBytes : quotaBytes });
    return NextResponse.json({ ok: true, user: await adminUserResponse((updated || user) as unknown as RawUser) });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Create user failed." },
      { status: 400 }
    );
  }
}
