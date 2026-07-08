import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getAppUrl, getCurrentUser } from "@/lib/auth";
import {
  getClientSelectLinkForUser,
  getClientSelectDisplayStatus,
  getClientSelectSubmissionsByLink,
  updateClientSelectLink,
  type ClientSelectLink,
  type ClientSelectSubmission,
} from "@/lib/client-select-db";
import { formatBytes, getDriveItemType, getExtension } from "@/lib/file-utils";
import { getPreviewMetadata } from "@/lib/preview-cache";
import { assertRealPathInsideRoot, isDriveSubPath, resolveSafePath } from "@/lib/safe-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid deadline.");
  return date.toISOString();
}

async function selectedFileDetails(link: ClientSelectLink, submission: ClientSelectSubmission | null) {
  if (!submission) return [];

  return Promise.all(
    submission.selectedFilePaths.map(async (filePath, index) => {
      try {
        const fullPath = path.posix.join(link.rootPath, filePath);
        if (!isDriveSubPath(link.rootPath, fullPath)) throw new Error("Invalid selected path.");
        const safePath = resolveSafePath(fullPath);
        await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);
        const stat = await fs.stat(safePath.absolutePath);
        if (!stat.isFile()) throw new Error("Selected file not found.");
        const preview = await getPreviewMetadata(fullPath, stat, false);
        const params = new URLSearchParams({ path: filePath });

        return {
          filename: submission.selectedFilenames[index] || path.posix.basename(filePath),
          path: filePath,
          note: submission.selectedFiles[index]?.note || "",
          type: getDriveItemType(filePath, false),
          extension: getExtension(filePath),
          size: formatBytes(stat.size),
          bytes: stat.size,
          modified: stat.mtime.toISOString(),
          previewStatus: preview.previewStatus,
          thumbnailUrl: preview.thumbnailUrl ? `/api/select/${link.token}/thumbnail?${params.toString()}` : null,
          previewUrl: preview.previewUrl ? `/api/select/${link.token}/preview?${params.toString()}` : null,
          originalUrl: `/api/select/${link.token}/file?${params.toString()}`,
        };
      } catch (caught) {
        return {
          filename: submission.selectedFilenames[index] || path.posix.basename(filePath),
          path: filePath,
          note: submission.selectedFiles[index]?.note || "",
          type: "file",
          extension: getExtension(filePath),
          size: null,
          bytes: 0,
          modified: null,
          previewStatus: "missing",
          thumbnailUrl: null,
          previewUrl: null,
          originalUrl: null,
          error: caught instanceof Error ? caught.message : "File unavailable.",
        };
      }
    })
  );
}

export async function GET(_req: Request, ctx: RouteContext<"/api/client-select/[id]">) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });

  const { id } = await ctx.params;
  const link = await getClientSelectLinkForUser(id, session);
  if (!link) return NextResponse.json({ ok: false, message: "Client Select link not found." }, { status: 404 });

  const submissions = await getClientSelectSubmissionsByLink(link.id);
  const latestSubmission = submissions[0] || null;
  return NextResponse.json({
    ok: true,
    link: {
      ...link,
      publicUrl: `/select/${link.token}`,
      absolutePublicUrl: `${getAppUrl()}/select/${link.token}`,
      displayStatus: getClientSelectDisplayStatus(link),
    },
    submissions,
    latestSubmission,
    selectedFiles: await selectedFileDetails(link, latestSubmission),
  });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/client-select/[id]">) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });

  const { id } = await ctx.params;
  const link = await getClientSelectLinkForUser(id, session);
  if (!link) return NextResponse.json({ ok: false, message: "Client Select link not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  let expiresAt: string | null;
  try {
    expiresAt = cleanDate(body?.expiresAt);
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Invalid deadline." },
      { status: 400 }
    );
  }
  const patch = {
    projectName: typeof body?.projectName === "string" && body.projectName.trim() ? body.projectName.trim() : link.projectName,
    clientName: typeof body?.clientName === "string" ? body.clientName.trim() : link.clientName,
    clientEmail: typeof body?.clientEmail === "string" ? body.clientEmail.trim() : link.clientEmail,
    maxSelectedPhotos:
      Number.isFinite(Number(body?.maxSelectedPhotos)) && Number(body.maxSelectedPhotos) > 0
        ? Math.floor(Number(body.maxSelectedPhotos))
        : null,
    allowOriginalDownload: Boolean(body?.allowOriginalDownload),
    allowEditAfterSubmit: Boolean(body?.allowEditAfterSubmit),
    expiresAt,
    status:
      body?.status === "WAITING_CLIENT" || body?.status === "VIEWED" || body?.status === "SUBMITTED" || body?.status === "LOCKED"
        ? body.status
        : link.status,
    isActive: body?.isActive !== false,
  };
  const nextLink = await updateClientSelectLink(link.id, patch);

  return NextResponse.json({ ok: true, link: nextLink });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/client-select/[id]">) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });

  const { id } = await ctx.params;
  const link = await getClientSelectLinkForUser(id, session);
  if (!link) return NextResponse.json({ ok: false, message: "Client Select link not found." }, { status: 404 });

  const nextLink = await updateClientSelectLink(link.id, {
    isActive: false,
    status: "LOCKED",
  });

  return NextResponse.json({ ok: true, link: nextLink });
}
