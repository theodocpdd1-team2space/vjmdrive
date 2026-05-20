import { NextResponse } from "next/server";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { hashPassword, updateUser } from "@/lib/auth";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!checkRateLimit(rateLimitKey(req, "reset-password"), 12)) {
    return NextResponse.json({ ok: false, message: "Too many attempts. Please try again later." }, { status: 429 });
  }
  if (!token || newPassword.length < 8) {
    return NextResponse.json({ ok: false, message: "Token dan password minimal 8 karakter wajib diisi." }, { status: 400 });
  }

  const consumed = await consumeAuthToken("RESET_PASSWORD", token);
  if (!consumed.ok) {
    return NextResponse.json({ ok: false, message: consumed.message }, { status: 400 });
  }

  await updateUser(consumed.record.userId, {
    passwordHash: await hashPassword(newPassword),
  });

  return NextResponse.json({ ok: true, message: "Password updated. You can now login." });
}
