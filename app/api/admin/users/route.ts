import { NextResponse } from "next/server";
import { isAdmin, readUsers, updateUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const users = (await readUsers()).map((user) => ({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    quotaBytes: user.quotaBytes,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }));
  return NextResponse.json({ ok: true, users });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const quotaBytes = body?.quotaBytes === null ? null : Number(body?.quotaBytes);
  if (!userId || (quotaBytes !== null && (!Number.isFinite(quotaBytes) || quotaBytes < 0))) {
    return NextResponse.json({ ok: false, message: "Invalid quota." }, { status: 400 });
  }
  const user = await updateUser(userId, { quotaBytes });
  return NextResponse.json({ ok: true, user });
}
