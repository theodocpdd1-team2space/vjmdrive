import { NextResponse } from "next/server";
import { getAppUrl, getCurrentUser, isAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const to = typeof body?.to === "string" ? body.to.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ ok: false, message: "Email tujuan tidak valid." }, { status: 400 });
  }

  const admin = await getCurrentUser();
  const timestamp = new Date().toISOString();
  const appUrl = getAppUrl();
  const result = await sendEmail({
    to,
    subject: "VJM Drive test email",
    actionUrl: appUrl,
    text: `VJM Drive test email\n\nSent by: ${admin?.email || "admin"}\nTimestamp: ${timestamp}\nAPP_URL: ${appUrl}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6"><h1>VJM Drive test email</h1><p>Sent by: ${admin?.email || "admin"}</p><p>Timestamp: ${timestamp}</p><p><a href="${appUrl}">${appUrl}</a></p></div>`,
  });

  if (!result.ok) return NextResponse.json({ ok: false, message: "Resend failed." }, { status: 502 });
  return NextResponse.json({ ok: true, result });
}
