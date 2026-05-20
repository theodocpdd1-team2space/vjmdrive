import { NextResponse } from "next/server";
import { isAdmin, readUsers, updateUser, userStoragePath, type UserPlan } from "@/lib/auth";
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
