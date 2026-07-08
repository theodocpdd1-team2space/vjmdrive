import { NextRequest, NextResponse } from "next/server";
import { getLatestClientSelectSubmission, getValidClientSelectLink, markClientSelectViewed } from "@/lib/client-select-db";
import { listDriveFolder } from "@/lib/drive-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/select/[token]/list">) {
  const { token } = await ctx.params;
  const link = await getValidClientSelectLink(token);

  if (!link || link.status === "LOCKED") {
    return NextResponse.json(
      { ok: false, code: "LINK_UNAVAILABLE", message: "Client Select link is unavailable." },
      { status: 404 }
    );
  }

  try {
    const updated = await markClientSelectViewed(token);
    const activeLink = updated || link;
    const data = await listDriveFolder({
      path: req.nextUrl.searchParams.get("path") || "",
      scopeRootPath: activeLink.rootPath,
      urlPrefix: `/api/select/${token}`,
      canDownload: activeLink.allowOriginalDownload,
    });
    const latestSubmission = await getLatestClientSelectSubmission(activeLink.id);

    return NextResponse.json({
      ok: true,
      link: {
        token: activeLink.token,
        projectName: activeLink.projectName,
        clientName: activeLink.clientName,
        clientEmail: activeLink.clientEmail,
        maxSelectedPhotos: activeLink.maxSelectedPhotos,
        allowOriginalDownload: activeLink.allowOriginalDownload,
        allowEditAfterSubmit: activeLink.allowEditAfterSubmit,
        expiresAt: activeLink.expiresAt,
        status: activeLink.status,
      },
      submission: latestSubmission
        ? {
            selectedFiles: latestSubmission.selectedFiles,
            clientName: latestSubmission.clientName,
            clientEmail: latestSubmission.clientEmail,
            globalNote: latestSubmission.globalNote,
            submittedAt: latestSubmission.submittedAt,
            updatedAt: latestSubmission.updatedAt || null,
          }
        : null,
      ...data,
    });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, code: "FOLDER_NOT_FOUND", message: caught instanceof Error ? caught.message : "Folder not found." },
      { status: 404 }
    );
  }
}
