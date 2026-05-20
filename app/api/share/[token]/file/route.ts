import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canUserAccessShare, getShareAccessReason, getValidShareLink } from "@/lib/share-db";
import { createShareFileResponse } from "@/lib/share-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/share/[token]/file">) {
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

  const filePath = req.nextUrl.searchParams.get("path") || "";
  const download = req.nextUrl.searchParams.get("download") === "1";

  if (download && !share.downloadEnabled) {
    return NextResponse.json(
      {
        ok: false,
        code: "DOWNLOAD_DISABLED",
        message: "Download is disabled for this share.",
      },
      { status: 403 }
    );
  }

  const response = await createShareFileResponse(token, filePath, req.headers.get("range"), download);

  return (
    response ||
    NextResponse.json(
      {
        ok: false,
        code: "FILE_NOT_FOUND",
        message: "File not found.",
      },
      { status: 404 }
    )
  );
}