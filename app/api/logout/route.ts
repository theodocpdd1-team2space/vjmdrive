import { NextResponse } from "next/server";
import { ADMIN_COOKIE, AUTH_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };

  response.cookies.set(ADMIN_COOKIE, "", cookieOptions);
  response.cookies.set(AUTH_COOKIE, "", cookieOptions);

  return response;
}
