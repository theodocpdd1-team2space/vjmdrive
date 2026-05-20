import { NextResponse } from "next/server";
import {
  authenticateUser,
  createSessionToken,
  ensureAdminUser,
  findUserByEmail,
  setSessionCookies,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  let user = null;
  let failureMessage = "Password salah";

  if (email) {
    const result = await authenticateUser(email, password);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.message, code: result.code },
        { status: 401 }
      );
    }
    user = result.user;
  } else {
    const admin = await ensureAdminUser();
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.DRIVE_PASSWORD;
    const matchesHash = await verifyPassword(password, admin.passwordHash);
    const matchesLegacy = Boolean(adminPassword && password === adminPassword);
    if (matchesHash || matchesLegacy) user = admin;
    failureMessage = "Password salah";
  }

  if (!user) {
    const maybeUser = email ? await findUserByEmail(email) : null;
    if (maybeUser && !maybeUser.emailVerified) failureMessage = "Please verify your email first.";
    return NextResponse.json({ ok: false, message: failureMessage }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, user: { role: user.role, email: user.email } });
  setSessionCookies(response, await createSessionToken(user), user.role);

  return response;
}
