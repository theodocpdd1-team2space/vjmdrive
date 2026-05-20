import { NextResponse } from "next/server";
import { findUserById, getAppUrl, getCurrentUser } from "@/lib/auth";
import { shareAccessTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";
import { resolveExisting } from "@/lib/file-ops";
import { createShareLink, updateShareLink, type SharePermission, type ShareVisibility } from "@/lib/share-db";
import { resolveUserDrivePath } from "@/lib/user-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmails(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((email) => email.trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    )
  );
}

export async function POST(req: Request) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  if (session.role !== "USER") return NextResponse.json({ ok: false, message: "User drive share only." }, { status: 403 });

  const user = await findUserById(session.id);
  if (!user || user.disabled) return NextResponse.json({ ok: false, message: "Account unavailable." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const rootPath = typeof body?.rootPath === "string" ? body.rootPath : "";
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "Shared file";
  const note = typeof body?.note === "string" ? body.note : "";
  const expiresAt = typeof body?.expiresAt === "string" && body.expiresAt ? body.expiresAt : null;
  const visibility: ShareVisibility = body?.visibility === "PRIVATE_EMAILS" ? "PRIVATE_EMAILS" : "PUBLIC";
  const permission: SharePermission = body?.permission === "VIEW_ONLY" ? "VIEW_ONLY" : "DOWNLOAD";
  const allowedEmails = normalizeEmails(body?.allowedEmails);

  try {
    const fullRootPath = resolveUserDrivePath(user.id, rootPath);
    await resolveExisting(fullRootPath);

    const link = await createShareLink({
      rootPath: fullRootPath,
      title,
      note,
      expiresAt,
      visibility,
      allowedEmails,
      permission,
      canDownload: permission === "DOWNLOAD",
      ownerUserId: user.id,
    });

    const shareUrl = `${getAppUrl()}/share/${link.token}`;
    const sent: string[] = [];
    const failed: string[] = [];

    if (visibility === "PRIVATE_EMAILS") {
      for (const email of link.allowedEmails) {
        const template = shareAccessTemplate({
          sharedBy: user.email,
          shareTitle: link.title,
          shareUrl,
          permission: link.permission,
          expiresAt: link.expiresAt,
        });
        const result = await sendEmail({ to: email, ...template });
        if (result.ok) sent.push(email);
        else failed.push(email);
      }
      if (sent.length) await updateShareLink(link.token, { invitedEmails: sent });
    }

    return NextResponse.json({
      ok: true,
      token: link.token,
      url: `/share/${link.token}`,
      link,
      invite: { sent, failed, attempted: visibility === "PRIVATE_EMAILS" && link.allowedEmails.length > 0 },
    });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Create share failed." },
      { status: 400 }
    );
  }
}
