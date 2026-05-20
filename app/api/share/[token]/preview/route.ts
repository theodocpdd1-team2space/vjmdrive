import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canUserAccessShare, getShareAccessReason, getValidShareLink } from "@/lib/share-db";
import { createSharePreviewResponse } from "@/lib/share-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/share/[token]/preview">) {
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

  if (!share.previewEnabled) {
    return NextResponse.json(
      {
        ok: false,
        code: "PREVIEW_DISABLED",
        message: "Preview is disabled for this share.",
      },
      { status: 403 }
    );
  }

  const filePath = req.nextUrl.searchParams.get("path") || "";
  const response = await createSharePreviewResponse(token, filePath, req.headers.get("range"));

  return (
    response ||
    NextResponse.json(
      {
        ok: false,
        code: "PREVIEW_NOT_FOUND",
        message: "Preview not found.",
      },
      { status: 404 }
    )
  );
}