import fs from "fs/promises";
import { NextResponse } from "next/server";
import { findUserById, getAppUrl, getCurrentUser } from "@/lib/auth";
import {
  createClientSelectLink,
  getClientSelectDisplayStatus,
  getClientSelectLinksByOwner,
  getLatestClientSelectSubmission,
  readClientSelectLinks,
} from "@/lib/client-select-db";
import { activeClientSelectCount, canCreateClientSelect } from "@/lib/client-select-plan";
import { resolveExisting } from "@/lib/file-ops";
import { normalizeDrivePath } from "@/lib/safe-path";
import { resolveUserDrivePath } from "@/lib/user-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function cleanMaxSelected(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return null;
  return Math.floor(numberValue);
}

function cleanDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid deadline.");
  return date.toISOString();
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });

  const links = session.role === "ADMIN"
    ? (await readClientSelectLinks()).filter((link) => !link.deletedAt)
    : await getClientSelectLinksByOwner(session.id);

  const rows = await Promise.all(
    links.map(async (link) => {
      const latestSubmission = await getLatestClientSelectSubmission(link.id);
      return {
        ...link,
        publicUrl: `/select/${link.token}`,
        absolutePublicUrl: `${getAppUrl()}/select/${link.token}`,
        displayStatus: getClientSelectDisplayStatus(link),
        selectedCount: latestSubmission?.selectedFilePaths.length || 0,
        submittedAt: latestSubmission?.submittedAt || link.submittedAt || null,
        updatedAt: latestSubmission?.updatedAt || null,
        latestSubmission,
      };
    })
  );

  return NextResponse.json({ ok: true, links: rows });
}

export async function POST(req: Request) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const projectName = cleanText(body?.projectName || body?.title, "Client Select");
  const clientName = cleanText(body?.clientName);
  const clientEmail = cleanText(body?.clientEmail);
  const rootPath = cleanText(body?.rootPath);
  const maxSelectedPhotos = cleanMaxSelected(body?.maxSelectedPhotos ?? body?.maxSelected);
  const allowOriginalDownload = Boolean(body?.allowOriginalDownload);
  const allowEditAfterSubmit = Boolean(body?.allowEditAfterSubmit);

  try {
    const expiresAt = cleanDate(body?.expiresAt);
    let fullRootPath = "";
    let ownerUserId: string | "admin" = "admin";

    if (session.role === "USER") {
      const user = await findUserById(session.id);
      if (!user || user.disabled) {
        return NextResponse.json({ ok: false, message: "Account unavailable." }, { status: 403 });
      }
      const existingLinks = await readClientSelectLinks();
      const guard = canCreateClientSelect(
        { role: session.role, plan: user.plan },
        activeClientSelectCount(existingLinks, user.id)
      );
      if (!guard.ok) {
        return NextResponse.json({ ok: false, message: guard.message, plan: guard.plan, limit: guard.limit }, { status: 403 });
      }
      ownerUserId = session.id;
      fullRootPath = resolveUserDrivePath(user, rootPath);
    } else {
      fullRootPath = normalizeDrivePath(rootPath);
    }

    const resolved = await resolveExisting(fullRootPath);
    const stat = await fs.stat(resolved.absolutePath);
    if (!stat.isDirectory()) throw new Error("Client Select is available for folders.");

    const link = await createClientSelectLink({
      ownerUserId,
      projectName,
      clientName,
      clientEmail,
      rootPath: fullRootPath,
      maxSelectedPhotos,
      allowOriginalDownload,
      allowEditAfterSubmit,
      expiresAt,
    });

    return NextResponse.json({
      ok: true,
      link,
      publicUrl: `/select/${link.token}`,
      absolutePublicUrl: `${getAppUrl()}/select/${link.token}`,
    });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Create Client Select failed." },
      { status: 400 }
    );
  }
}
