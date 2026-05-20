import { NextResponse } from "next/server";
import { getAppUrl, getCurrentUser, isAdmin } from "@/lib/auth";
import { readShareLinks, revokeShareLink, updateShareLink } from "@/lib/share-db";
import { sendEmail } from "@/lib/email/resend";
import { shareAccessTemplate } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/shares/[token]">) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const { token } = await ctx.params;
  const revoked = await revokeShareLink(token);
  return NextResponse.json({ ok: true, revoked });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/shares/[token]">) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const { token } = await ctx.params;
  const body = await req.json().catch(() => null);
  const links = await readShareLinks();
  const share = links.find((item) => item.token === token);
  if (!share) return NextResponse.json({ ok: false, message: "Share not found" }, { status: 404 });

  const allowedEmails = Array.isArray(body?.allowedEmails)
    ? body.allowedEmails.filter((item: unknown) => typeof item === "string")
    : share.allowedEmails;
  const next = await updateShareLink(token, {
    allowedEmails,
    visibility: body?.visibility === "PRIVATE_EMAILS" ? "PRIVATE_EMAILS" : share.visibility,
    permission: body?.permission || share.permission,
    expiresAt: typeof body?.expiresAt === "string" ? body.expiresAt : share.expiresAt,
  });

  return NextResponse.json({ ok: true, link: next });
}

export async function POST(req: Request, ctx: RouteContext<"/api/admin/shares/[token]">) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const { token } = await ctx.params;
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const links = await readShareLinks();
  const share = links.find((item) => item.token === token);
  if (!share) return NextResponse.json({ ok: false, message: "Share not found" }, { status: 404 });
  if (!share.allowedEmails.includes(email)) {
    return NextResponse.json({ ok: false, message: "Email is not allowed on this share." }, { status: 400 });
  }

  const admin = await getCurrentUser();
  const shareUrl = `${getAppUrl()}/share/${share.token}`;
  const template = shareAccessTemplate({
    sharedBy: admin?.email || "VJM Drive admin",
    shareTitle: share.title,
    shareUrl,
    permission: share.permission,
    expiresAt: share.expiresAt,
  });
  const sent = await sendEmail({ to: email, ...template });
  if (sent.ok) {
    await updateShareLink(share.token, { invitedEmails: Array.from(new Set([...share.invitedEmails, email])) });
  }
  return NextResponse.json({ ok: sent.ok });
}
