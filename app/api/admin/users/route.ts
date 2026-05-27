import { NextResponse } from "next/server";
import { createUser, isAdmin, normalizeEmail, readUsers, updateUser, userStoragePath, type UserPlan, type UserRole } from "@/lib/auth";
import { directorySize, storageSummary } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const users = await Promise.all((await readUsers()).map(async (user) => ({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    plan: user.plan || (user.role === "ADMIN" ? "Custom" : "Free"),
    quotaBytes: user.quotaBytes,
    storage: storageSummary(await directorySize(userStoragePath(user.id)), user.quotaBytes),
    emailVerified: user.emailVerified,
    disabled: Boolean(user.disabled),
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  })));
  return NextResponse.json({ ok: true, users });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const quotaBytes = body?.quotaBytes === null ? null : Number(body?.quotaBytes);
  const allowedPlans: UserPlan[] = ["Free", "Personal", "Pro", "Vendor", "Business", "Custom"];
  const plan = allowedPlans.includes(body?.plan) ? (body.plan as UserPlan) : undefined;
  const disabled = typeof body?.disabled === "boolean" ? body.disabled : undefined;
  const emailVerified = typeof body?.emailVerified === "boolean" ? body.emailVerified : undefined;
  if (!userId || (quotaBytes !== null && (!Number.isFinite(quotaBytes) || quotaBytes < 0))) {
    return NextResponse.json({ ok: false, message: "Invalid quota." }, { status: 400 });
  }
  const user = await updateUser(userId, { quotaBytes, plan, disabled, emailVerified });
  return NextResponse.json({ ok: true, user });
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
    return NextResponse.json({ ok: true, user: updated || user });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Create user failed." },
      { status: 400 }
    );
  }
}
