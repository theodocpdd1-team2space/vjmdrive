import { NextResponse } from "next/server";
import { getAppUrl, getCurrentUser, isAdmin } from "@/lib/auth";
import { readShareLinks, revokeShareLink, updateShareLink } from "@/lib/share-db";
import { sendEmail } from "@/lib/email/resend";
import { shareAccessTemplate } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeEmailList(value: unknown) {
  if (!Array.isArray(value)) return null;

  const emails = value
    .filter((item): item is string => typeof item === "string")
    .map(normalizeEmail)
    .filter(Boolean);

  return Array.from(new Set(emails));
}

function isValidVisibility(value: unknown) {
  return value === "PUBLIC" || value === "PRIVATE_EMAILS";
}

function isValidPermission(value: unknown) {
  return value === "VIEW_ONLY" || value === "DOWNLOAD" || value === "UPLOAD" || value === "FULL";
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/shares/[token]">) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      {
        ok: false,
        message: "Admin access required.",
      },
      { status: 401 }
    );
  }

  const { token } = await ctx.params;
  const revoked = await revokeShareLink(token);

  return NextResponse.json({
    ok: true,
    revoked,
  });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/shares/[token]">) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      {
        ok: false,
        message: "Admin access required.",
      },
      { status: 401 }
    );
  }

  const { token } = await ctx.params;
  const body = await req.json().catch(() => null);

  const links = await readShareLinks();
  const share = links.find((item) => item.token === token);

  if (!share) {
    return NextResponse.json(
      {
        ok: false,
        message: "Share not found.",
      },
      { status: 404 }
    );
  }

  const allowedEmails = normalizeEmailList(body?.allowedEmails);

  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (allowedEmails) {
    patch.allowedEmails = allowedEmails;

    if (allowedEmails.length > 0 && share.visibility !== "PRIVATE_EMAILS") {
      patch.visibility = "PRIVATE_EMAILS";
    }

    if (allowedEmails.length === 0 && share.visibility === "PRIVATE_EMAILS" && body?.visibility !== "PRIVATE_EMAILS") {
      patch.visibility = "PUBLIC";
    }
  }

  if (isValidVisibility(body?.visibility)) {
    patch.visibility = body.visibility;
  }

  if (isValidPermission(body?.permission)) {
    patch.permission = body.permission;
  }

  if (typeof body?.title === "string") {
    const title = body.title.trim();
    if (title) {
      patch.title = title;
      patch.name = title;
    }
  }

  if (typeof body?.note === "string") {
    patch.note = body.note.slice(0, 1000);
  }

  if (typeof body?.expiresAt === "string") {
    patch.expiresAt = body.expiresAt.trim() || null;
  }

  if (typeof body?.pinned === "boolean") {
    patch.pinned = body.pinned;
  }

  const next = await updateShareLink(token, patch as Parameters<typeof updateShareLink>[1]);

  return NextResponse.json({
    ok: true,
    link: next,
  });
}

export async function POST(req: Request, ctx: RouteContext<"/api/admin/shares/[token]">) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      {
        ok: false,
        message: "Admin access required.",
      },
      { status: 401 }
    );
  }

  const { token } = await ctx.params;
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";

  if (!email) {
    return NextResponse.json(
      {
        ok: false,
        message: "Email is required.",
      },
      { status: 400 }
    );
  }

  const links = await readShareLinks();
  const share = links.find((item) => item.token === token);

  if (!share) {
    return NextResponse.json(
      {
        ok: false,
        message: "Share not found.",
      },
      { status: 404 }
    );
  }

  if (!share.allowedEmails.includes(email)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Email is not allowed on this share.",
      },
      { status: 400 }
    );
  }

  const admin = await getCurrentUser();
  const shareUrl = `${getAppUrl()}/share/${share.token}`;

  const template = shareAccessTemplate({
    sharedBy: admin?.email || "driveOne admin",
    shareTitle: share.title,
    shareUrl,
    permission: share.permission,
    expiresAt: share.expiresAt,
  });

  const sent = await sendEmail({
    to: email,
    ...template,
  });

  if (sent.ok) {
    await updateShareLink(share.token, {
      invitedEmails: Array.from(new Set([...share.invitedEmails, email])),
    });
  }

  return NextResponse.json({
    ok: sent.ok,
  });
}
