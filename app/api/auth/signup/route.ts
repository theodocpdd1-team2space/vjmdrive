import { NextResponse } from "next/server";
import { createAuthToken } from "@/lib/auth-tokens";
import { createUser, findUserByEmail, getAppUrl, normalizeEmail } from "@/lib/auth";
import { sendEmail } from "@/lib/email/resend";
import { verifyEmailTemplate } from "@/lib/email/templates";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!checkRateLimit(rateLimitKey(req, `signup:${email}`))) {
    return NextResponse.json({ ok: false, message: "Too many attempts. Please try again later." }, { status: 429 });
  }
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, message: "Nama dan email wajib valid." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, message: "Password minimal 8 karakter." }, { status: 400 });
  }
  if (await findUserByEmail(email)) {
    return NextResponse.json({ ok: false, message: "Email sudah terdaftar." }, { status: 409 });
  }

  const user = await createUser({ name, email, password, role: "USER", emailVerified: false });
  const { plainToken } = await createAuthToken({ userId: user.id, email: user.email, type: "VERIFY_EMAIL" });
  const verifyUrl = `${getAppUrl()}/verify-email?token=${encodeURIComponent(plainToken)}`;
  const template = verifyEmailTemplate({ name: user.name, verifyUrl });
  await sendEmail({ to: user.email, ...template });

  return NextResponse.json({
    ok: true,
    message: "Account created. Please check your email to verify your account.",
  });
}
