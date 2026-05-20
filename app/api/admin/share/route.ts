import { NextRequest, NextResponse } from "next/server";
import { getAppUrl, getCurrentUser, isAdmin } from "@/lib/auth";
import { createShareLink, updateShareLink, type SharePermission, type ShareVisibility } from "@/lib/share-db";
import { sendEmail } from "@/lib/email/resend";
import { shareAccessTemplate } from "@/lib/email/templates";
import { resolveExisting } from "@/lib/file-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rootPath = typeof body?.rootPath === "string" ? body.rootPath : "";
  const name = typeof body?.name === "string" ? body.name : typeof body?.title === "string" ? body.title : "Shared Link";
  const canDownload = body?.canDownload !== false;
  const expiresAt = typeof body?.expiresAt === "string" && body.expiresAt ? body.expiresAt : null;
  const note = typeof body?.note === "string" ? body.note : "";
  const visibility: ShareVisibility = body?.visibility === "PRIVATE_EMAILS" ? "PRIVATE_EMAILS" : "PUBLIC";
  const permission: SharePermission =
    body?.permission === "VIEW_ONLY" || body?.permission === "UPLOAD" || body?.permission === "FULL" || body?.permission === "DOWNLOAD"
      ? body.permission
      : canDownload
        ? "DOWNLOAD"
        : "VIEW_ONLY";
  const allowedEmails = Array.isArray(body?.allowedEmails)
    ? body.allowedEmails.filter((item: unknown) => typeof item === "string")
    : [];

  try {
    await resolveExisting(rootPath);
    const link = await createShareLink({ rootPath, name, canDownload, expiresAt, note, visibility, allowedEmails, permission });
    const appUrl = getAppUrl();
    const shareUrl = `${appUrl}/share/${link.token}`;

    if (link.visibility === "PRIVATE_EMAILS" && link.allowedEmails.length) {
      const admin = await getCurrentUser();
      const sent: string[] = [];
      for (const email of link.allowedEmails) {
        const template = shareAccessTemplate({
          sharedBy: admin?.email || "VJM Drive admin",
          shareTitle: link.title,
          shareUrl,
          permission: link.permission,
          expiresAt: link.expiresAt,
        });
        const result = await sendEmail({ to: email, ...template });
        if (result.ok) sent.push(email);
      }
      if (sent.length) await updateShareLink(link.token, { invitedEmails: sent });
    }

    return NextResponse.json({ ok: true, token: link.token, url: `/share/${link.token}`, link });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Create share failed" },
      { status: 400 }
    );
  }
}
