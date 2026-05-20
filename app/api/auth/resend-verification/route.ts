import { NextResponse } from "next/server";
import { createAuthToken } from "@/lib/auth-tokens";
import { findUserByEmail, getAppUrl, normalizeEmail } from "@/lib/auth";
import { sendEmail } from "@/lib/email/resend";
import { verifyEmailTemplate } from "@/lib/email/templates";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const message = "If the account needs verification, instructions have been sent.";

  if (!checkRateLimit(rateLimitKey(req, `resend:${email}`))) {
    return NextResponse.json({ ok: true, message });
  }

  const user = email ? await findUserByEmail(email) : null;
  if (user && !user.emailVerified) {
    const { plainToken } = await createAuthToken({ userId: user.id, email: user.email, type: "VERIFY_EMAIL" });
    const verifyUrl = `${getAppUrl()}/verify-email?token=${encodeURIComponent(plainToken)}`;
    const template = verifyEmailTemplate({ name: user.name, verifyUrl });
    await sendEmail({ to: user.email, ...template });
  }

  return NextResponse.json({ ok: true, message });
}
