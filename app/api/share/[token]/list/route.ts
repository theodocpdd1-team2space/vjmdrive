import { NextRequest, NextResponse } from "next/server";
import { listDriveFolder } from "@/lib/drive-list";
import { getCurrentUser } from "@/lib/auth";
import { canUserAccessShare, getShareAccessReason, getValidShareLink } from "@/lib/share-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/share/[token]/list">) {
  const { token } = await ctx.params;

  const share = await getValidShareLink(token);

  if (!share) {
    return NextResponse.json(
      {
        ok: false,
        code: "SHARE_NOT_FOUND",
        message: "Share link expired or not found.",
      },
      { status: 404 }
    );
  }

  const user = await getCurrentUser();
  const accessReason = getShareAccessReason(share, user);

  if (!canUserAccessShare(share, user)) {
    const loginUrl = `/login?next=${encodeURIComponent(`/share/${token}`)}`;

    return NextResponse.json(
      {
        ok: false,
        code: accessReason,
        requiresLogin: accessReason === "LOGIN_REQUIRED",
        loginUrl,
        message:
          accessReason === "LOGIN_REQUIRED"
            ? "Please login first to access this share."
            : "Access denied. Your email is not allowed to open this share.",
      },
      { status: accessReason === "LOGIN_REQUIRED" ? 401 : 403 }
    );
  }

  try {
    const requestedPath = req.nextUrl.searchParams.get("path") || "";
    const canManageShare = user?.role === "ADMIN" || user?.id === share.ownerUserId;

    const data = await listDriveFolder({
      path: requestedPath,
      scopeRootPath: share.rootPath,
      urlPrefix: `/api/share/${token}`,
      canDownload: share.canDownload,
    });

    return NextResponse.json({
      ok: true,
      share: {
        id: share.id,
        token: share.token,
        name: share.name,
        title: share.title,
        rootPath: canManageShare ? share.rootPath : "",
        canDownload: share.downloadEnabled,
        downloadEnabled: share.downloadEnabled,
        previewEnabled: share.previewEnabled,
        permission: share.permission,
        visibility: share.visibility,
        allowedEmails: canManageShare ? share.allowedEmails : [],
        expiresAt: share.expiresAt,
        note: share.note || "",
      },
      ...data,
    });
  } catch (caught) {
    return NextResponse.json(
      {
        ok: false,
        code: "FOLDER_NOT_FOUND",
        message: caught instanceof Error ? caught.message : "Folder not found.",
      },
      { status: 404 }
    );
  }
}
