import { NextResponse } from "next/server";
import { ADMIN_COOKIE, AUTH_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  const adminPassword = process.env.ADMIN_PASSWORD || process.env.DRIVE_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    return NextResponse.json({ ok: false, message: "Password salah" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  };

  response.cookies.set(ADMIN_COOKIE, "yes", cookieOptions);
  response.cookies.set(AUTH_COOKIE, "yes", cookieOptions);

  return response;
}
