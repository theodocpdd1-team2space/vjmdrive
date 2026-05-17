import { NextRequest, NextResponse } from "next/server";
import { listDriveFolder } from "@/lib/drive-list";
import { getValidShareLink } from "@/lib/share-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/share/[token]/list">) {
  const { token } = await ctx.params;
  const share = await getValidShareLink(token);
  if (!share) return NextResponse.json({ ok: false, message: "Share link expired or not found" }, { status: 404 });

  try {
    const path = req.nextUrl.searchParams.get("path") || "";
    const data = await listDriveFolder({
      path,
      scopeRootPath: share.rootPath,
      urlPrefix: `/api/share/${token}`,
      canDownload: share.canDownload,
    });

    return NextResponse.json({
      ok: true,
      share: {
        name: share.name,
        canDownload: share.canDownload,
        expiresAt: share.expiresAt,
        note: share.note || "",
      },
      ...data,
    });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Folder not found" },
      { status: 404 }
    );
  }
}
