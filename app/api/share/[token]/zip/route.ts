import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canUserAccessShare, getShareAccessReason, getValidShareLink } from "@/lib/share-db";
import { resolveSharePath } from "@/lib/share-file";
import { createZipResponse } from "@/lib/zip-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/share/[token]/zip">) {
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
    return NextResponse.json(
      {
        ok: false,
        code: accessReason,
        requiresLogin: accessReason === "LOGIN_REQUIRED",
        loginUrl: `/login?next=${encodeURIComponent(`/share/${token}`)}`,
        message:
          accessReason === "LOGIN_REQUIRED"
            ? "Please login first to access this share."
            : "Access denied. Your email is not allowed to open this share.",
      },
      { status: accessReason === "LOGIN_REQUIRED" ? 401 : 403 }
    );
  }

  if (!share.downloadEnabled) {
    return NextResponse.json(
      {
        ok: false,
        code: "DOWNLOAD_DISABLED",
        message: "Download is disabled for this share.",
      },
      { status: 403 }
    );
  }

  const requestedPath = req.nextUrl.searchParams.get("path") || "";
  const resolved = await resolveSharePath(token, requestedPath).catch(() => null);

  if (!resolved) {
    return NextResponse.json(
      {
        ok: false,
        code: "FILE_NOT_FOUND",
        message: "File or folder not found.",
      },
      { status: 404 }
    );
  }

  const folderStat = await fs.stat(resolved.safePath.absolutePath).catch(() => null);
  if (!folderStat || !folderStat.isDirectory()) {
    return NextResponse.json(
      {
        ok: false,
        code: "FOLDER_NOT_FOUND",
        message: "Folder not found.",
      },
      { status: 404 }
    );
  }

  return createZipResponse(
    resolved.safePath.absolutePath,
    path.basename(requestedPath || resolved.share.name)
  );
}
